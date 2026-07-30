import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

const PERFILES_VALIDOS = ['admin', 'creador', 'registrador']

// Cuenta cuántos miembros de la empresa (distintos de excluirUserId) tienen
// perfil admin, para no dejar una empresa sin ningún admin.
async function contarOtrosAdmins(
  clerk: Awaited<ReturnType<typeof clerkClient>>,
  empresaId: string,
  excluirUserId: string
) {
  const { data } = await clerk.organizations.getOrganizationMembershipList({
    organizationId: empresaId,
    limit: 100,
  })
  return data.filter((m) => {
    if (m.publicUserData?.userId === excluirUserId) return false
    const perfil = (m.publicMetadata as { perfil?: string } | undefined)?.perfil
    return (perfil ?? (m.role === 'org:admin' ? 'admin' : 'registrador')) === 'admin'
  }).length
}

export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const { empresaId } = await requireRole(['admin'])
    const { userId } = await auth()
    const body = await request.json()
    const { rol } = body as { rol?: string }

    if (!rol || !PERFILES_VALIDOS.includes(rol)) {
      return NextResponse.json({ error: 'El rol no es válido' }, { status: 400 })
    }

    const clerk = await clerkClient()

    if (params.userId === userId && rol !== 'admin') {
      const otrosAdmins = await contarOtrosAdmins(clerk, empresaId, userId)
      if (otrosAdmins === 0) {
        return NextResponse.json(
          { error: 'Asigna primero a otro admin antes de quitarte tu propio rol de admin.' },
          { status: 400 }
        )
      }
    }

    // El perfil real (registrador/creador/admin) se guarda como metadata
    // propia, no como rol nativo de Clerk (los roles personalizados de
    // Clerk requieren un complemento de pago). El rol nativo solo se
    // sincroniza a "org:admin"/"org:member" porque Clerk exige org:admin
    // nativo para poder invitar e gestionar miembros.
    await clerk.organizations.updateOrganizationMembership({
      organizationId: empresaId,
      userId: params.userId,
      role: rol === 'admin' ? 'org:admin' : 'org:member',
    })
    const membresia = await clerk.organizations.updateOrganizationMembershipMetadata({
      organizationId: empresaId,
      userId: params.userId,
      publicMetadata: { perfil: rol },
    })

    return NextResponse.json({ membresia })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : 'No se pudo cambiar el rol'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const { empresaId } = await requireRole(['admin'])
    const { userId } = await auth()
    const clerk = await clerkClient()

    if (params.userId === userId) {
      const otrosAdmins = await contarOtrosAdmins(clerk, empresaId, userId!)
      if (otrosAdmins === 0) {
        return NextResponse.json(
          { error: 'Asigna primero a otro admin antes de salirte de esta empresa.' },
          { status: 400 }
        )
      }
    }

    await clerk.organizations.deleteOrganizationMembership({
      organizationId: empresaId,
      userId: params.userId,
    })

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
