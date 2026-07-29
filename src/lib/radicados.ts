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

export async function getOrCreateSerie(tx: Tx, codigo: string, distribuible = true) {
  const codigoNormalizado = codigo.trim().toUpperCase()
  if (!codigoNormalizado) throw new RadicadoError('El código de la serie es obligatorio')

  const existente = await tx.serie.findUnique({ where: { codigo: codigoNormalizado } })
  if (existente) return existente

  return tx.serie.create({ data: { codigo: codigoNormalizado, distribuible } })
}

async function detectarYMarcarGaps(
  tx: Tx,
  serieId: number,
  nuevoNumero: number,
  numeroActual: number,
  mes: number,
  anio: number
) {
  const gapsCreados: number[] = []
  for (let i = numeroActual + 1; i < nuevoNumero; i++) {
    const existente = await tx.radicado.findUnique({
      where: { serieId_numero: { serieId, numero: i } },
    })
    if (existente) continue
    await tx.radicado.create({
      data: {
        serieId,
        numero: i,
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
  serieCodigo: string
  numero: number
  descripcion?: string | null
  creadoPor?: string | null
  idExterno?: number | null
  fecha?: Date
}

export async function registrarRadicado(tx: Tx, input: RegistrarRadicadoInput) {
  const { numero, descripcion, creadoPor, idExterno } = input

  if (!Number.isInteger(numero) || numero <= 0) {
    throw new RadicadoError('El número de consecutivo debe ser un entero positivo')
  }

  const serie = await getOrCreateSerie(tx, input.serieCodigo)

  const now = input.fecha ?? new Date()
  const mes = now.getMonth() + 1
  const anio = now.getFullYear()

  const existente = await tx.radicado.findUnique({
    where: { serieId_numero: { serieId: serie.id, numero } },
  })

  let gapsDetectados: number[] = []
  if (existente && !existente.esGap) {
    throw new RadicadoError(`El consecutivo ${serie.codigo}-${numero} ya fue registrado`)
  }

  if (!existente && numero > serie.consecutivoActual + 1) {
    gapsDetectados = await detectarYMarcarGaps(tx, serie.id, numero, serie.consecutivoActual, mes, anio)
  }

  let personaAsignada = null
  let turnoSiguiente: number | null = null
  let personaSiguiente = null

  if (serie.distribuible) {
    const asignacion = await asignarSiguientePersona(tx)
    personaAsignada = asignacion.personaAsignada
    turnoSiguiente = asignacion.turnoSiguiente
    personaSiguiente = asignacion.personaSiguiente
  }

  const radicado = existente
    ? await tx.radicado.update({
        where: { serieId_numero: { serieId: serie.id, numero } },
        data: {
          descripcion: descripcion ?? null,
          creadoPor: creadoPor ?? null,
          idExterno: idExterno ?? null,
          personaId: personaAsignada?.id ?? null,
          esGap: false,
          fechaCreacion: now,
          mes,
          anio,
        },
      })
    : await tx.radicado.create({
        data: {
          serieId: serie.id,
          numero,
          descripcion: descripcion ?? null,
          creadoPor: creadoPor ?? null,
          idExterno: idExterno ?? null,
          personaId: personaAsignada?.id ?? null,
          esGap: false,
          fechaCreacion: now,
          mes,
          anio,
        },
      })

  if (numero > serie.consecutivoActual) {
    await tx.serie.update({
      where: { id: serie.id },
      data: { consecutivoActual: numero },
    })
  }

  return {
    radicado: { ...radicado, serie },
    personaAsignada,
    turnoSiguiente,
    personaSiguiente,
    gapsDetectados,
    distribuible: serie.distribuible,
  }
}

export type { Prisma }
