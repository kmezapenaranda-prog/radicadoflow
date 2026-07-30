import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

const PERFILES_VALIDOS = ['admin', 'creador', 'registrador']

export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const { empresaId } = await requireRole(['admin'])
    const { userId } = await auth()
    const body = await request.json()
    const { rol } = body as { rol?: string }

    if (!rol || !PERFILES_VALIDOS.includes(rol)) {
      return NextResponse.json({ error: 'El rol no es válido' }, { status: 400 })
    }
    if (params.userId === userId && rol !== 'admin') {
      return NextResponse.json(
        { error: 'No puedes quitarte a ti mismo el rol de admin. Pídele a otro admin que lo haga.' },
        { status: 400 }
      )
    }

    const clerk = await clerkClient()
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

    if (params.userId === userId) {
      return NextResponse.json({ error: 'No puedes quitarte a ti mismo del equipo' }, { status: 400 })
    }

    const clerk = await clerkClient()
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
