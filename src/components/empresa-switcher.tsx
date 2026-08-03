'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

interface Empresa {
  id: string
  nombre: string
}

interface Props {
  mode?: 'compact' | 'full'
  onSeleccionar?: () => void
}

export function EmpresaSwitcher({ mode = 'compact', onSeleccionar }: Props) {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [esSuperAdmin, setEsSuperAdmin] = useState(false)
  const [empresaActual, setEmpresaActual] = useState<Empresa | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [creando, setCreando] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)

  async function cargar() {
    setCargando(true)
    try {
      const resConfig = await fetch('/api/configuracion')
      const dataConfig = resConfig.ok ? await resConfig.json() : null
      const superAdmin = dataConfig?.esSuperAdmin ?? false
      setEsSuperAdmin(superAdmin)
      setEmpresaActual(dataConfig?.empresa ?? null)

      if (superAdmin) {
        const resEmpresas = await fetch('/api/admin/empresas')
        const dataEmpresas = resEmpresas.ok ? await resEmpresas.json() : { empresas: [] }
        setEmpresas(dataEmpresas.empresas ?? [])
      }
    } catch {
      // silencioso -- se reintenta al recargar la página
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  async function seleccionar(empresaId: string) {
    const res = await fetch('/api/admin/empresa-activa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId }),
    })
    if (!res.ok) {
      toast.error('No se pudo cambiar de empresa')
      return
    }
    onSeleccionar?.()
  }

  async function crearEmpresa() {
    if (!nombreNuevo.trim()) return
    setCreando(true)
    try {
      const res = await fetch('/api/admin/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreNuevo.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNombreNuevo('')
      setMostrarForm(false)
      toast.success(`Empresa "${data.empresa.nombre}" creada`)
      onSeleccionar?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la empresa')
    } finally {
      setCreando(false)
    }
  }

  if (cargando) {
    return mode === 'compact' ? <div className="h-8 w-full animate-pulse rounded-lg bg-muted" /> : null
  }

  // Un usuario normal tiene una sola empresa fija -- nada que elegir.
  if (!esSuperAdmin) {
    if (mode === 'compact') {
      return (
        <div className="truncate rounded-lg px-2 py-1.5 text-sm font-medium">
          {empresaActual?.nombre ?? '—'}
        </div>
      )
    }
    return null
  }

  if (mode === 'compact') {
    return (
      <Select
        value={empresaActual?.id ?? ''}
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
              empresas.find((e) => e.id === value)?.nombre ?? 'Selecciona una empresa'
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {empresas.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              <span className="truncate">{e.nombre}</span>
            </SelectItem>
          ))}
          <SelectItem value="__nueva__">
            <span className="flex items-center gap-1.5 text-indigo-600">
              <Plus className="size-3.5" /> Crear empresa
            </span>
          </SelectItem>
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
            Todavía no has creado ninguna empresa.
          </p>
        )}
        {empresas.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex items-center justify-between gap-3 pt-4">
              <span className="font-medium">{e.nombre}</span>
              <Button size="sm" onClick={() => seleccionar(e.id)}>
                Entrar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

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
    </div>
  )
}
