import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { RadicadoError, registrarRadicado } from '@/lib/radicados'
import { NoEmpresaError, requireEmpresaId } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { serieCodigo, numero, descripcion, creadoPor, idExterno } = body as {
    serieCodigo?: string
    numero?: number
    descripcion?: string
    creadoPor?: string
    idExterno?: number
  }

  if (!serieCodigo || !serieCodigo.trim()) {
    return NextResponse.json({ error: 'La serie es obligatoria (ej: CUEM, CUPE, UCI)' }, { status: 400 })
  }
  if (typeof numero !== 'number') {
    return NextResponse.json({ error: 'El número de consecutivo es obligatorio' }, { status: 400 })
  }

  try {
    const { empresaId } = await requireRole(['admin', 'creador'])
    const resultado = await prisma.$transaction((tx) =>
      registrarRadicado(tx, empresaId, { serieCodigo, numero, descripcion, creadoPor, idExterno })
    )
    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof RadicadoError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Error al registrar el radicado' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const empresaId = await requireEmpresaId()
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')
    const anio = searchParams.get('anio')
    const personaId = searchParams.get('personaId')
    const serieId = searchParams.get('serieId')
    const limit = searchParams.get('limit')
    const desde = searchParams.get('desde')
    const orden = searchParams.get('orden')
    const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'

    const where: Record<string, unknown> = { empresaId }
    if (mes) where.mes = Number(mes)
    if (anio) where.anio = Number(anio)
    if (personaId) where.personaId = Number(personaId)
    if (serieId) where.serieId = Number(serieId)
    if (desde) where.fechaCreacion = { gte: new Date(desde) }

    const radicados = await prisma.radicado.findMany({
      where,
      include: { persona: true, serie: true },
      orderBy:
        orden === 'fecha'
          ? { fechaCreacion: dir }
          : [{ serieId: 'asc' }, { numero: dir }],
      take: limit ? Number(limit) : undefined,
    })

    return NextResponse.json({ radicados })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}
