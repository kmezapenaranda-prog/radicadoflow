import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError, requireEmpresaId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  }

  try {
    const empresaId = await requireEmpresaId()
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

    const { count } = await prisma.persona.updateMany({ where: { id, empresaId }, data })
    if (count === 0) {
      return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })
    }
    const persona = await prisma.persona.findUnique({ where: { id } })
    return NextResponse.json({ persona })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  }

  try {
    const empresaId = await requireEmpresaId()
    const { count } = await prisma.persona.updateMany({
      where: { id, empresaId },
      data: { activo: false },
    })
    if (count === 0) {
      return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })
    }
    const persona = await prisma.persona.findUnique({ where: { id } })
    return NextResponse.json({ persona })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}
