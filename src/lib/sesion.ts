import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE_NAME, firmarSesion, verificarSesion, type SesionClaims } from '@/lib/auth/jwt'

export interface UsuarioSesion {
  usuarioId: string
  email: string
  nombre: string
  empresaId: string | null
  perfil: string
  esSuperAdmin: boolean
  debeCambiarPassword: boolean
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 días, igual que la duración del JWT

function resolverClaims(usuario: {
  id: string
  esSuperAdmin: boolean
  empresaId: string | null
  empresaActivaId: string | null
  perfil: string
  debeCambiarPassword: boolean
}): SesionClaims {
  return {
    sub: usuario.id,
    empresaId: usuario.esSuperAdmin ? usuario.empresaActivaId : usuario.empresaId,
    perfil: usuario.esSuperAdmin ? 'admin' : usuario.perfil,
    debeCambiarPassword: usuario.debeCambiarPassword,
    esSuperAdmin: usuario.esSuperAdmin,
  }
}

function claimsIguales(a: SesionClaims, b: SesionClaims) {
  return (
    a.empresaId === b.empresaId &&
    a.perfil === b.perfil &&
    a.debeCambiarPassword === b.debeCambiarPassword &&
    a.esSuperAdmin === b.esSuperAdmin
  )
}

// Lee la cookie de sesión, verifica el JWT y consulta la fila Usuario en
// Postgres (siempre fresca -- nunca se autoriza confiando solo en el JWT).
// Si lo que dice la cookie quedó desactualizado (ej: un admin le cambió el
// rol a esta persona mientras tenía sesión abierta), se reemite corregida
// en el momento -- por eso solo se puede llamar desde Route Handlers/Server
// Actions (cookies().set() no funciona dentro de un Server Component).
export async function obtenerUsuarioSesion(): Promise<UsuarioSesion | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const claims = await verificarSesion(token)
  if (!claims) return null

  const usuario = await prisma.usuario.findUnique({ where: { id: claims.sub } })
  if (!usuario) return null

  const claimsFrescos = resolverClaims(usuario)
  if (!claimsIguales(claims, claimsFrescos)) {
    await establecerCookieSesion(claimsFrescos)
  }

  return {
    usuarioId: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    empresaId: claimsFrescos.empresaId,
    perfil: claimsFrescos.perfil,
    esSuperAdmin: usuario.esSuperAdmin,
    debeCambiarPassword: usuario.debeCambiarPassword,
  }
}

export async function establecerCookieSesion(claims: SesionClaims) {
  const token = await firmarSesion(claims)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}

// Para usar tras crear/actualizar un Usuario (login, cambiar contraseña,
// cambiar empresa activa) -- resuelve los claims correctos y firma la cookie.
export async function iniciarSesionComo(usuario: {
  id: string
  esSuperAdmin: boolean
  empresaId: string | null
  empresaActivaId: string | null
  perfil: string
  debeCambiarPassword: boolean
}) {
  await establecerCookieSesion(resolverClaims(usuario))
}
