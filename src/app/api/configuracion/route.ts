import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const configuracion = await prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  })

  const personas = await prisma.persona.findMany({
    where: { activo: true },
    orderBy: { orden: 'asc' },
  })

  const personaEnTurno = personas.length > 0 ? personas[configuracion.turnoActual % personas.length] : null

  const series = await prisma.serie.findMany({ orderBy: { codigo: 'asc' } })

  return NextResponse.json({ configuracion, personas, personaEnTurno, series })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { turnoActual } = body as { turnoActual?: number }

  const data: { turnoActual?: number } = {}
  if (typeof turnoActual === 'number') data.turnoActual = turnoActual

  const configuracion = await prisma.configuracion.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  })

  return NextResponse.json({ configuracion })
}
