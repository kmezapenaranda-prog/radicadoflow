import { Prisma, PrismaClient } from '@prisma/client'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export class RadicadoError extends Error {}

async function asignarSiguientePersona(tx: Tx) {
  const config = await tx.configuracion.findUnique({ where: { id: 1 } })
  if (!config) throw new RadicadoError('La configuración inicial no existe')

  const personas = await tx.persona.findMany({
    where: { activo: true },
    orderBy: { orden: 'asc' },
  })
  if (personas.length === 0) {
    throw new RadicadoError('No hay personas activas configuradas')
  }

  const personaAsignada = personas[config.turnoActual % personas.length]
  const turnoSiguiente = (config.turnoActual + 1) % personas.length

  await tx.configuracion.update({
    where: { id: 1 },
    data: { turnoActual: turnoSiguiente },
  })

  const personaSiguiente = personas[turnoSiguiente]

  return { personaAsignada, turnoSiguiente, personaSiguiente }
}

async function detectarYMarcarGaps(
  tx: Tx,
  nuevoConsecutivo: number,
  consecutivoActual: number,
  mes: number,
  anio: number
) {
  const gapsCreados: number[] = []
  for (let i = consecutivoActual + 1; i < nuevoConsecutivo; i++) {
    const existente = await tx.radicado.findUnique({ where: { consecutivo: i } })
    if (existente) continue
    await tx.radicado.create({
      data: {
        consecutivo: i,
        esGap: true,
        personaId: null,
        mes,
        anio,
      },
    })
    gapsCreados.push(i)
  }
  return gapsCreados
}

export interface RegistrarRadicadoInput {
  consecutivo: number
  descripcion?: string | null
  creadoPor?: string | null
}

export async function registrarRadicado(tx: Tx, input: RegistrarRadicadoInput) {
  const { consecutivo, descripcion, creadoPor } = input

  if (!Number.isInteger(consecutivo) || consecutivo <= 0) {
    throw new RadicadoError('El consecutivo debe ser un entero positivo')
  }

  const config = await tx.configuracion.findUnique({ where: { id: 1 } })
  if (!config) throw new RadicadoError('La configuración inicial no existe')

  const now = new Date()
  const mes = now.getMonth() + 1
  const anio = now.getFullYear()

  const existente = await tx.radicado.findUnique({ where: { consecutivo } })

  let gapsDetectados: number[] = []
  if (existente && !existente.esGap) {
    throw new RadicadoError(`El consecutivo ${consecutivo} ya fue registrado`)
  }

  if (!existente && consecutivo > config.consecutivoActual + 1) {
    gapsDetectados = await detectarYMarcarGaps(tx, consecutivo, config.consecutivoActual, mes, anio)
  }

  const { personaAsignada, turnoSiguiente, personaSiguiente } = await asignarSiguientePersona(tx)

  const radicado = existente
    ? await tx.radicado.update({
        where: { consecutivo },
        data: {
          descripcion: descripcion ?? null,
          creadoPor: creadoPor ?? null,
          personaId: personaAsignada.id,
          esGap: false,
          fechaCreacion: now,
          mes,
          anio,
        },
      })
    : await tx.radicado.create({
        data: {
          consecutivo,
          descripcion: descripcion ?? null,
          creadoPor: creadoPor ?? null,
          personaId: personaAsignada.id,
          esGap: false,
          fechaCreacion: now,
          mes,
          anio,
        },
      })

  if (consecutivo > config.consecutivoActual) {
    await tx.configuracion.update({
      where: { id: 1 },
      data: { consecutivoActual: consecutivo },
    })
  }

  return {
    radicado,
    personaAsignada,
    turnoSiguiente,
    personaSiguiente,
    gapsDetectados,
  }
}

export type { Prisma }
