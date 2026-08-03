import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { RadicadoError, procesarImportacionLote } from '@/lib/radicados'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'
// Importaciones grandes (varios cientos/miles de filas) pueden tardar más
// que el límite por defecto -- se procesan en lote (ver procesarImportacionLote)
// pero se deja margen amplio para archivos realmente grandes.
export const maxDuration = 60

interface FilaExcel {
  fila: number
  serieCodigo: string
  numero: number
  idExterno?: number
  descripcion?: string
  creadoPor?: string
  entidadNombre?: string
  fechaLimite?: Date
  tipoGlosa?: string
  fecha?: Date
}

function normalizarEncabezado(valor: unknown) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
}

// Acepta formatos "CUEM-2526", "CUEM 2526" o "CUEM2526"
function parseConsecutivo(valor: unknown): { serieCodigo: string; numero: number } | null {
  const texto = String(valor ?? '').trim()
  const match = texto.match(/^([A-Za-z]+)[\s-]*?(\d+)$/)
  if (!match) return null
  return { serieCodigo: match[1].toUpperCase(), numero: parseInt(match[2], 10) }
}

// Acepta "DD/MM/YYYY"
function parseFecha(valor: unknown): Date | undefined {
  const texto = String(valor ?? '').trim()
  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return undefined
  const [, dia, mes, anio] = match
  const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia))
  return Number.isNaN(fecha.getTime()) ? undefined : fecha
}

async function parseExcel(buffer: Buffer): Promise<{ filas: FilaExcel[]; invalidas: number[] }> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new RadicadoError('El archivo no contiene hojas')
  }

  const headerRow = worksheet.getRow(1)
  const columnas: Record<string, number> = {}
  headerRow.eachCell((cell, colNumber) => {
    columnas[normalizarEncabezado(cell.value)] = colNumber
  })

  const colConsecutivo = columnas['consecutivo']
  const colId = columnas['id']
  const colDescripcion = columnas['descripción'] ?? columnas['descripcion']
  const colCreadoPor = columnas['creadopor'] ?? columnas['registrado por']
  const colFecha = columnas['fecha radica'] ?? columnas['fecha']
  // Columna F del Excel compartido entre empresas: nombre de la entidad
  // (EPS/aseguradora) que remite el radicado.
  const colEntidad = columnas['nombre entidad'] ?? columnas['entidad']
  // Columnas O y P del mismo Excel compartido: fecha límite de respuesta y
  // tipo de glosa (glosa/devolución/ratificación).
  const colFechaLimite = columnas['fecha límite'] ?? columnas['fecha limite']
  const colTipoGlosa = columnas['tipo glosa']

  if (!colConsecutivo) {
    throw new RadicadoError('El archivo debe tener una columna "consecutivo" (ej: CUEM-2526)')
  }

  const filas: FilaExcel[] = []
  const invalidas: number[] = []
  worksheet.eachRow((row, rowNumber) => {
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
    const entidadValor = colEntidad ? String(row.getCell(colEntidad).value ?? '').trim() : ''

    filas.push({
      fila: rowNumber,
      serieCodigo: parsed.serieCodigo,
      numero: parsed.numero,
      idExterno: idExterno && !Number.isNaN(idExterno) ? idExterno : undefined,
      descripcion: colDescripcion ? String(row.getCell(colDescripcion).value ?? '') : undefined,
      creadoPor: colCreadoPor ? String(row.getCell(colCreadoPor).value ?? '') : undefined,
      entidadNombre: entidadValor || undefined,
      fechaLimite: colFechaLimite ? parseFecha(row.getCell(colFechaLimite).value) : undefined,
      tipoGlosa: colTipoGlosa ? String(row.getCell(colTipoGlosa).value ?? '').trim() || undefined : undefined,
      fecha: colFecha ? parseFecha(row.getCell(colFecha).value) : undefined,
    })
  })

  return { filas, invalidas }
}

export async function POST(request: NextRequest) {
  let empresaId: string
  try {
    ;({ empresaId } = await requireRole(['admin', 'creador']))
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const { searchParams } = new URL(request.url)
  const soloPreview = searchParams.get('preview') === '1'

  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Debe adjuntar un archivo .xlsx' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let filas: FilaExcel[]
  let invalidas: number[]
  try {
    const resultado = await parseExcel(buffer)
    filas = resultado.filas
    invalidas = resultado.invalidas
  } catch (error) {
    const message = error instanceof RadicadoError ? error.message : 'No se pudo leer el archivo'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (soloPreview) {
    return NextResponse.json({ filas: filas.slice(0, 5), total: filas.length, invalidas: invalidas.length })
  }

  const filasOrdenadas = [...filas].sort((a, b) => {
    if (a.serieCodigo !== b.serieCodigo) return a.serieCodigo.localeCompare(b.serieCodigo)
    return a.numero - b.numero
  })

  try {
    const { resultados } = await prisma.$transaction(
      (tx) => procesarImportacionLote(tx, empresaId, filasOrdenadas),
      { timeout: 55000 }
    )

    const errores = resultados
      .filter((r) => !r.ok)
      .map((r) => ({ fila: r.fila, consecutivo: `${r.serieCodigo}-${r.numero}`, error: r.error! }))
    const gaps = resultados.flatMap((r) => r.gapsDetectados.map((n) => `${r.serieCodigo}-${n}`))
    const procesados = resultados.filter((r) => r.ok).length

    return NextResponse.json({ procesados, errores, gaps, invalidas: invalidas.length })
  } catch (error) {
    const message = error instanceof RadicadoError ? error.message : 'No se pudo procesar la importación'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
