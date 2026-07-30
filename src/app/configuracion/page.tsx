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
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'

const ROLES_EQUIPO = [
  { value: 'admin', label: 'Admin de la empresa' },
  { value: 'creador', label: 'Creador de radicados' },
  { value: 'registrador', label: 'Registrador (solo Consecutivos)' },
]
const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLES_EQUIPO.map((r) => [r.value, r.label])
)

interface Miembro {
  id: string
  userId?: string
  nombre: string | null
  email: string | null
  perfil: string
}

interface Invitacion {
  id: string
  email: string
}

interface Persona {
  id: number
  nombre: string
  email: string | null
  orden: number
  activo: boolean
}

interface Configuracion {
  id: number
  turnoActual: number
}

interface Serie {
  id: number
  codigo: string
  distribuible: boolean
  consecutivoActual: number
}

export default function ConfiguracionPage() {
  const [perfil, setPerfil] = useState<string | null>(null)
  const esAdmin = perfil === 'admin'

  const [personas, setPersonas] = useState<Persona[]>([])
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null)
  const [personaEnTurnoId, setPersonaEnTurnoId] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)

  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [emailNuevo, setEmailNuevo] = useState('')
  const [guardandoPersona, setGuardandoPersona] = useState(false)

  const [turnoInicialId, setTurnoInicialId] = useState<string>('')
  const [guardandoConfig, setGuardandoConfig] = useState(false)

  const [series, setSeries] = useState<Serie[]>([])
  const [edicionesConsecutivo, setEdicionesConsecutivo] = useState<Record<number, string>>({})

  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [cargandoMiembros, setCargandoMiembros] = useState(true)
  const [dialogMiembroAbierto, setDialogMiembroAbierto] = useState(false)
  const [emailInvitar, setEmailInvitar] = useState('')
  const [invitando, setInvitando] = useState(false)

  async function cargarMiembros() {
    setCargandoMiembros(true)
    try {
      const res = await fetch('/api/miembros')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMiembros(data.miembros ?? [])
      setInvitaciones(data.invitaciones ?? [])
    } catch {
      toast.error('No se pudo cargar el equipo')
    } finally {
      setCargandoMiembros(false)
    }
  }

  useEffect(() => {
    if (esAdmin) cargarMiembros()
  }, [esAdmin])

  async function invitarMiembro() {
    if (!emailInvitar.trim()) {
      toast.error('El correo es obligatorio')
      return
    }
    setInvitando(true)
    try {
      const res = await fetch('/api/miembros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInvitar.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Invitación enviada a ${emailInvitar.trim()}`)
      setEmailInvitar('')
      setDialogMiembroAbierto(false)
      await cargarMiembros()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar la invitación')
    } finally {
      setInvitando(false)
    }
  }

  async function revocarInvitacion(invitacion: Invitacion) {
    if (!confirm(`¿Revocar la invitación a ${invitacion.email}?`)) return
    try {
      const res = await fetch(`/api/miembros/invitaciones/${invitacion.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Invitación revocada')
      await cargarMiembros()
    } catch {
      toast.error('No se pudo revocar la invitación')
    }
  }

  async function cambiarRolMiembro(miembro: Miembro, rol: string) {
    if (!miembro.userId) return
    try {
      const res = await fetch(`/api/miembros/${miembro.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol }),
      })
      if (!res.ok) throw new Error()
      toast.success('Rol actualizado')
      await cargarMiembros()
    } catch {
      toast.error('No se pudo cambiar el rol')
    }
  }

  async function quitarMiembro(miembro: Miembro) {
    if (!miembro.userId) return
    if (!confirm(`¿Quitar a ${miembro.nombre || miembro.email} del equipo?`)) return
    try {
      const res = await fetch(`/api/miembros/${miembro.userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Miembro removido')
      await cargarMiembros()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo quitar al miembro')
    }
  }

  async function cargarDatos() {
    setCargando(true)
    try {
      const [resPersonas, resConfig] = await Promise.all([
        fetch('/api/personas'),
        fetch('/api/configuracion'),
      ])
      const dataPersonas = await resPersonas.json()
      const dataConfig = await resConfig.json()

      setPerfil(dataConfig.perfil ?? null)
      setPersonas(dataPersonas.personas)
      setConfiguracion(dataConfig.configuracion)
      setPersonaEnTurnoId(dataConfig.personaEnTurno?.id ?? null)
      setTurnoInicialId(dataConfig.personaEnTurno ? String(dataConfig.personaEnTurno.id) : '')
      setSeries(dataConfig.series ?? [])
      setEdicionesConsecutivo(
        Object.fromEntries((dataConfig.series ?? []).map((s: Serie) => [s.id, String(s.consecutivoActual)]))
      )
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

  async function guardarTurnoInicial() {
    if (
      !confirm(
        'Vas a cambiar el turno inicial. Esto afecta a quién se le asignará el próximo radicado. ¿Continuar?'
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
        body: JSON.stringify({ turnoActual: turnoActual >= 0 ? turnoActual : 0 }),
      })
      if (!res.ok) throw new Error()
      toast.success('Turno inicial actualizado')
      await cargarDatos()
    } catch {
      toast.error('No se pudo actualizar el turno')
    } finally {
      setGuardandoConfig(false)
    }
  }

  async function toggleDistribuible(serie: Serie) {
    const mensaje = serie.distribuible
      ? `¿Dejar de repartir la serie ${serie.codigo} a los trabajadores? Sus radicados quedarán registrados sin asignar.`
      : `¿Volver a repartir la serie ${serie.codigo} a los trabajadores?`
    if (!confirm(mensaje)) return

    try {
      const res = await fetch(`/api/series/${serie.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distribuible: !serie.distribuible }),
      })
      if (!res.ok) throw new Error()
      toast.success('Serie actualizada')
      await cargarDatos()
    } catch {
      toast.error('No se pudo actualizar la serie')
    }
  }

  async function guardarConsecutivoSerie(serie: Serie) {
    const valor = Number(edicionesConsecutivo[serie.id])
    if (!Number.isInteger(valor) || valor < 0) {
      toast.error('El consecutivo debe ser un número entero válido')
      return
    }
    if (
      !confirm(
        `¿Cambiar el consecutivo actual de ${serie.codigo} a ${valor}? Esto afecta la detección de gaps futuros.`
      )
    ) {
      return
    }
    try {
      const res = await fetch(`/api/series/${serie.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consecutivoActual: valor }),
      })
      if (!res.ok) throw new Error()
      toast.success('Consecutivo actualizado')
      await cargarDatos()
    } catch {
      toast.error('No se pudo actualizar el consecutivo')
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

      {esAdmin && (
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
      )}

      {esAdmin && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Miembros del equipo</CardTitle>
            <CardDescription>
              Invita gente por correo y controla qué puede ver o hacer cada quien.
            </CardDescription>
          </div>
          <Dialog open={dialogMiembroAbierto} onOpenChange={setDialogMiembroAbierto}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus className="mr-1 size-4" /> Invitar
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invitar miembro</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="emailInvitar">Correo</Label>
                  <Input
                    id="emailInvitar"
                    value={emailInvitar}
                    onChange={(e) => setEmailInvitar(e.target.value)}
                    placeholder="persona@empresa.com"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Cuando acepte la invitación, asígnale su rol en la tabla de abajo.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={invitarMiembro} disabled={invitando}>
                  Enviar invitación
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!cargandoMiembros && miembros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aún no hay miembros invitados
                  </TableCell>
                </TableRow>
              )}
              {miembros.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nombre || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email || '—'}</TableCell>
                  <TableCell>
                    <Select value={m.perfil} onValueChange={(v) => v && cambiarRolMiembro(m, v)}>
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Rol">
                          {(value: string) => ROLE_LABELS[value] ?? value}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES_EQUIPO.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => quitarMiembro(m)}>
                      <X className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {invitaciones.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Invitaciones pendientes</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Correo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitaciones.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.email}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => revocarInvitacion(inv)}>
                          Revocar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Turno</CardTitle>
          <CardDescription>
            Define quién empieza la rotación o reinícala desde la primera persona activa.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <Label>Turno inicial (quién empieza)</Label>
            <Select value={turnoInicialId} onValueChange={(value) => setTurnoInicialId(value ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una persona">
                  {(value: string) =>
                    personasActivasOrdenadas.find((p) => String(p.id) === value)?.nombre ??
                    'Selecciona una persona'
                  }
                </SelectValue>
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

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            ⚠️ Cambiar el turno afecta directamente a quién se le asignará el próximo radicado.
          </div>

          <div className="flex gap-2">
            <Button onClick={guardarTurnoInicial} disabled={guardandoConfig}>
              Guardar turno inicial
            </Button>
            <Button variant="outline" onClick={reiniciarTurno}>
              Reiniciar turno
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Series de consecutivos</CardTitle>
          <CardDescription>
            Cada serie (CUEM, CUPE, UCI…) lleva su propia numeración y detección de gaps. Marca una serie
            como &quot;no se reparte&quot; si sus radicados no deben asignarse a un trabajador (ej: UCI).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serie</TableHead>
                <TableHead>Se reparte</TableHead>
                <TableHead>Consecutivo actual</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!cargando && series.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aún no hay series (se crean automáticamente al registrar o importar un radicado)
                  </TableCell>
                </TableRow>
              )}
              {series.map((serie) => (
                <TableRow key={serie.id}>
                  <TableCell className="font-medium">{serie.codigo}</TableCell>
                  <TableCell>
                    <Badge variant={serie.distribuible ? 'default' : 'secondary'}>
                      {serie.distribuible ? 'Sí' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-28"
                      value={edicionesConsecutivo[serie.id] ?? ''}
                      onChange={(e) =>
                        setEdicionesConsecutivo((prev) => ({ ...prev, [serie.id]: e.target.value }))
                      }
                    />
                  </TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => guardarConsecutivoSerie(serie)}>
                      Guardar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggleDistribuible(serie)}>
                      {serie.distribuible ? 'No repartir' : 'Repartir'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
