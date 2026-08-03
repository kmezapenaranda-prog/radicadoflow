import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireSuperAdmin } from '@/lib/roles'
import { iniciarSesionComo } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireSuperAdmin()
    const body = await request.json()
    const { empresaId } = body as { empresaId?: string }

    if (!empresaId) {
      return NextResponse.json({ error: 'Falta la empresa' }, { status: 400 })
    }

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
    if (!empresa) {
      return NextResponse.json({ error: 'Esa empresa no existe' }, { status: 404 })
    }

    const usuario = await prisma.usuario.update({
      where: { id: userId },
      data: { empresaActivaId: empresaId },
    })
    await iniciarSesionComo(usuario)

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
