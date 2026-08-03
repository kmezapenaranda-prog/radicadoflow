import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireSuperAdmin } from '@/lib/roles'
import { iniciarSesionComo } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireSuperAdmin()
    const empresas = await prisma.empresa.findMany({ orderBy: { nombre: 'asc' } })
    return NextResponse.json({ empresas })
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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireSuperAdmin()
    const body = await request.json()
    const { nombre } = body as { nombre?: string }

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const empresa = await prisma.empresa.create({ data: { nombre: nombre.trim() } })

    // Al crear una empresa, el super admin queda viéndola de una vez.
    const usuario = await prisma.usuario.update({
      where: { id: userId },
      data: { empresaActivaId: empresa.id },
    })
    await iniciarSesionComo(usuario)

    return NextResponse.json({ empresa }, { status: 201 })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : 'No se pudo crear la empresa'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
