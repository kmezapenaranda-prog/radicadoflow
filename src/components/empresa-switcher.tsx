'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization, useOrganizationList, useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus } from 'lucide-react'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase()

function useEsAdmin() {
  const { user } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase()
  return !!email && !!ADMIN_EMAIL && email === ADMIN_EMAIL
}

interface Props {
  mode?: 'compact' | 'full'
  onSeleccionar?: () => void
}

export function EmpresaSwitcher({ mode = 'compact', onSeleccionar }: Props) {
  const router = useRouter()
  const esAdmin = useEsAdmin()
  const { organization } = useOrganization()
  const { isLoaded, userMemberships, setActive, createOrganization } = useOrganizationList({
    userMemberships: { infinite: true },
  })
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [creando, setCreando] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [autoEntrando, setAutoEntrando] = useState(false)

  const empresas = userMemberships?.data ?? []

  async function seleccionar(orgId: string) {
    if (!setActive) return
    await setActive({ organization: orgId })
    onSeleccionar?.()
  }

  // Si la persona solo pertenece a una empresa, entra directo sin
  // preguntarle nada (evita el "¿con cuál empresa quieres trabajar?"
  // cuando en realidad no hay ninguna decisión que tomar).
  useEffect(() => {
    if (
      mode === 'full' &&
      isLoaded &&
      !organization &&
      empresas.length === 1 &&
      !autoEntrando
    ) {
      setAutoEntrando(true)
      seleccionar(empresas[0].organization.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isLoaded, organization, empresas.length])

  if (!isLoaded) return null
  if (mode === 'full' && autoEntrando) {
    return <div className="p-6 text-sm text-muted-foreground">Entrando a tu empresa…</div>
  }

  async function crearEmpresa() {
    if (!createOrganization || !nombreNuevo.trim()) return
    setCreando(true)
    try {
      const org = await createOrganization({ name: nombreNuevo.trim() })
      await setActive?.({ organization: org.id })
      setNombreNuevo('')
      setMostrarForm(false)
      toast.success(`Empresa "${org.name}" creada`)
      onSeleccionar?.()
    } catch {
      toast.error('No se pudo crear la empresa')
    } finally {
      setCreando(false)
    }
  }

  if (mode === 'compact') {
    // Evita mostrar el id crudo de la organización (org_xxx) mientras
    // useOrganization() y useOrganizationList() todavía no terminan de
    // cargar al mismo tiempo.
    const listo = isLoaded && !!organization && empresas.some((m) => m.organization.id === organization.id)
    if (!listo) {
      return <div className="h-8 w-full animate-pulse rounded-lg bg-muted" />
    }

    return (
      <Select
        value={organization.id}
        onValueChange={(v) => {
          if (v === '__nueva__') {
            router.push('/seleccionar-empresa')
            return
          }
          if (v) seleccionar(v)
        }}
      >
        <SelectTrigger className="w-full min-w-0 overflow-hidden">
          <SelectValue placeholder="Selecciona una empresa" className="min-w-0 truncate">
            {(value: string) =>
              empresas.find((m) => m.organization.id === value)?.organization.name ?? 'Selecciona una empresa'
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {empresas.map((m) => (
            <SelectItem key={m.organization.id} value={m.organization.id}>
              <span className="truncate">{m.organization.name}</span>
            </SelectItem>
          ))}
          {esAdmin && (
            <SelectItem value="__nueva__">
              <span className="flex items-center gap-1.5 text-indigo-600">
                <Plus className="size-3.5" /> Crear empresa
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Selecciona una empresa</h1>
        <p className="text-sm text-muted-foreground">
          Elige la empresa con la que quieres trabajar.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {empresas.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Todavía no perteneces a ninguna empresa.
          </p>
        )}
        {empresas.map((m) => (
          <Card key={m.organization.id}>
            <CardContent className="flex items-center justify-between gap-3 pt-4">
              <span className="font-medium">{m.organization.name}</span>
              <Button size="sm" onClick={() => seleccionar(m.organization.id)}>
                Entrar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {esAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {mostrarForm ? 'Nueva empresa' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {mostrarForm ? (
              <>
                <Input
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  placeholder="Nombre de la empresa"
                  onKeyDown={(e) => e.key === 'Enter' && crearEmpresa()}
                />
                <Button onClick={crearEmpresa} disabled={creando || !nombreNuevo.trim()}>
                  {creando && <Loader2 className="mr-1 size-4 animate-spin" />}
                  Crear empresa
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setMostrarForm(true)}>
                <Plus className="mr-1 size-4" /> Crear empresa
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
