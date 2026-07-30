import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])
const isSeleccionarEmpresaRoute = createRouteMatcher(['/seleccionar-empresa(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  const { userId, orgId, redirectToSignIn } = await auth()
  if (!userId) return redirectToSignIn()

  if (!orgId && !isSeleccionarEmpresaRoute(req)) {
    return NextResponse.redirect(new URL('/seleccionar-empresa', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
