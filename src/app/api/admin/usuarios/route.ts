import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireSuperAdmin, getPerfilActual, PERFILES_VALIDOS, type Perfil } from '@/lib/roles'
import { hashPassword, PASSWORD_TEMPORAL } from '@/lib/auth/password'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin()
    const { empresaId } = await getPerfilActual()

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

    const passwordHash = await hashPassword(PASSWORD_TEMPORAL)

    await prisma.usuario.create({
      data: {
        email: email.trim().toLowerCase(),
        nombre: nombre.trim(),
        perfil,
        empresaId,
        passwordHash,
        debeCambiarPassword: true,
      },
    })

    return NextResponse.json({ email: email.trim().toLowerCase(), passwordTemporal: PASSWORD_TEMPORAL }, { status: 201 })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese correo' }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'No se pudo crear el usuario'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
