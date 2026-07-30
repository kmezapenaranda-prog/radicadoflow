import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { empresaId } = await requireRole(['admin'])
    const clerk = await clerkClient()

    const [miembros, invitaciones] = await Promise.all([
      clerk.organizations.getOrganizationMembershipList({ organizationId: empresaId, limit: 100 }),
      clerk.organizations.getOrganizationInvitationList({
        organizationId: empresaId,
        status: ['pending'],
        limit: 100,
      }),
    ])

    return NextResponse.json({
      miembros: miembros.data.map((m) => {
        const metadataPerfil = (m.publicMetadata as { perfil?: string } | undefined)?.perfil
        return {
          id: m.id,
          userId: m.publicUserData?.userId,
          nombre: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(' ') || null,
          email: m.publicUserData?.identifier ?? null,
          perfil: metadataPerfil ?? (m.role === 'org:admin' ? 'admin' : 'registrador'),
        }
      }),
      invitaciones: invitaciones.data.map((i) => ({
        id: i.id,
        email: i.emailAddress,
        url: i.url,
      })),
    })
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
    const { empresaId } = await requireRole(['admin'])
    const { userId } = await auth()
    const body = await request.json()
    const { email } = body as { email?: string }

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'El correo es obligatorio' }, { status: 400 })
    }

    // Todos entran como "org:member" nativo de Clerk; el perfil real
    // (registrador/creador/admin) se asigna después, una vez acepten,
    // desde la tabla de miembros (ver PATCH /api/miembros/[userId]).
    const clerk = await clerkClient()
    const invitacion = await clerk.organizations.createOrganizationInvitation({
      organizationId: empresaId,
      inviterUserId: userId!,
      emailAddress: email.trim(),
      role: 'org:member',
      redirectUrl: new URL(request.url).origin,
    })

    return NextResponse.json({ invitacion }, { status: 201 })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : 'No se pudo invitar a la persona'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
