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
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Download } from 'lucide-react'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface PersonaRanking {
  nombre: string
  total: number
  porcentaje: number
  diasActivos: number
}

interface InformeMensual {
  totalRadicados: number
  totalGaps: number
  totalPersonasActivas: number
  porPersona: PersonaRanking[]
}

interface Persona {
  id: number
  nombre: string
  activo: boolean
  orden: number
}

interface Radicado {
  numero: number
  serie: { codigo: string }
  esGap: boolean
  fechaCreacion: string
  persona: { id: number; nombre: string } | null
}

export default function InformesPage() {
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [informe, setInforme] = useState<InformeMensual | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [radicados, setRadicados] = useState<Radicado[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const [resInforme, resPersonas, resRadicados] = await Promise.all([
        fetch(`/api/informes/mensual?mes=${mes}&anio=${anio}`),
        fetch('/api/personas'),
        fetch(`/api/radicados?mes=${mes}&anio=${anio}&dir=asc&limit=2000`),
      ])
      setInforme(await resInforme.json())
      const dataPersonas = await resPersonas.json()
      setPersonas(dataPersonas.personas ?? [])
      const dataRadicados = await resRadicados.json()
      setRadicados(dataRadicados.radicados ?? [])
      setCargando(false)
    }
    cargar()
  }, [mes, anio])

  const personasActivas = useMemo(
    () => personas.filter((p) => p.activo).sort((a, b) => a.orden - b.orden),
    [personas]
  )

  const porDia = useMemo(() => {
    const buckets = new Map<string, { total: number; porPersona: Map<number, number> }>()
    for (const r of radicados) {
      if (r.esGap) continue
      const fecha = r.fechaCreacion.slice(0, 10)
      const entry = buckets.get(fecha) ?? { total: 0, porPersona: new Map() }
      entry.total += 1
      if (r.persona) {
        entry.porPersona.set(r.persona.id, (entry.porPersona.get(r.persona.id) ?? 0) + 1)
      }
      buckets.set(fecha, entry)
    }
    return Array.from(buckets.entries())
      .map(([fecha, v]) => ({ fecha, ...v }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [radicados])

  const anios = Array.from({ length: 3 }, (_, i) => hoy.getFullYear() - i)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Informes mensuales</h1>
          <p className="text-sm text-muted-foreground">
            Informe {MESES[mes - 1]} {anio}
          </p>
        </div>
        <div className="flex gap-2">
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
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anios.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen ejecutivo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 divide-x divide-border text-center">
          <div className="flex flex-col gap-1 px-2">
            <span className="text-3xl font-semibold">{cargando ? '—' : informe?.totalRadicados ?? 0}</span>
            <span className="text-xs text-muted-foreground">Radicados asignados</span>
          </div>
          <div className="flex flex-col gap-1 px-2">
            <span className="text-3xl font-semibold text-red-600">
              {cargando ? '—' : informe?.totalGaps ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">Consecutivos GAP</span>
          </div>
          <div className="flex flex-col gap-1 px-2">
            <span className="text-3xl font-semibold">
              {cargando ? '—' : informe?.totalPersonasActivas ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">Personas activas</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por persona</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Radicados</TableHead>
                <TableHead>% del mes</TableHead>
                <TableHead>Días activos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!cargando && (informe?.porPersona.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Sin datos para este mes
                  </TableCell>
                </TableRow>
              )}
              {informe?.porPersona.map((p) => (
                <TableRow key={p.nombre}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{p.total}</TableCell>
                  <TableCell>{p.porcentaje}%</TableCell>
                  <TableCell>{p.diasActivos}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por día</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Total</TableHead>
                {personasActivas.map((p) => (
                  <TableHead key={p.id}>{p.nombre}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando && (
                <TableRow>
                  {Array.from({ length: 2 + personasActivas.length }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              )}
              {!cargando && porDia.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2 + personasActivas.length} className="text-center text-muted-foreground">
                    Sin datos para este mes
                  </TableCell>
                </TableRow>
              )}
              {porDia.map((dia) => (
                <TableRow key={dia.fecha}>
                  <TableCell className="font-medium">
                    {format(new Date(dia.fecha), "EEE dd MMM", { locale: es })}
                  </TableCell>
                  <TableCell>{dia.total}</TableCell>
                  {personasActivas.map((p) => (
                    <TableCell key={p.id}>{dia.porPersona.get(p.id) ?? 0}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <a
        href={`/api/exportar-excel?mes=${mes}&anio=${anio}`}
        className={cn(buttonVariants({ size: 'lg' }), 'w-full text-base')}
      >
        <Download className="mr-1 size-4" /> Exportar informe completo Excel
      </a>
    </div>
  )
}
