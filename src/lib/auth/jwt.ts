import { SignJWT, jwtVerify } from 'jose'

// Edge-safe (usa Web Crypto vía jose) -- no importar nunca Prisma ni bcrypt
// aquí, este módulo lo usa también src/middleware.ts que corre en Edge.

export const SESSION_COOKIE_NAME = 'radicadoflow_session'
const SESSION_DURATION = '7d'

export interface SesionClaims {
  sub: string
  empresaId: string | null
  perfil: string
  debeCambiarPassword: boolean
  esSuperAdmin: boolean
}

function getSecretKey() {
  const secret = process.env.SESSION_JWT_SECRET
  if (!secret) throw new Error('Falta la variable de entorno SESSION_JWT_SECRET')
  return new TextEncoder().encode(secret)
}

export async function firmarSesion(claims: SesionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecretKey())
}

export async function verificarSesion(token: string): Promise<SesionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (typeof payload.sub !== 'string') return null
    return {
      sub: payload.sub,
      empresaId: (payload.empresaId as string | null) ?? null,
      perfil: (payload.perfil as string) ?? 'registrador',
      debeCambiarPassword: Boolean(payload.debeCambiarPassword),
      esSuperAdmin: Boolean(payload.esSuperAdmin),
    }
  } catch {
    return null
  }
}
