import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { iniciarSesionComo } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

const MAX_INTENTOS = 5
const BLOQUEO_MINUTOS = 15

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, password } = body as { email?: string; password?: string }

  if (!email || !password) {
    return NextResponse.json({ error: 'Correo y contraseña son obligatorios' }, { status: 400 })
  }

  const usuario = await prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!usuario) {
    return NextResponse.json({ error: 'Correo o contraseña incorrectos' }, { status: 401 })
  }

  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
    const minutosRestantes = Math.ceil((usuario.bloqueadoHasta.getTime() - Date.now()) / 60000)
    return NextResponse.json(
      { error: `Cuenta bloqueada temporalmente. Intenta de nuevo en ${minutosRestantes} minuto(s).` },
      { status: 429 }
    )
  }

  const passwordValida = await verifyPassword(password, usuario.passwordHash)
  if (!passwordValida) {
    const intentos = usuario.intentosFallidos + 1
    const bloqueado = intentos >= MAX_INTENTOS
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        intentosFallidos: bloqueado ? 0 : intentos,
        bloqueadoHasta: bloqueado ? new Date(Date.now() + BLOQUEO_MINUTOS * 60000) : null,
      },
    })
    return NextResponse.json({ error: 'Correo o contraseña incorrectos' }, { status: 401 })
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { intentosFallidos: 0, bloqueadoHasta: null },
  })

  await iniciarSesionComo(usuario)

  return NextResponse.json({ ok: true })
}
