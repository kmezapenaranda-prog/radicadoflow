import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function DELETE(_request: NextRequest, { params }: { params: { invitationId: string } }) {
  try {
    const { empresaId } = await requireRole(['admin'])
    const { userId } = await auth()
    const clerk = await clerkClient()

    await clerk.organizations.revokeOrganizationInvitation({
      organizationId: empresaId,
      invitationId: params.invitationId,
      requestingUserId: userId!,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : 'No se pudo revocar la invitación'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
