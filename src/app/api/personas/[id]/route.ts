import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  }

  const body = await request.json()
  const { nombre, email, activo, orden } = body as {
    nombre?: string
    email?: string | null
    activo?: boolean
    orden?: number
  }

  const data: Record<string, unknown> = {}
  if (typeof nombre === 'string') data.nombre = nombre.trim()
  if (email !== undefined) data.email = email?.trim() || null
  if (typeof activo === 'boolean') data.activo = activo
  if (typeof orden === 'number') data.orden = orden

  try {
    const persona = await prisma.persona.update({ where: { id }, data })
    return NextResponse.json({ persona })
  } catch {
    return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  }

  try {
    const persona = await prisma.persona.update({ where: { id }, data: { activo: false } })
    return NextResponse.json({ persona })
  } catch {
    return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })
  }
}
