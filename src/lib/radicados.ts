import { Prisma, PrismaClient } from '@prisma/client'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export class RadicadoError extends Error {}

async function asignarSiguientePersona(tx: Tx, empresaId: string) {
  const config = await tx.configuracion.findUnique({ where: { empresaId } })
  if (!config) throw new RadicadoError('La configuración inicial no existe')

  const personas = await tx.persona.findMany({
    where: { empresaId, activo: true },
    orderBy: { orden: 'asc' },
  })
  if (personas.length === 0) {
    throw new RadicadoError('No hay personas activas configuradas')
  }

  const personaAsignada = personas[config.turnoActual % personas.length]
  const turnoSiguiente = (config.turnoActual + 1) % personas.length

  await tx.configuracion.update({
    where: { empresaId },
    data: { turnoActual: turnoSiguiente },
  })

  const personaSiguiente = personas[turnoSiguiente]

  return { personaAsignada, turnoSiguiente, personaSiguiente }
}

export async function getOrCreateSerie(
  tx: Tx,
  empresaId: string,
  codigo: string,
  distribuible = true
) {
  const codigoNormalizado = codigo.trim().toUpperCase()
  if (!codigoNormalizado) throw new RadicadoError('El código de la serie es obligatorio')

  const existente = await tx.serie.findUnique({
    where: { empresaId_codigo: { empresaId, codigo: codigoNormalizado } },
  })
  if (existente) return existente

  return tx.serie.create({ data: { empresaId, codigo: codigoNormalizado, distribuible } })
}

export async function getOrCreateEntidad(tx: Tx, empresaId: string, nombre: string) {
  const nombreNormalizado = nombre.trim()
  if (!nombreNormalizado) throw new RadicadoError('El nombre de la entidad no puede estar vacío')

  const existente = await tx.entidad.findUnique({
    where: { empresaId_nombre: { empresaId, nombre: nombreNormalizado } },
  })
  if (existente) return existente

  return tx.entidad.create({ data: { empresaId, nombre: nombreNormalizado } })
}

async function detectarYMarcarGaps(
  tx: Tx,
  empresaId: string,
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
        empresaId,
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
  entidadNombre?: string | null
  fecha?: Date
}

export async function registrarRadicado(tx: Tx, empresaId: string, input: RegistrarRadicadoInput) {
  const { numero, descripcion, creadoPor, idExterno } = input

  if (!Number.isInteger(numero) || numero <= 0) {
    throw new RadicadoError('El número de consecutivo debe ser un entero positivo')
  }

  const serie = await getOrCreateSerie(tx, empresaId, input.serieCodigo)
  const entidad = input.entidadNombre?.trim()
    ? await getOrCreateEntidad(tx, empresaId, input.entidadNombre)
    : null

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
    gapsDetectados = await detectarYMarcarGaps(
      tx,
      empresaId,
      serie.id,
      numero,
      serie.consecutivoActual,
      mes,
      anio
    )
  }

  let personaAsignada = null
  let turnoSiguiente: number | null = null
  let personaSiguiente = null

  if (serie.distribuible) {
    const asignacion = await asignarSiguientePersona(tx, empresaId)
    personaAsignada = asignacion.personaAsignada
    turnoSiguiente = asignacion.turnoSiguiente
    personaSiguiente = asignacion.personaSiguiente
  }

  const radicado = existente
    ? await tx.radicado.update({
        where: { serieId_numero: { serieId: serie.id, numero } },
        data: {
          empresaId,
          descripcion: descripcion ?? null,
          creadoPor: creadoPor ?? null,
          idExterno: idExterno ?? null,
          personaId: personaAsignada?.id ?? null,
          entidadId: entidad?.id ?? null,
          esGap: false,
          fechaCreacion: now,
          mes,
          anio,
        },
      })
    : await tx.radicado.create({
        data: {
          empresaId,
          serieId: serie.id,
          numero,
          descripcion: descripcion ?? null,
          creadoPor: creadoPor ?? null,
          idExterno: idExterno ?? null,
          personaId: personaAsignada?.id ?? null,
          entidadId: entidad?.id ?? null,
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
    radicado: { ...radicado, serie, entidad },
    personaAsignada,
    turnoSiguiente,
    personaSiguiente,
    gapsDetectados,
    distribuible: serie.distribuible,
  }
}

export interface FilaImportacion {
  fila: number
  serieCodigo: string
  numero: number
  descripcion?: string | null
  creadoPor?: string | null
  idExterno?: number | null
  entidadNombre?: string | null
  fecha?: Date
}

export interface ResultadoFilaImportacion {
  fila: number
  serieCodigo: string
  numero: number
  ok: boolean
  error?: string
  gapsDetectados: number[]
}

// Versión de registrarRadicado optimizada para importar muchas filas de una
// vez (Excel de histórico). La versión fila-por-fila hace ~8 consultas a la
// base de datos POR FILA (serie, entidad, turno, existencia, gaps uno por
// uno...), lo que con archivos de cientos de filas tarda minutos y se siente
// "pegado" sin ningún avance visible. Aquí se precarga todo lo que se puede
// precargar una sola vez (series, entidades, turno, radicados existentes) y
// se escribe en lote al final, dentro de la misma transacción.
export async function procesarImportacionLote(
  tx: Tx,
  empresaId: string,
  filas: FilaImportacion[]
): Promise<{ resultados: ResultadoFilaImportacion[] }> {
  const resultados: ResultadoFilaImportacion[] = []
  if (filas.length === 0) return { resultados }

  // Series únicas -> una sola consulta (o creación) por serie, no por fila.
  const codigosSerie = Array.from(new Set(filas.map((f) => f.serieCodigo.trim().toUpperCase())))
  const seriesPorCodigo = new Map<string, Awaited<ReturnType<typeof getOrCreateSerie>>>()
  for (const codigo of codigosSerie) {
    seriesPorCodigo.set(codigo, await getOrCreateSerie(tx, empresaId, codigo))
  }

  // Entidades únicas -> igual, una sola vez cada una.
  const nombresEntidad = Array.from(
    new Set(filas.map((f) => f.entidadNombre?.trim()).filter((n): n is string => !!n))
  )
  const entidadesPorNombre = new Map<string, { id: number }>()
  for (const nombre of nombresEntidad) {
    entidadesPorNombre.set(nombre, await getOrCreateEntidad(tx, empresaId, nombre))
  }

  // Turno y personas activas: se cargan una vez y se rota en memoria: el
  // valor final se escribe a la base de datos una sola vez al terminar.
  const config = await tx.configuracion.findUnique({ where: { empresaId } })
  if (!config) throw new RadicadoError('La configuración inicial no existe')
  const personasActivas = await tx.persona.findMany({
    where: { empresaId, activo: true },
    orderBy: { orden: 'asc' },
  })
  let turnoActual = config.turnoActual

  // Radicados existentes por serie, para detectar duplicados/gaps sin una
  // consulta por número -- una sola consulta por serie cubre todo su rango.
  const existentesPorSerie = new Map<number, Map<number, { id: number; esGap: boolean }>>()
  for (const [codigo, serie] of seriesPorCodigo) {
    const numerosDeEstaSerie = filas
      .filter((f) => f.serieCodigo.trim().toUpperCase() === codigo)
      .map((f) => f.numero)
    const maxNumero = Math.max(serie.consecutivoActual, ...numerosDeEstaSerie, 0)
    const existentes = await tx.radicado.findMany({
      where: { serieId: serie.id, numero: { lte: maxNumero } },
      select: { id: true, numero: true, esGap: true },
    })
    existentesPorSerie.set(serie.id, new Map(existentes.map((r) => [r.numero, { id: r.id, esGap: r.esGap }])))
  }

  const paraCrear: Prisma.RadicadoCreateManyInput[] = []
  const paraActualizar: { id: number; data: Prisma.RadicadoUncheckedUpdateInput }[] = []
  const consecutivoActualPorSerie = new Map<number, number>()

  for (const fila of filas) {
    const codigo = fila.serieCodigo.trim().toUpperCase()
    const serie = seriesPorCodigo.get(codigo)!
    const existentesSerie = existentesPorSerie.get(serie.id)!
    const consecutivoActual = consecutivoActualPorSerie.get(serie.id) ?? serie.consecutivoActual

    if (!Number.isInteger(fila.numero) || fila.numero <= 0) {
      resultados.push({
        fila: fila.fila,
        serieCodigo: codigo,
        numero: fila.numero,
        ok: false,
        error: 'El número de consecutivo debe ser un entero positivo',
        gapsDetectados: [],
      })
      continue
    }

    const existente = existentesSerie.get(fila.numero)
    if (existente && !existente.esGap) {
      resultados.push({
        fila: fila.fila,
        serieCodigo: codigo,
        numero: fila.numero,
        ok: false,
        error: `El consecutivo ${codigo}-${fila.numero} ya fue registrado`,
        gapsDetectados: [],
      })
      continue
    }

    const now = fila.fecha ?? new Date()
    const mes = now.getMonth() + 1
    const anio = now.getFullYear()

    const gapsDetectados: number[] = []
    if (!existente && fila.numero > consecutivoActual + 1) {
      for (let i = consecutivoActual + 1; i < fila.numero; i++) {
        if (existentesSerie.has(i)) continue
        paraCrear.push({ empresaId, serieId: serie.id, numero: i, esGap: true, personaId: null, mes, anio })
        existentesSerie.set(i, { id: -1, esGap: true })
        gapsDetectados.push(i)
      }
    }

    let personaId: number | null = null
    if (serie.distribuible && personasActivas.length > 0) {
      personaId = personasActivas[turnoActual % personasActivas.length].id
      turnoActual = (turnoActual + 1) % personasActivas.length
    }

    const entidad = fila.entidadNombre?.trim() ? entidadesPorNombre.get(fila.entidadNombre.trim()) : undefined

    if (existente?.esGap && existente.id !== -1) {
      paraActualizar.push({
        id: existente.id,
        data: {
          descripcion: fila.descripcion ?? null,
          creadoPor: fila.creadoPor ?? null,
          idExterno: fila.idExterno ?? null,
          personaId,
          entidadId: entidad?.id ?? null,
          esGap: false,
          fechaCreacion: now,
          mes,
          anio,
        },
      })
    } else {
      paraCrear.push({
        empresaId,
        serieId: serie.id,
        numero: fila.numero,
        descripcion: fila.descripcion ?? null,
        creadoPor: fila.creadoPor ?? null,
        idExterno: fila.idExterno ?? null,
        personaId,
        entidadId: entidad?.id ?? null,
        esGap: false,
        fechaCreacion: now,
        mes,
        anio,
      })
    }

    existentesSerie.set(fila.numero, { id: -1, esGap: false })
    if (fila.numero > consecutivoActual) consecutivoActualPorSerie.set(serie.id, fila.numero)
    resultados.push({ fila: fila.fila, serieCodigo: codigo, numero: fila.numero, ok: true, gapsDetectados })
  }

  if (paraCrear.length > 0) {
    await tx.radicado.createMany({ data: paraCrear })
  }
  for (const act of paraActualizar) {
    await tx.radicado.update({ where: { id: act.id }, data: act.data })
  }
  for (const [serieId, consecutivoActual] of consecutivoActualPorSerie) {
    await tx.serie.update({ where: { id: serieId }, data: { consecutivoActual } })
  }
  if (turnoActual !== config.turnoActual) {
    await tx.configuracion.update({ where: { empresaId }, data: { turnoActual } })
  }

  return { resultados }
}

export type { Prisma }
