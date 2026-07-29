/**
 * Importa un histórico real de radicados (ej: Radicados_1.xlsx) directamente
 * a la base de datos, SIN pasar por la asignación rotativa de trabajadores
 * (estos radicados ya fueron manejados manualmente antes de usar el sistema).
 *
 * Para cada serie detectada en la columna "consecutivo" (ej: CUEM-2526):
 *   - crea la Serie si no existe
 *   - inserta cada fila como Radicado real (esGap=false, personaId=null)
 *   - detecta gaps SOLO dentro del rango [min, max] observado en el archivo
 *     (los números anteriores al mínimo no se consideran gaps: son historia
 *     que quedó fuera del alcance de este archivo)
 *   - deja consecutivoActual = max(numero) de esa serie
 *
 * Uso: npx ts-node --compiler-options {\"module\":\"CommonJS\"} scripts/import-historico.ts <archivo.xlsx> [UCI,OTRA=no-distribuible]
 */
import ExcelJS from 'exceljs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function normalizarEncabezado(valor: unknown) {
  return String(valor ?? '').trim().toLowerCase()
}

function parseConsecutivo(valor: unknown): { serieCodigo: string; numero: number } | null {
  const texto = String(valor ?? '').trim()
  const match = texto.match(/^([A-Za-z]+)[\s-]*?(\d+)$/)
  if (!match) return null
  return { serieCodigo: match[1].toUpperCase(), numero: parseInt(match[2], 10) }
}

function parseFecha(valor: unknown): Date | undefined {
  const texto = String(valor ?? '').trim()
  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return undefined
  const [, dia, mes, anio] = match
  const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia))
  return Number.isNaN(fecha.getTime()) ? undefined : fecha
}

async function main() {
  const archivo = process.argv[2] ?? 'Radicados_1.xlsx'
  const noDistribuibles = new Set(
    (process.argv[3] ?? 'UCI').split(',').map((s) => s.trim().toUpperCase())
  )

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(archivo)
  const ws = workbook.worksheets[0]
  if (!ws) throw new Error('El archivo no contiene hojas')

  const columnas: Record<string, number> = {}
  ws.getRow(1).eachCell((cell, colNumber) => {
    columnas[normalizarEncabezado(cell.value)] = colNumber
  })

  const colConsecutivo = columnas['consecutivo']
  const colId = columnas['id']
  const colDescripcion = columnas['descripción'] ?? columnas['descripcion']
  const colFecha = columnas['fecha radica'] ?? columnas['fecha']

  if (!colConsecutivo) throw new Error('El archivo debe tener una columna "consecutivo"')

  interface Fila {
    fila: number
    serieCodigo: string
    numero: number
    idExterno?: number
    descripcion?: string
    fecha?: Date
  }

  const filas: Fila[] = []
  const invalidas: number[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const consecutivoValor = row.getCell(colConsecutivo).value
    if (!consecutivoValor) return
    const parsed = parseConsecutivo(consecutivoValor)
    if (!parsed) {
      invalidas.push(rowNumber)
      return
    }
    const idValor = colId ? row.getCell(colId).value : undefined
    const idExterno = idValor ? Number(idValor) : undefined
    filas.push({
      fila: rowNumber,
      serieCodigo: parsed.serieCodigo,
      numero: parsed.numero,
      idExterno: idExterno && !Number.isNaN(idExterno) ? idExterno : undefined,
      descripcion: colDescripcion ? String(row.getCell(colDescripcion).value ?? '') : undefined,
      fecha: colFecha ? parseFecha(row.getCell(colFecha).value) : undefined,
    })
  })

  console.log(`Filas leídas: ${filas.length} (inválidas: ${invalidas.length})`)

  const porSerie = new Map<string, Fila[]>()
  for (const f of filas) {
    const lista = porSerie.get(f.serieCodigo) ?? []
    lista.push(f)
    porSerie.set(f.serieCodigo, lista)
  }

  for (const [codigo, filasSerie] of porSerie) {
    const distribuible = !noDistribuibles.has(codigo)
    const serie = await prisma.serie.upsert({
      where: { codigo },
      update: {},
      create: { codigo, distribuible },
    })

    const numeros = filasSerie.map((f) => f.numero)
    const min = Math.min(...numeros)
    const max = Math.max(...numeros)
    const existentes = new Set(numeros)

    let insertados = 0
    let duplicados = 0
    for (const f of filasSerie) {
      try {
        await prisma.radicado.create({
          data: {
            serieId: serie.id,
            numero: f.numero,
            idExterno: f.idExterno ?? null,
            descripcion: f.descripcion || null,
            personaId: null,
            esGap: false,
            creadoPor: null,
            fechaCreacion: f.fecha ?? new Date(),
            mes: (f.fecha ?? new Date()).getMonth() + 1,
            anio: (f.fecha ?? new Date()).getFullYear(),
          },
        })
        insertados++
      } catch {
        duplicados++
      }
    }

    let gaps = 0
    for (let n = min + 1; n < max; n++) {
      if (existentes.has(n)) continue
      await prisma.radicado.create({
        data: {
          serieId: serie.id,
          numero: n,
          esGap: true,
          personaId: null,
          mes: new Date().getMonth() + 1,
          anio: new Date().getFullYear(),
        },
      })
      gaps++
    }

    await prisma.serie.update({ where: { id: serie.id }, data: { consecutivoActual: max } })

    console.log(
      `${codigo}: insertados=${insertados} duplicados=${duplicados} rango=[${min}-${max}] gaps=${gaps} distribuible=${distribuible}`
    )
  }

  console.log('Listo.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
