import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireSuperAdmin, PERFILES_VALIDOS, type Perfil } from '@/lib/roles'

export const dynamic = 'force-dynamic'

// Contraseña temporal compartida: el dueño del sistema crea la cuenta con
// esta clave y la persona la cambia obligatoriamente en su primer ingreso
// (ver /cambiar-password y el chequeo en middleware.ts). skipPasswordChecks
// evita que Clerk la rechace por ser igual para todos (fuerza/HIBP).
const PASSWORD_TEMPORAL = process.env.PASSWORD_TEMPORAL_GENERICA || 'Radicado#Temporal2026'

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin()
    const { orgId } = await auth()
    if (!orgId) {
      throw new NoEmpresaError('Selecciona primero la empresa a la que vas a agregar la persona')
    }

    const body = await request.json()
    const { nombre, email, perfil } = body as { nombre?: string; email?: string; perfil?: string }

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }
    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'El correo es obligatorio' }, { status: 400 })
    }
    if (!perfil || !PERFILES_VALIDOS.includes(perfil as Perfil)) {
      return NextResponse.json({ error: 'El rol no es válido' }, { status: 400 })
    }

    const clerk = await clerkClient()
    const nuevoUsuario = await clerk.users.createUser({
      emailAddress: [email.trim()],
      password: PASSWORD_TEMPORAL,
      skipPasswordChecks: true,
      firstName: nombre.trim(),
    })

    await clerk.organizations.createOrganizationMembership({
      organizationId: orgId,
      userId: nuevoUsuario.id,
      role: perfil === 'admin' ? 'org:admin' : 'org:member',
    })
    await clerk.organizations.updateOrganizationMembershipMetadata({
      organizationId: orgId,
      userId: nuevoUsuario.id,
      publicMetadata: { perfil, debeCambiarPassword: true },
    })

    return NextResponse.json({ email: email.trim(), passwordTemporal: PASSWORD_TEMPORAL }, { status: 201 })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message =
      error && typeof error === 'object' && 'errors' in error
        ? String((error as { errors?: { message?: string }[] }).errors?.[0]?.message)
        : error instanceof Error
          ? error.message
          : 'No se pudo crear el usuario'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
