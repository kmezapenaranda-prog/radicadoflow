import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { empresaId } = await requireRole(['admin'])
    const clerk = await clerkClient()

    const { data } = await clerk.organizations.getOrganizationMembershipList({
      organizationId: empresaId,
      limit: 100,
    })

    return NextResponse.json({
      miembros: data.map((m) => {
        const metadata = m.publicMetadata as { perfil?: string; debeCambiarPassword?: boolean } | undefined
        return {
          id: m.id,
          userId: m.publicUserData?.userId,
          nombre: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(' ') || null,
          email: m.publicUserData?.identifier ?? null,
          perfil: metadata?.perfil ?? (m.role === 'org:admin' ? 'admin' : 'registrador'),
          debeCambiarPassword: metadata?.debeCambiarPassword ?? false,
        }
      }),
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
