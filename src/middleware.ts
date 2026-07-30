import { clerkMiddleware, clerkClient, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])
const isSeleccionarEmpresaRoute = createRouteMatcher(['/seleccionar-empresa(.*)'])
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
    // Un enlace de invitación (o de "aceptar" un ticket) llega con
    // __clerk_ticket / __clerk_status en la URL. redirectToSignIn() por
    // defecto empaqueta la URL completa dentro de un solo parámetro
    // redirect_url, y el componente <SignIn/>/<SignUp/> deja de ver el
    // ticket como su propio parámetro de nivel superior -- la invitación
    // se pierde y la persona termina registrándose "suelta", sin empresa.
    // Por eso el ticket se reenvía tal cual, como parámetros de primer nivel.
    const ticket = req.nextUrl.searchParams.get('__clerk_ticket')
    if (ticket) {
      const status = req.nextUrl.searchParams.get('__clerk_status')
      const destino = status === 'sign_in' ? '/sign-in' : '/sign-up'
      const url = new URL(destino, req.url)
      url.searchParams.set('__clerk_ticket', ticket)
      if (status) url.searchParams.set('__clerk_status', status)
      return NextResponse.redirect(url)
    }
    return redirectToSignIn()
  }

  if (!orgId && !isSeleccionarEmpresaRoute(req)) {
    return NextResponse.redirect(new URL('/seleccionar-empresa', req.url))
  }

  if (orgId && isRestringidaParaRegistrador(req) && !req.nextUrl.pathname.startsWith('/api')) {
    // El perfil real se guarda en la metadata de la membresía (no es un rol
    // nativo de Clerk), así que hay que consultarlo con una llamada aparte.
    const clerk = await clerkClient()
    const { data } = await clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      userId: [userId],
      limit: 1,
    })
    const perfil = (data[0]?.publicMetadata as { perfil?: string } | undefined)?.perfil
    if (perfil === 'registrador') {
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
