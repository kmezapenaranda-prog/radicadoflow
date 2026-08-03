import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })
  if (!orgId) {
    return NextResponse.json({ error: 'No hay una empresa activa seleccionada' }, { status: 401 })
  }

  const clerk = await clerkClient()
  await clerk.organizations.updateOrganizationMembershipMetadata({
    organizationId: orgId,
    userId,
    publicMetadata: { debeCambiarPassword: false },
  })

  return NextResponse.json({ ok: true })
}
