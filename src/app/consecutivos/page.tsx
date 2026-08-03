'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download } from 'lucide-react'

interface Radicado {
  id: number
  numero: number
  idExterno: number | null
  serie: { codigo: string; distribuible: boolean }
  esGap: boolean
  fechaCreacion: string
  persona: { nombre: string } | null
  entidad: { nombre: string } | null
}

interface Serie {
  id: number
  codigo: string
}

interface Persona {
  id: number
  nombre: string
}

interface Entidad {
  id: number
  nombre: string
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const POR_PAGINA = 50

export default function ConsecutivosPage() {
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [serieId, setSerieId] = useState<string>('todas')
  const [series, setSeries] = useState<Serie[]>([])
  const [personaId, setPersonaId] = useState<string>('todas')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [entidadId, setEntidadId] = useState<string>('todas')
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [radicados, setRadicados] = useState<Radicado[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch('/api/series')
      .then((res) => res.json())
      .then((data) => setSeries(data.series ?? []))
      .catch(() => {})
    fetch('/api/personas')
      .then((res) => res.json())
      .then((data) => setPersonas(data.personas ?? []))
      .catch(() => {})
    fetch('/api/entidades')
      .then((res) => res.json())
      .then((data) => setEntidades(data.entidades ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const filtroSerie = serieId !== 'todas' ? `&serieId=${serieId}` : ''
      const filtroPersona = personaId !== 'todas' ? `&personaId=${personaId}` : ''
      const filtroEntidad = entidadId !== 'todas' ? `&entidadId=${entidadId}` : ''
      const res = await fetch(
        `/api/radicados?mes=${mes}&anio=${anio}&dir=asc&limit=2000${filtroSerie}${filtroPersona}${filtroEntidad}`
      )
      const data = await res.json()
      setRadicados(data.radicados ?? [])
      setPagina(1)
      setCargando(false)
    }
    cargar()
  }, [mes, anio, serieId, personaId, entidadId])

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return radicados
    const q = busqueda.trim().toLowerCase()
    return radicados.filter((r) => `${r.serie.codigo}-${r.numero}`.toLowerCase().includes(q))
  }, [radicados, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const filtradosPagina = filtrados.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA
  )

  const totalAsignados = radicados.filter((r) => !r.esGap).length
  const totalGaps = radicados.filter((r) => r.esGap).length
  const completitud =
    totalAsignados + totalGaps > 0
      ? Math.round((totalAsignados / (totalAsignados + totalGaps)) * 1000) / 10
      : 100

  const anios = Array.from({ length: 3 }, (_, i) => hoy.getFullYear() - i)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Consecutivos</h1>
          <p className="text-sm text-muted-foreground">
            Línea de tiempo de consecutivos y detección de gaps
          </p>
        </div>
        <a
          href={`/api/exportar-excel?mes=${mes}&anio=${anio}`}
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          <Download className="mr-1 size-4" /> Exportar vista
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 pt-4">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Total asignados
            </span>
            <span className="text-2xl font-semibold">{totalAsignados}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-4">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Total gaps
            </span>
            <span className="text-2xl font-semibold text-red-600">{totalGaps}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-4">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              % Completitud
            </span>
            <span className="text-2xl font-semibold">{completitud}%</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-3">
          <Select value={String(mes)} onValueChange={(v) => v && setMes(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue>{(v: string) => MESES[Number(v) - 1] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MESES.map((nombre, i) => (
                <SelectItem key={nombre} value={String(i + 1)}>
                  {nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(anio)} onValueChange={(v) => v && setAnio(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue>{(v: string) => v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {anios.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={serieId} onValueChange={(v) => v && setSerieId(v)}>
            <SelectTrigger className="w-32">
              <SelectValue>
                {(v: string) =>
                  v === 'todas' ? 'Todas las series' : series.find((s) => String(s.id) === v)?.codigo ?? v
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las series</SelectItem>
              {series.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={personaId} onValueChange={(v) => v && setPersonaId(v)}>
            <SelectTrigger className="w-40">
              <SelectValue>
                {(v: string) =>
                  v === 'todas'
                    ? 'Todas las personas'
                    : personas.find((p) => String(p.id) === v)?.nombre ?? v
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las personas</SelectItem>
              {personas.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entidadId} onValueChange={(v) => v && setEntidadId(v)}>
            <SelectTrigger className="w-40">
              <SelectValue>
                {(v: string) =>
                  v === 'todas'
                    ? 'Todas las entidades'
                    : entidades.find((e) => String(e.id) === v)?.nombre ?? v
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las entidades</SelectItem>
              {entidades.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPagina(1)
            }}
            placeholder="Buscar consecutivo…"
            className="max-w-48"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consecutivo</TableHead>
                <TableHead>Id</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Persona</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!cargando && filtradosPagina.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay consecutivos para este filtro
                  </TableCell>
                </TableRow>
              )}
              {filtradosPagina.map((r) => (
                <TableRow key={r.id} className={r.esGap ? 'bg-red-50 dark:bg-red-950/30' : ''}>
                  <TableCell className="font-medium">
                    {r.serie.codigo}-{r.numero}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.idExterno ?? '—'}</TableCell>
                  <TableCell>
                    {r.esGap ? (
                      <Badge variant="destructive">⚠️ GAP</Badge>
                    ) : !r.serie.distribuible ? (
                      <Badge variant="outline">No aplica</Badge>
                    ) : (
                      <Badge variant="secondary">✅ OK</Badge>
                    )}
                  </TableCell>
                  <TableCell>{r.persona?.nombre ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{r.entidad?.nombre ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.esGap ? '—' : format(new Date(r.fechaCreacion), 'dd MMM yyyy HH:mm', { locale: es })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPaginas > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Página {paginaSegura} de {totalPaginas} ({filtrados.length} resultados)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaSegura <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaSegura >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
