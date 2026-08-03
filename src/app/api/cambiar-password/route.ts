import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { obtenerUsuarioSesion, iniciarSesionComo } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const sesion = await obtenerUsuarioSesion()
  if (!sesion) {
    return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })
  }

  const body = await request.json()
  const { actual, nueva } = body as { actual?: string; nueva?: string }

  if (!actual || !nueva) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }
  if (nueva.length < 8) {
    return NextResponse.json(
      { error: 'La nueva contraseña debe tener al menos 8 caracteres' },
      { status: 400 }
    )
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: sesion.usuarioId } })
  if (!usuario) {
    return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })
  }

  const actualValida = await verifyPassword(actual, usuario.passwordHash)
  if (!actualValida) {
    return NextResponse.json({ error: 'La contraseña actual no es correcta' }, { status: 400 })
  }

  const nuevoHash = await hashPassword(nueva)
  const actualizado = await prisma.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash: nuevoHash, debeCambiarPassword: false },
  })

  await iniciarSesionComo(actualizado)

  return NextResponse.json({ ok: true })
}
