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

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Debe adjuntar un archivo .xlsx' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    return NextResponse.json({ error: 'El archivo no contiene hojas' }, { status: 400 })
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
    return NextResponse.json(
      { error: 'El archivo debe tener una columna "consecutivo"' },
      { status: 400 }
    )
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

  filas.sort((a, b) => a.consecutivo - b.consecutivo)

  const procesados: FilaExcel[] = []
  const errores: { fila: number; consecutivo: number; error: string }[] = []
  const gaps: number[] = []

  for (const fila of filas) {
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
