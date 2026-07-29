import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { RadicadoError, registrarRadicado } from '@/lib/radicados'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { consecutivo, descripcion, creadoPor } = body as {
    consecutivo?: number
    descripcion?: string
    creadoPor?: string
  }

  if (typeof consecutivo !== 'number') {
    return NextResponse.json({ error: 'El consecutivo es obligatorio' }, { status: 400 })
  }

  try {
    const resultado = await prisma.$transaction((tx) =>
      registrarRadicado(tx, { consecutivo, descripcion, creadoPor })
    )
    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    if (error instanceof RadicadoError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Error al registrar el radicado' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')
  const personaId = searchParams.get('personaId')
  const limit = searchParams.get('limit')
  const desde = searchParams.get('desde')
  const orden = searchParams.get('orden')

  const where: Record<string, unknown> = {}
  if (mes) where.mes = Number(mes)
  if (anio) where.anio = Number(anio)
  if (personaId) where.personaId = Number(personaId)
  if (desde) where.fechaCreacion = { gte: new Date(desde) }

  const radicados = await prisma.radicado.findMany({
    where,
    include: { persona: true },
    orderBy: orden === 'fecha' ? { fechaCreacion: 'desc' } : { consecutivo: 'desc' },
    take: limit ? Number(limit) : undefined,
  })

  return NextResponse.json({ radicados })
}
