'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Page() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function iniciarSesion() {
    if (!email.trim() || !password) {
      toast.error('Correo y contraseña son obligatorios')
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.assign('/')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo iniciar sesión')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <p className="num-folio mb-2 text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground">
            Acceso al registro
          </p>
          <h1 className="text-xl font-semibold tracking-tight">RadicadoFlow</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inicia sesión con tu cuenta.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && iniciarSesion()}
          />
        </div>
        <Button onClick={iniciarSesion} disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </div>
    </div>
  )
}
