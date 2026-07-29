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

  return NextResponse.json({ configuracion, personas, personaEnTurno })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { consecutivoActual, turnoActual } = body as {
    consecutivoActual?: number
    turnoActual?: number
  }

  const data: { consecutivoActual?: number; turnoActual?: number } = {}
  if (typeof consecutivoActual === 'number') data.consecutivoActual = consecutivoActual
  if (typeof turnoActual === 'number') data.turnoActual = turnoActual

  const configuracion = await prisma.configuracion.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  })

  return NextResponse.json({ configuracion })
}
