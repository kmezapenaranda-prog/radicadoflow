'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function CambiarPasswordPage() {
  const { user } = useUser()
  const router = useRouter()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!user) return
    if (nueva.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres')
      return
    }
    if (nueva !== confirmar) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setGuardando(true)
    try {
      await user.updatePassword({ currentPassword: actual, newPassword: nueva })
      const res = await fetch('/api/cambiar-password', { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success('Contraseña actualizada')
      window.location.assign('/')
    } catch (e) {
      const mensaje =
        e && typeof e === 'object' && 'errors' in e
          ? String((e as { errors?: { message?: string }[] }).errors?.[0]?.message)
          : e instanceof Error
            ? e.message
            : 'No se pudo cambiar la contraseña'
      toast.error(mensaje)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold">Cambia tu contraseña</h1>
          <p className="text-sm text-muted-foreground">
            Es tu primer ingreso. Define una contraseña propia antes de continuar.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="actual">Contraseña temporal</Label>
          <Input id="actual" type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nueva">Nueva contraseña</Label>
          <Input id="nueva" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmar">Confirmar nueva contraseña</Label>
          <Input
            id="confirmar"
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guardar()}
          />
        </div>
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Cambiar contraseña'}
        </Button>
      </div>
    </div>
  )
}
