import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError, requireEmpresaId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const empresaId = await requireEmpresaId()
    const personas = await prisma.persona.findMany({
      where: { empresaId },
      orderBy: { orden: 'asc' },
    })
    return NextResponse.json({ personas })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const empresaId = await requireEmpresaId()
    const body = await request.json()
    const { nombre, email } = body as { nombre?: string; email?: string }

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const maxOrden = await prisma.persona.aggregate({
      where: { empresaId },
      _max: { orden: true },
    })
    const orden = (maxOrden._max.orden ?? 0) + 1

    const persona = await prisma.persona.create({
      data: { empresaId, nombre: nombre.trim(), email: email?.trim() || null, orden },
    })

    return NextResponse.json({ persona }, { status: 201 })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}
