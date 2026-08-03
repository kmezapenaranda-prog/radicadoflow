import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, getPerfilActual, PERFILES_VALIDOS, type Perfil } from '@/lib/roles'
import { hashPassword, PASSWORD_TEMPORAL } from '@/lib/auth/password'

export const dynamic = 'force-dynamic'

// Cuenta cuántos miembros de la empresa (distintos de excluirId) tienen
// perfil admin, para no dejar una empresa sin ningún admin.
async function contarOtrosAdmins(empresaId: string, excluirId: string) {
  return prisma.usuario.count({
    where: { empresaId, perfil: 'admin', id: { not: excluirId } },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const { empresaId, userId, perfil: perfilActual } = await getPerfilActual()
    if (perfilActual !== 'admin') {
      throw new ForbiddenError('No tienes permiso para hacer esto')
    }

    const objetivo = await prisma.usuario.findUnique({ where: { id: params.userId } })
    if (!objetivo || objetivo.empresaId !== empresaId) {
      return NextResponse.json({ error: 'Esa persona no pertenece a tu empresa' }, { status: 404 })
    }

    const body = await request.json()
    const { rol, resetPassword } = body as { rol?: string; resetPassword?: boolean }

    if (resetPassword) {
      const passwordHash = await hashPassword(PASSWORD_TEMPORAL)
      await prisma.usuario.update({
        where: { id: params.userId },
        data: { passwordHash, debeCambiarPassword: true },
      })
      return NextResponse.json({ passwordTemporal: PASSWORD_TEMPORAL })
    }

    if (!rol || !PERFILES_VALIDOS.includes(rol as Perfil)) {
      return NextResponse.json({ error: 'El rol no es válido' }, { status: 400 })
    }

    if (params.userId === userId && rol !== 'admin') {
      const otrosAdmins = await contarOtrosAdmins(empresaId, userId)
      if (otrosAdmins === 0) {
        return NextResponse.json(
          { error: 'Asigna primero a otro admin antes de quitarte tu propio rol de admin.' },
          { status: 400 }
        )
      }
    }

    const actualizado = await prisma.usuario.update({
      where: { id: params.userId },
      data: { perfil: rol },
    })

    return NextResponse.json({ miembro: actualizado })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : 'No se pudo actualizar a la persona'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const { empresaId, userId, perfil: perfilActual } = await getPerfilActual()
    if (perfilActual !== 'admin') {
      throw new ForbiddenError('No tienes permiso para hacer esto')
    }

    const objetivo = await prisma.usuario.findUnique({ where: { id: params.userId } })
    if (!objetivo || objetivo.empresaId !== empresaId) {
      return NextResponse.json({ error: 'Esa persona no pertenece a tu empresa' }, { status: 404 })
    }

    if (params.userId === userId) {
      const otrosAdmins = await contarOtrosAdmins(empresaId, userId)
      if (otrosAdmins === 0) {
        return NextResponse.json(
          { error: 'Asigna primero a otro admin antes de salirte de esta empresa.' },
          { status: 400 }
        )
      }
    }

    await prisma.usuario.delete({ where: { id: params.userId } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : 'No se pudo quitar a la persona'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
