import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError, requireEmpresaId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const empresaId = await requireEmpresaId()

    const configuracion = await prisma.configuracion.upsert({
      where: { empresaId },
      update: {},
      create: { empresaId },
    })

    const personas = await prisma.persona.findMany({
      where: { empresaId, activo: true },
      orderBy: { orden: 'asc' },
    })

    const personaEnTurno = personas.length > 0 ? personas[configuracion.turnoActual % personas.length] : null

    const series = await prisma.serie.findMany({ where: { empresaId }, orderBy: { codigo: 'asc' } })

    return NextResponse.json({ configuracion, personas, personaEnTurno, series })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}

export async function PUT(request: NextRequest) {
  try {
    const empresaId = await requireEmpresaId()
    const body = await request.json()
    const { turnoActual } = body as { turnoActual?: number }

    const data: { turnoActual?: number } = {}
    if (typeof turnoActual === 'number') data.turnoActual = turnoActual

    const configuracion = await prisma.configuracion.upsert({
      where: { empresaId },
      update: data,
      create: { empresaId, ...data },
    })

    return NextResponse.json({ configuracion })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}
