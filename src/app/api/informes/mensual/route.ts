import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { empresaId } = await requireRole(['admin', 'creador'])
    const { searchParams } = new URL(request.url)
    const mes = Number(searchParams.get('mes'))
    const anio = Number(searchParams.get('anio'))

    if (!mes || !anio) {
      return NextResponse.json({ error: 'Debe indicar mes y anio' }, { status: 400 })
    }

    const radicados = await prisma.radicado.findMany({
      where: { empresaId, mes, anio },
      include: { persona: true },
      orderBy: [{ serieId: 'asc' }, { numero: 'asc' }],
    })

    const reales = radicados.filter((r) => !r.esGap)
    const gaps = radicados.filter((r) => r.esGap)

    const porPersonaMap = new Map<number, { nombre: string; total: number; dias: Set<string> }>()
    const porDiaMap = new Map<string, number>()

    for (const r of reales) {
      if (r.persona) {
        const entry = porPersonaMap.get(r.persona.id) ?? {
          nombre: r.persona.nombre,
          total: 0,
          dias: new Set<string>(),
        }
        entry.total += 1
        entry.dias.add(r.fechaCreacion.toISOString().slice(0, 10))
        porPersonaMap.set(r.persona.id, entry)
      }

      const fecha = r.fechaCreacion.toISOString().slice(0, 10)
      porDiaMap.set(fecha, (porDiaMap.get(fecha) ?? 0) + 1)
    }

    const totalRadicados = reales.length
    const porPersona = Array.from(porPersonaMap.values())
      .map((p) => ({
        nombre: p.nombre,
        total: p.total,
        porcentaje: totalRadicados > 0 ? Number(((p.total / totalRadicados) * 100).toFixed(1)) : 0,
        diasActivos: p.dias.size,
      }))
      .sort((a, b) => b.total - a.total)

    const porDia = Array.from(porDiaMap.entries())
      .map(([fecha, total]) => ({ fecha, total }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))

    const totalPersonasActivas = await prisma.persona.count({ where: { empresaId, activo: true } })

    return NextResponse.json({
      mes,
      anio,
      totalRadicados,
      totalGaps: gaps.length,
      totalPersonasActivas,
      porPersona,
      porDia,
    })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }
}
