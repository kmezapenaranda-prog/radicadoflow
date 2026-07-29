import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { RadicadoError, registrarRadicado } from '@/lib/radicados'

interface FilaExcel {
  fila: number
  consecutivo: number
  descripcion?: string
  creadoPor?: string
}

function normalizarEncabezado(valor: unknown) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
}

async function parseExcel(buffer: Buffer): Promise<FilaExcel[]> {
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
  const colDescripcion = columnas['descripcion']
  const colCreadoPor = columnas['creadopor']

  if (!colConsecutivo) {
    throw new RadicadoError('El archivo debe tener una columna "consecutivo"')
  }

  const filas: FilaExcel[] = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const consecutivoValor = row.getCell(colConsecutivo).value
    const consecutivo = Number(consecutivoValor)
    if (!consecutivoValor || Number.isNaN(consecutivo)) return

    filas.push({
      fila: rowNumber,
      consecutivo,
      descripcion: colDescripcion ? String(row.getCell(colDescripcion).value ?? '') : undefined,
      creadoPor: colCreadoPor ? String(row.getCell(colCreadoPor).value ?? '') : undefined,
    })
  })

  return filas
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const soloPreview = searchParams.get('preview') === '1'

  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Debe adjuntar un archivo .xlsx' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let filas: FilaExcel[]
  try {
    filas = await parseExcel(buffer)
  } catch (error) {
    const message = error instanceof RadicadoError ? error.message : 'No se pudo leer el archivo'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (soloPreview) {
    return NextResponse.json({ filas: filas.slice(0, 5), total: filas.length })
  }

  const filasOrdenadas = [...filas].sort((a, b) => a.consecutivo - b.consecutivo)

  const procesados: FilaExcel[] = []
  const errores: { fila: number; consecutivo: number; error: string }[] = []
  const gaps: number[] = []

  for (const fila of filasOrdenadas) {
    try {
      const resultado = await prisma.$transaction((tx) =>
        registrarRadicado(tx, {
          consecutivo: fila.consecutivo,
          descripcion: fila.descripcion,
          creadoPor: fila.creadoPor,
        })
      )
      procesados.push(fila)
      gaps.push(...resultado.gapsDetectados)
    } catch (error) {
      errores.push({
        fila: fila.fila,
        consecutivo: fila.consecutivo,
        error: error instanceof RadicadoError ? error.message : 'Error inesperado al procesar la fila',
      })
    }
  }

  return NextResponse.json({
    procesados: procesados.length,
    errores,
    gaps,
  })
}
