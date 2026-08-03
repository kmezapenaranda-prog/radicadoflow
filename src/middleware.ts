import { clerkMiddleware, clerkClient, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])
const isSeleccionarEmpresaRoute = createRouteMatcher(['/seleccionar-empresa(.*)'])
const isCambiarPasswordRoute = createRouteMatcher(['/cambiar-password(.*)'])
// El perfil "registrador" solo puede ver /consecutivos; el resto de páginas
// (no las rutas de API, esas se validan por endpoint) lo redirigen ahí.
const isRestringidaParaRegistrador = createRouteMatcher([
  '/',
  '/registrar(.*)',
  '/informes(.*)',
  '/configuracion(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  const { userId, orgId, redirectToSignIn } = await auth()
  if (!userId) {
    return redirectToSignIn()
  }

  if (!orgId && !isSeleccionarEmpresaRoute(req)) {
    return NextResponse.redirect(new URL('/seleccionar-empresa', req.url))
  }

  if (orgId && !req.nextUrl.pathname.startsWith('/api')) {
    // El perfil real y el flag de "debe cambiar contraseña" se guardan en la
    // metadata de la membresía (no son nativos de Clerk), así que hay que
    // consultarlos con una llamada aparte.
    const clerk = await clerkClient()
    const { data } = await clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      userId: [userId],
      limit: 1,
    })
    const metadata = data[0]?.publicMetadata as
      | { perfil?: string; debeCambiarPassword?: boolean }
      | undefined

    if (metadata?.debeCambiarPassword && !isCambiarPasswordRoute(req)) {
      return NextResponse.redirect(new URL('/cambiar-password', req.url))
    }
    if (!metadata?.debeCambiarPassword && isCambiarPasswordRoute(req)) {
      return NextResponse.redirect(new URL('/', req.url))
    }
    if (
      !metadata?.debeCambiarPassword &&
      metadata?.perfil === 'registrador' &&
      isRestringidaParaRegistrador(req)
    ) {
      return NextResponse.redirect(new URL('/consecutivos', req.url))
    }
  }
})

export const config = {
  matcher: [
    '/((?!_next|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
