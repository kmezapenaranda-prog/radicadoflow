'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SignUp, useSignUp } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type IntentoSignUp = Awaited<ReturnType<NonNullable<ReturnType<typeof useSignUp>['signUp']>['create']>>

function mensajeDeError(e: unknown) {
  return e && typeof e === 'object' && 'errors' in e
    ? String((e as { errors?: { message?: string }[] }).errors?.[0]?.message)
    : e instanceof Error
      ? e.message
      : 'No se pudo procesar la invitación.'
}

// Cuando alguien acepta una invitación por primera vez (cuenta nueva), Clerk
// redirige aquí con ?__clerk_ticket=... El componente <SignUp/> prearmado no
// siempre procesa ese ticket automáticamente, así que lo hacemos a mano con
// useSignUp() (patrón de "custom flow" documentado por Clerk) para asegurar
// que la persona quede conectada a la empresa que la invitó. Como la
// instancia exige contraseña, el ticket deja el sign-up en
// "missing_requirements" y hay que pedirla antes de poder completar.
export default function Page() {
  const searchParams = useSearchParams()
  const ticket = searchParams.get('__clerk_ticket')
  const router = useRouter()
  const { isLoaded, signUp, setActive } = useSignUp()
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(!!ticket)
  const [necesitaPassword, setNecesitaPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!ticket || !isLoaded || !signUp) return
    let cancelado = false

    async function manejarIntento(intento: IntentoSignUp) {
      if (cancelado) return
      if (intento.status === 'complete' && intento.createdSessionId) {
        await setActive?.({ session: intento.createdSessionId })
        if (!cancelado) router.push('/')
        return
      }
      if (intento.status === 'missing_requirements' && intento.missingFields?.includes('password')) {
        setNecesitaPassword(true)
        setProcesando(false)
        return
      }
      setError('No se pudo completar el registro con esta invitación.')
      setProcesando(false)
    }

    ;(async () => {
      try {
        const intento = await signUp!.create({ strategy: 'ticket', ticket })
        await manejarIntento(intento)
      } catch (e) {
        if (!cancelado) {
          setError(mensajeDeError(e))
          setProcesando(false)
        }
      }
    })()

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, isLoaded, signUp])

  async function completarConPassword() {
    if (!signUp || !password) return
    setEnviando(true)
    setError(null)
    try {
      const intento = await signUp.update({ password })
      if (intento.status === 'complete' && intento.createdSessionId) {
        await setActive?.({ session: intento.createdSessionId })
        router.push('/')
        return
      }
      setError('No se pudo completar el registro con esta invitación.')
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  if (ticket) {
    if (necesitaPassword) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="flex w-full max-w-sm flex-col gap-4">
            <div className="text-center">
              <h1 className="text-lg font-semibold">Crea tu contraseña</h1>
              <p className="text-sm text-muted-foreground">
                Último paso para unirte a la empresa que te invitó.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && completarConPassword()}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={completarConPassword} disabled={enviando || !password}>
              {enviando ? 'Creando cuenta…' : 'Continuar'}
            </Button>
          </div>
        </div>
      )
    }
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
      <SignUp />
    </div>
  )
}
