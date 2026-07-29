import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const personas = await prisma.persona.findMany({
    orderBy: { orden: 'asc' },
  })
  return NextResponse.json({ personas })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { nombre, email } = body as { nombre?: string; email?: string }

  if (!nombre || !nombre.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  }

  const maxOrden = await prisma.persona.aggregate({ _max: { orden: true } })
  const orden = (maxOrden._max.orden ?? 0) + 1

  const persona = await prisma.persona.create({
    data: { nombre: nombre.trim(), email: email?.trim() || null, orden },
  })

  return NextResponse.json({ persona }, { status: 201 })
}
