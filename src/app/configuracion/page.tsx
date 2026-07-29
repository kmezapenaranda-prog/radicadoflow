'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'

interface Persona {
  id: number
  nombre: string
  email: string | null
  orden: number
  activo: boolean
}

interface Configuracion {
  id: number
  consecutivoActual: number
  turnoActual: number
}

export default function ConfiguracionPage() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null)
  const [personaEnTurnoId, setPersonaEnTurnoId] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)

  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [emailNuevo, setEmailNuevo] = useState('')
  const [guardandoPersona, setGuardandoPersona] = useState(false)

  const [consecutivoInicial, setConsecutivoInicial] = useState('')
  const [turnoInicialId, setTurnoInicialId] = useState<string>('')
  const [guardandoConfig, setGuardandoConfig] = useState(false)

  async function cargarDatos() {
    setCargando(true)
    try {
      const [resPersonas, resConfig] = await Promise.all([
        fetch('/api/personas'),
        fetch('/api/configuracion'),
      ])
      const dataPersonas = await resPersonas.json()
      const dataConfig = await resConfig.json()

      setPersonas(dataPersonas.personas)
      setConfiguracion(dataConfig.configuracion)
      setPersonaEnTurnoId(dataConfig.personaEnTurno?.id ?? null)
      setConsecutivoInicial(String(dataConfig.configuracion.consecutivoActual))
      setTurnoInicialId(dataConfig.personaEnTurno ? String(dataConfig.personaEnTurno.id) : '')
    } catch {
      toast.error('No se pudo cargar la configuración')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const personasActivasOrdenadas = personas
    .filter((p) => p.activo)
    .sort((a, b) => a.orden - b.orden)

  async function agregarPersona() {
    if (!nombreNuevo.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }
    setGuardandoPersona(true)
    try {
      const res = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreNuevo, email: emailNuevo || undefined }),
      })
      if (!res.ok) throw new Error()
      toast.success('Persona agregada')
      setNombreNuevo('')
      setEmailNuevo('')
      setDialogAbierto(false)
      await cargarDatos()
    } catch {
      toast.error('No se pudo agregar la persona')
    } finally {
      setGuardandoPersona(false)
    }
  }

  async function toggleActivo(persona: Persona) {
    if (persona.activo && !confirm(`¿Desactivar a ${persona.nombre}? No recibirá más turnos.`)) {
      return
    }
    try {
      const res = await fetch(`/api/personas/${persona.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !persona.activo }),
      })
      if (!res.ok) throw new Error()
      toast.success(persona.activo ? 'Persona desactivada' : 'Persona activada')
      await cargarDatos()
    } catch {
      toast.error('No se pudo actualizar la persona')
    }
  }

  async function moverOrden(persona: Persona, direccion: 'arriba' | 'abajo') {
    const ordenadas = [...personas].sort((a, b) => a.orden - b.orden)
    const index = ordenadas.findIndex((p) => p.id === persona.id)
    const destino = direccion === 'arriba' ? index - 1 : index + 1
    if (destino < 0 || destino >= ordenadas.length) return

    const vecino = ordenadas[destino]
    try {
      await Promise.all([
        fetch(`/api/personas/${persona.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orden: vecino.orden }),
        }),
        fetch(`/api/personas/${vecino.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orden: persona.orden }),
        }),
      ])
      await cargarDatos()
    } catch {
      toast.error('No se pudo reordenar')
    }
  }

  async function guardarConfiguracionConsecutivos() {
    const consecutivo = Number(consecutivoInicial)
    if (!Number.isInteger(consecutivo) || consecutivo < 0) {
      toast.error('El consecutivo inicial debe ser un número entero válido')
      return
    }
    if (
      !confirm(
        'Vas a cambiar el consecutivo y/o el turno inicial. Esto puede afectar la asignación de próximos radicados. ¿Continuar?'
      )
    ) {
      return
    }

    setGuardandoConfig(true)
    try {
      const turnoActual = turnoInicialId
        ? personasActivasOrdenadas.findIndex((p) => p.id === Number(turnoInicialId))
        : configuracion?.turnoActual ?? 0

      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consecutivoActual: consecutivo,
          turnoActual: turnoActual >= 0 ? turnoActual : 0,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Configuración actualizada')
      await cargarDatos()
    } catch {
      toast.error('No se pudo actualizar la configuración')
    } finally {
      setGuardandoConfig(false)
    }
  }

  async function reiniciarTurno() {
    if (!confirm('¿Reiniciar el turno? La rotación volverá a empezar desde la primera persona activa.')) {
      return
    }
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnoActual: 0 }),
      })
      if (!res.ok) throw new Error()
      toast.success('Turno reiniciado')
      await cargarDatos()
    } catch {
      toast.error('No se pudo reiniciar el turno')
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona el equipo y la rotación de turnos para la asignación de radicados.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Personas del equipo</CardTitle>
            <CardDescription>Orden de rotación circular para asignar radicados</CardDescription>
          </div>
          <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus className="mr-1 size-4" /> Agregar persona
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agregar persona</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={nombreNuevo}
                    onChange={(e) => setNombreNuevo(e.target.value)}
                    placeholder="Ej: Ana Martínez"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email (opcional)</Label>
                  <Input
                    id="email"
                    value={emailNuevo}
                    onChange={(e) => setEmailNuevo(e.target.value)}
                    placeholder="ana@empresa.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={agregarPersona} disabled={guardandoPersona}>
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Orden</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Turno actual</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!cargando && personas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aún no hay personas configuradas
                  </TableCell>
                </TableRow>
              )}
              {[...personas]
                .sort((a, b) => a.orden - b.orden)
                .map((persona) => (
                  <TableRow key={persona.id}>
                    <TableCell>{persona.orden}</TableCell>
                    <TableCell className="font-medium">{persona.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{persona.email || '—'}</TableCell>
                    <TableCell>
                      {persona.id === personaEnTurnoId && (
                        <Badge className="bg-indigo-600 text-white hover:bg-indigo-600">
                          Le toca ahora
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={persona.activo ? 'default' : 'secondary'}>
                        {persona.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moverOrden(persona, 'arriba')}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moverOrden(persona, 'abajo')}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActivo(persona)}
                      >
                        {persona.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consecutivos y turno</CardTitle>
          <CardDescription>
            Úsalo para inicializar el sistema o para corregir el consecutivo tras importar un histórico.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="consecutivoInicial">Consecutivo inicial</Label>
              <Input
                id="consecutivoInicial"
                type="number"
                value={consecutivoInicial}
                onChange={(e) => setConsecutivoInicial(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Turno inicial (quién empieza)</Label>
              <Select value={turnoInicialId} onValueChange={(value) => setTurnoInicialId(value ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona una persona" />
                </SelectTrigger>
                <SelectContent>
                  {personasActivasOrdenadas.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            ⚠️ Cambiar estos valores afecta directamente a quién se le asignará el próximo radicado.
            Verifica antes de guardar.
          </div>

          <div className="flex gap-2">
            <Button onClick={guardarConfiguracionConsecutivos} disabled={guardandoConfig}>
              Guardar cambios
            </Button>
            <Button variant="outline" onClick={reiniciarTurno}>
              Reiniciar turno
            </Button>
          </div>

          <Separator />
          <p className="text-xs text-muted-foreground">
            Consecutivo actual registrado: <strong>{configuracion?.consecutivoActual ?? 0}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
