import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  }

  try {
    const { empresaId } = await requireRole(['admin'])
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
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
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
    const { empresaId } = await requireRole(['admin'])
    const persona = await prisma.persona.findUnique({ where: { id } })
    if (!persona || persona.empresaId !== empresaId) {
      return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })
    }

    const radicadosAsignados = await prisma.radicado.count({ where: { personaId: id } })
    if (radicadosAsignados > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: tiene ${radicadosAsignados} radicado(s) asignados. Desactívala en su lugar para conservar el historial.`,
        },
        { status: 400 }
      )
    }

    await prisma.persona.delete({ where: { id } })
    return NextResponse.json({ ok: true })
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
