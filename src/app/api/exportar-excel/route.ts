import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError, requireEmpresaId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  let empresaId: string
  try {
    empresaId = await requireEmpresaId()
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    throw error
  }

  const { searchParams } = new URL(request.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))

  if (!mes || !anio) {
    return NextResponse.json({ error: 'Debe indicar mes y anio' }, { status: 400 })
  }

  const radicados = await prisma.radicado.findMany({
    where: { empresaId, mes, anio },
    include: { persona: true, serie: true, entidad: true },
    orderBy: [{ serieId: 'asc' }, { numero: 'asc' }],
  })

  const reales = radicados.filter((r) => !r.esGap)
  const gaps = radicados.filter((r) => r.esGap)

  function estadoDe(r: (typeof radicados)[number]) {
    if (r.esGap) return 'GAP'
    if (!r.serie.distribuible) return 'No aplica'
    return 'OK'
  }

  const porPersonaMap = new Map<string, number>()
  const porDiaMap = new Map<string, number>()
  for (const r of reales) {
    const nombre = r.persona?.nombre ?? (r.serie.distribuible ? 'Sin asignar' : `Sin repartir (${r.serie.codigo})`)
    porPersonaMap.set(nombre, (porPersonaMap.get(nombre) ?? 0) + 1)
    const fecha = r.fechaCreacion.toISOString().slice(0, 10)
    porDiaMap.set(fecha, (porDiaMap.get(fecha) ?? 0) + 1)
  }

  const workbook = new ExcelJS.Workbook()

  const resumen = workbook.addWorksheet('Resumen')
  resumen.addRow([`Informe ${mes}/${anio}`])
  resumen.addRow([])
  resumen.addRow(['Total radicados asignados', reales.length])
  resumen.addRow(['Total consecutivos GAP', gaps.length])
  resumen.addRow([])
  resumen.addRow(['Persona', 'Total', '% del mes'])
  for (const [nombre, total] of porPersonaMap) {
    resumen.addRow([nombre, total, `${((total / (reales.length || 1)) * 100).toFixed(1)}%`])
  }
  resumen.addRow([])
  resumen.addRow(['Fecha', 'Total'])
  for (const [fecha, total] of porDiaMap) {
    resumen.addRow([fecha, total])
  }
  resumen.getRow(1).font = { bold: true, size: 14 }
  resumen.getRow(6).font = { bold: true }
  resumen.columns.forEach((col) => (col.width = 20))

  const detalle = workbook.addWorksheet('Detalle')
  detalle.addRow([
    'Consecutivo',
    'Persona',
    'Entidad',
    'Descripción',
    'Registrado por',
    'Fecha',
    'Estado',
    'Tipo Glosa',
    'Fecha Límite',
  ])
  detalle.getRow(1).font = { bold: true }
  for (const r of radicados) {
    detalle.addRow([
      `${r.serie.codigo}-${r.numero}`,
      r.persona?.nombre ?? '',
      r.entidad?.nombre ?? '',
      r.descripcion ?? '',
      r.creadoPor ?? '',
      r.esGap ? '' : r.fechaCreacion.toISOString().replace('T', ' ').slice(0, 16),
      estadoDe(r),
      r.tipoGlosa ?? '',
      r.fechaLimite ? r.fechaLimite.toISOString().slice(0, 10) : '',
    ])
  }
  detalle.columns.forEach((col) => (col.width = 20))

  const consecutivos = workbook.addWorksheet('Consecutivos')
  consecutivos.addRow(['Consecutivo', 'Estado', 'Persona', 'Fecha'])
  consecutivos.getRow(1).font = { bold: true }
  for (const r of radicados) {
    const row = consecutivos.addRow([
      `${r.serie.codigo}-${r.numero}`,
      estadoDe(r),
      r.persona?.nombre ?? '',
      r.esGap ? '' : r.fechaCreacion.toISOString().replace('T', ' ').slice(0, 16),
    ])
    if (r.esGap) {
      row.eachCell((cell) => {
        cell.font = { color: { argb: 'FFCC0000' } }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE0E0' },
        }
      })
    }
  }
  consecutivos.columns.forEach((col) => (col.width = 20))

  const bufferArray = await workbook.xlsx.writeBuffer()
  const buffer = Buffer.from(bufferArray)

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="informe-${mes}-${anio}.xlsx"`,
    },
  })
}
