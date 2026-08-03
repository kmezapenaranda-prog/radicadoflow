import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, verificarSesion } from '@/lib/auth/jwt'

const RUTAS_PUBLICAS = ['/sign-in', '/sign-up', '/api/auth/login', '/api/auth/logout']

function empiezaCon(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(base + '/')
}

function esRutaPublica(pathname: string) {
  return RUTAS_PUBLICAS.some((r) => empiezaCon(pathname, r))
}

// El perfil "registrador" solo puede ver /consecutivos; el resto de páginas
// (no las rutas de API, esas se validan por endpoint) lo redirigen ahí.
function esRutaRestringidaParaRegistrador(pathname: string) {
  if (pathname === '/') return true
  return ['/registrar', '/informes', '/configuracion'].some((r) => empiezaCon(pathname, r))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (esRutaPublica(pathname)) return NextResponse.next()

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  const claims = token ? await verificarSesion(token) : null

  if (!claims) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  // El cambio de contraseña obligatorio va primero -- ni siquiera dejamos
  // elegir/crear empresa con la contraseña temporal todavía puesta.
  if (!pathname.startsWith('/api')) {
    if (claims.debeCambiarPassword && !empiezaCon(pathname, '/cambiar-password')) {
      return NextResponse.redirect(new URL('/cambiar-password', req.url))
    }
    if (!claims.debeCambiarPassword && empiezaCon(pathname, '/cambiar-password')) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  if (!pathname.startsWith('/api')) {
    if (
      !claims.debeCambiarPassword &&
      !claims.empresaId &&
      !empiezaCon(pathname, '/seleccionar-empresa')
    ) {
      return NextResponse.redirect(new URL('/seleccionar-empresa', req.url))
    }
    if (
      !claims.debeCambiarPassword &&
      claims.perfil === 'registrador' &&
      esRutaRestringidaParaRegistrador(pathname)
    ) {
      return NextResponse.redirect(new URL('/consecutivos', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
