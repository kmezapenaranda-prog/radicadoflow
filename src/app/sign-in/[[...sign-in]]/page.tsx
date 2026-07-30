'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SignIn, useSignIn } from '@clerk/nextjs'

// Cuando alguien acepta una invitación y ya tenía cuenta, Clerk redirige
// aquí con ?__clerk_ticket=... (y __clerk_status=sign_in). El componente
// <SignIn/> prearmado no siempre procesa ese ticket automáticamente, así
// que lo hacemos a mano con useSignIn() (patrón de "custom flow" de Clerk)
// para asegurar que la persona quede conectada a la empresa que la invitó.
export default function Page() {
  const searchParams = useSearchParams()
  const ticket = searchParams.get('__clerk_ticket')
  const router = useRouter()
  const { isLoaded, signIn, setActive } = useSignIn()
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(!!ticket)

  useEffect(() => {
    if (!ticket || !isLoaded || !signIn) return
    let cancelado = false
    ;(async () => {
      try {
        const intento = await signIn.create({ strategy: 'ticket', ticket })
        if (intento.status === 'complete' && intento.createdSessionId) {
          await setActive({ session: intento.createdSessionId })
          if (!cancelado) router.push('/')
          return
        }
        if (!cancelado) {
          setError('No se pudo completar el ingreso con esta invitación.')
          setProcesando(false)
        }
      } catch (e) {
        if (!cancelado) {
          const message =
            e && typeof e === 'object' && 'errors' in e
              ? String((e as { errors?: { message?: string }[] }).errors?.[0]?.message)
              : e instanceof Error
                ? e.message
                : 'No se pudo procesar la invitación.'
          setError(message)
          setProcesando(false)
        }
      }
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, isLoaded, signIn])

  if (ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center text-sm text-muted-foreground">
          {procesando ? 'Procesando tu invitación…' : (error ?? 'Listo.')}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <SignIn />
    </div>
  )
}
