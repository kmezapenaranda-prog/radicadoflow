'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Radicado {
  id: number
  numero: number
  serie: { codigo: string; distribuible: boolean }
  descripcion: string | null
  creadoPor: string | null
  esGap: boolean
  fechaCreacion: string
  persona: { nombre: string } | null
}

interface PersonaRanking {
  nombre: string
  total: number
  porcentaje: number
}

function fechaLocal(iso: string) {
  return format(new Date(iso), 'yyyy-MM-dd')
}

export default function DashboardPage() {
  const [cargando, setCargando] = useState(true)
  const [hoyTotal, setHoyTotal] = useState(0)
  const [mesTotal, setMesTotal] = useState(0)
  const [gapsMes, setGapsMes] = useState(0)
  const [personaEnTurno, setPersonaEnTurno] = useState<string | null>(null)
  const [ultimos, setUltimos] = useState<Radicado[]>([])
  const [porDia, setPorDia] = useState<{ fecha: string; total: number }[]>([])
  const [topPersonas, setTopPersonas] = useState<PersonaRanking[]>([])

  useEffect(() => {
    async function cargar() {
      const hoy = new Date()
      const mes = hoy.getMonth() + 1
      const anio = hoy.getFullYear()
      const haceSieteDias = new Date(hoy)
      haceSieteDias.setDate(haceSieteDias.getDate() - 6)
      haceSieteDias.setHours(0, 0, 0, 0)

      const [resConfig, resInforme, resUltimos, resSemana] = await Promise.all([
        fetch('/api/configuracion'),
        fetch(`/api/informes/mensual?mes=${mes}&anio=${anio}`),
        fetch('/api/radicados?orden=fecha&limit=20'),
        fetch(`/api/radicados?desde=${haceSieteDias.toISOString()}&orden=fecha&limit=500`),
      ])

      const dataConfig = await resConfig.json()
      const dataInforme = await resInforme.json()
      const dataUltimos = await resUltimos.json()
      const dataSemana = await resSemana.json()

      setPersonaEnTurno(dataConfig.personaEnTurno?.nombre ?? null)
      setMesTotal(dataInforme.totalRadicados ?? 0)
      setGapsMes(dataInforme.totalGaps ?? 0)
      setTopPersonas((dataInforme.porPersona ?? []).slice(0, 5))
      setUltimos(dataUltimos.radicados ?? [])

      const hoyStr = fechaLocal(hoy.toISOString())
      const radicadosSemana: Radicado[] = dataSemana.radicados ?? []
      setHoyTotal(
        radicadosSemana.filter((r) => !r.esGap && fechaLocal(r.fechaCreacion) === hoyStr).length
      )

      const buckets = new Map<string, number>()
      for (let i = 0; i < 7; i++) {
        const d = new Date(haceSieteDias)
        d.setDate(d.getDate() + i)
        buckets.set(fechaLocal(d.toISOString()), 0)
      }
      for (const r of radicadosSemana) {
        if (r.esGap) continue
        const key = fechaLocal(r.fechaCreacion)
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
      }
      setPorDia(Array.from(buckets.entries()).map(([fecha, total]) => ({ fecha, total })))

      setCargando(false)
    }
    cargar()
  }, [])

  const maxDia = Math.max(1, ...porDia.map((d) => d.total))

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen de radicados y turnos en tiempo real.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 pt-4">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Hoy</span>
            {cargando ? <Skeleton className="h-9 w-12" /> : <span className="text-3xl font-semibold">{hoyTotal}</span>}
            <span className="text-xs text-muted-foreground">radicados</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-4">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Mes</span>
            {cargando ? <Skeleton className="h-9 w-12" /> : <span className="text-3xl font-semibold">{mesTotal}</span>}
            <span className="text-xs text-muted-foreground">radicados</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-4">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Gaps</span>
            {cargando ? (
              <Skeleton className="h-9 w-12" />
            ) : (
              <span className="text-3xl font-semibold text-red-600">{gapsMes}</span>
            )}
            <span className="text-xs text-muted-foreground">este mes</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-4">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Turno</span>
            {cargando ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <span className="truncate text-xl font-semibold text-indigo-600">
                {personaEnTurno ?? 'Sin asignar'}
              </span>
            )}
            <span className="text-xs text-muted-foreground">le toca</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Últimos radicados</CardTitle>
            <CardDescription>Los 20 registros más recientes</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consecutivo</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                {!cargando && ultimos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Aún no hay radicados registrados
                    </TableCell>
                  </TableRow>
                )}
                {ultimos.map((r) => (
                  <TableRow key={r.id} className={r.esGap ? 'bg-red-50 dark:bg-red-950/30' : ''}>
                    <TableCell className="font-medium">
                      {r.serie.codigo}-{r.numero}
                    </TableCell>
                    <TableCell>{r.persona?.nombre ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{r.creadoPor ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(r.fechaCreacion), 'dd MMM, HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell>
                      {r.esGap ? (
                        <Badge variant="destructive">⚠️ GAP</Badge>
                      ) : !r.serie.distribuible ? (
                        <Badge variant="outline">No aplica</Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Últimos 7 días</CardTitle>
              <CardDescription>Radicados asignados por día</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 items-end gap-2">
                {porDia.map((d) => (
                  <div key={d.fecha} className="group relative flex flex-1 flex-col items-center gap-1">
                    <div className="pointer-events-none absolute -top-7 hidden rounded-md bg-foreground px-1.5 py-0.5 text-xs text-background group-hover:block">
                      {d.total}
                    </div>
                    <div
                      className="w-full min-h-[4px] rounded-t bg-indigo-600 transition-all dark:bg-indigo-400"
                      style={{ height: `${(d.total / maxDia) * 100}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(d.fecha), 'EEE', { locale: es })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top personas del mes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {topPersonas.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin datos este mes</p>
              )}
              {topPersonas.map((p, i) => (
                <div key={p.nombre} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {i + 1}
                    </span>
                    {p.nombre}
                  </span>
                  <span className="text-muted-foreground">
                    {p.total} · {p.porcentaje}%
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
