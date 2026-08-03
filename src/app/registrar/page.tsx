'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Loader2, Upload } from 'lucide-react'
import { calcularFechaLimiteRespuesta } from '@/lib/dias-habiles-co'

interface Serie {
  id: number
  codigo: string
  distribuible: boolean
  consecutivoActual: number
}

interface Entidad {
  id: number
  nombre: string
}

interface ResultadoRegistro {
  radicado: {
    numero: number
    idExterno: number | null
    serie: { codigo: string }
    entidad: { nombre: string } | null
    fechaCreacion: string
    tipoGlosa: string | null
    fechaLimite: string | null
  }
  personaAsignada: { nombre: string } | null
  personaSiguiente: { nombre: string } | null
  gapsDetectados: number[]
  distribuible: boolean
}

interface FilaExcel {
  fila: number
  serieCodigo: string
  numero: number
  descripcion?: string
  creadoPor?: string
  entidadNombre?: string
  fechaLimite?: string
  tipoGlosa?: string
}

function formatearFechaInput(fecha: Date) {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface ResultadoImportacion {
  procesados: number
  errores: { fila: number; consecutivo: string; error: string }[]
  gaps: string[]
  invalidas: number
}

const SERIE_NUEVA = '__nueva__'
const ENTIDAD_NUEVA = '__nueva__'

function formatearFecha(fechaIso: string) {
  const texto = format(new Date(fechaIso), "dd MMM yyyy - hh:mm a", { locale: es })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default function RegistrarPage() {
  const [series, setSeries] = useState<Serie[]>([])
  const [serieCodigo, setSerieCodigo] = useState('')
  const [serieNueva, setSerieNueva] = useState('')
  const [numero, setNumero] = useState('')
  const [idExterno, setIdExterno] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [creadoPor, setCreadoPor] = useState('')
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [entidadNombre, setEntidadNombre] = useState('')
  const [entidadNueva, setEntidadNueva] = useState('')
  const [tipoGlosa, setTipoGlosa] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoRegistro | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [previewFilas, setPreviewFilas] = useState<FilaExcel[] | null>(null)
  const [previewTotal, setPreviewTotal] = useState(0)
  const [cargandoPreview, setCargandoPreview] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState<ResultadoImportacion | null>(null)

  function cargarSeries() {
    return fetch('/api/series')
      .then((res) => res.json())
      .then((data) => {
        setSeries(data.series ?? [])
        setIdExterno(String(data.proximoIdExterno ?? 1))
        return data.series ?? []
      })
      .catch(() => [])
  }

  function cargarEntidades() {
    return fetch('/api/entidades')
      .then((res) => res.json())
      .then((data) => {
        setEntidades(data.entidades ?? [])
        return data.entidades ?? []
      })
      .catch(() => [])
  }

  useEffect(() => {
    cargarSeries()
    cargarEntidades()
  }, [])

  // Resolución 2284 de 2023 (Minsalud), artículo 6: glosas, devoluciones y
  // ratificaciones tienen 5 días hábiles de plazo de respuesta -- se
  // autocompleta la fecha límite al elegir el tipo, y se puede corregir a mano.
  useEffect(() => {
    if (!tipoGlosa.trim()) return
    const limite = calcularFechaLimiteRespuesta(new Date(), tipoGlosa)
    if (limite) setFechaLimite(formatearFechaInput(limite))
  }, [tipoGlosa])

  function siguienteNumeroParaSerie(codigo: string, listaSeries: Serie[] = series) {
    const serie = listaSeries.find((s) => s.codigo === codigo)
    return serie ? String(serie.consecutivoActual + 1) : '1'
  }

  function onCambiarSerie(codigo: string) {
    setSerieCodigo(codigo)
    setNumero(codigo === SERIE_NUEVA ? '1' : siguienteNumeroParaSerie(codigo))
  }

  async function registrar() {
    const codigo = serieCodigo === SERIE_NUEVA ? serieNueva.trim() : serieCodigo
    const entidad = entidadNombre === ENTIDAD_NUEVA ? entidadNueva.trim() : entidadNombre
    const numeroNum = Number(numero)
    const idExternoNum = idExterno ? Number(idExterno) : undefined
    if (!codigo) {
      toast.error('Selecciona o escribe una serie (ej: CUEM)')
      return
    }
    if (!numero || !Number.isInteger(numeroNum) || numeroNum <= 0) {
      toast.error('Ingresa un número de consecutivo válido')
      return
    }

    setEnviando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/radicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serieCodigo: codigo,
          numero: numeroNum,
          idExterno: idExternoNum,
          descripcion: descripcion || undefined,
          creadoPor: creadoPor || undefined,
          entidadNombre: entidad || undefined,
          tipoGlosa: tipoGlosa || undefined,
          fechaLimite: fechaLimite || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo registrar el radicado')
        return
      }
      setResultado(data)
      toast.success(`Radicado ${data.radicado.serie.codigo}-${data.radicado.numero} registrado`)
      setDescripcion('')
      setTipoGlosa('')
      setFechaLimite('')
      if (idExternoNum) setIdExterno(String(idExternoNum + 1))
      if (entidadNombre === ENTIDAD_NUEVA) {
        setEntidadNueva('')
        const listaEntidades: Entidad[] = await cargarEntidades()
        const creada = listaEntidades.find((e) => e.nombre === entidad)
        if (creada) setEntidadNombre(creada.nombre)
      }

      if (serieCodigo === SERIE_NUEVA) {
        const codigoNuevo = serieNueva.trim().toUpperCase()
        setSerieNueva('')
        const listaSeries: Serie[] = await cargarSeries()
        setSerieCodigo(codigoNuevo)
        setNumero(siguienteNumeroParaSerie(codigoNuevo, listaSeries))
      } else {
        const seriesActualizadas = series.map((s) =>
          s.codigo === codigo && numeroNum > s.consecutivoActual
            ? { ...s, consecutivoActual: numeroNum }
            : s
        )
        setSeries(seriesActualizadas)
        setNumero(siguienteNumeroParaSerie(codigo, seriesActualizadas))
      }
    } catch {
      toast.error('Error de red al registrar el radicado')
    } finally {
      setEnviando(false)
    }
  }

  async function seleccionarArchivo(file: File | null) {
    setArchivo(file)
    setPreviewFilas(null)
    setResultadoImport(null)
    if (!file) return

    setCargandoPreview(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/importar-excel?preview=1', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo leer el archivo')
        setArchivo(null)
        return
      }
      setPreviewFilas(data.filas)
      setPreviewTotal(data.total)
    } catch {
      toast.error('Error de red al leer el archivo')
    } finally {
      setCargandoPreview(false)
    }
  }

  async function confirmarImportacion() {
    if (!archivo) return
    setImportando(true)
    try {
      const formData = new FormData()
      formData.append('file', archivo)
      const res = await fetch('/api/importar-excel', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo importar el archivo')
        return
      }
      setResultadoImport(data)
      toast.success(`${data.procesados} radicados importados`)
    } catch {
      toast.error('Error de red al importar el archivo')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Registrar radicado</h1>
        <p className="text-sm text-muted-foreground">
          Registra un radicado individual o importa un histórico desde Excel.
        </p>
      </div>

      <Tabs defaultValue="manual">
        <TabsList className="w-full">
          <TabsTrigger value="manual" className="flex-1">
            Registro manual
          </TabsTrigger>
          <TabsTrigger value="excel" className="flex-1">
            Importar desde Excel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Nuevo radicado</CardTitle>
              <CardDescription>
                El sistema asigna automáticamente a la siguiente persona en turno (salvo series marcadas como
                &quot;no se reparte&quot;, como UCI).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Serie *</Label>
                  <Select value={serieCodigo} onValueChange={(v) => v && onCambiarSerie(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="CUEM, CUPE, UCI…" />
                    </SelectTrigger>
                    <SelectContent>
                      {series.map((s) => (
                        <SelectItem key={s.id} value={s.codigo}>
                          {s.codigo}
                        </SelectItem>
                      ))}
                      <SelectItem value={SERIE_NUEVA}>+ Nueva serie…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="numero">Número *</Label>
                  <Input
                    id="numero"
                    type="number"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="2531"
                    onKeyDown={(e) => e.key === 'Enter' && registrar()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se autocompleta con el siguiente de la serie, puedes corregirlo.
                  </p>
                </div>
              </div>

              {serieCodigo === SERIE_NUEVA && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="serieNueva">Código de la nueva serie</Label>
                  <Input
                    id="serieNueva"
                    value={serieNueva}
                    onChange={(e) => setSerieNueva(e.target.value.toUpperCase())}
                    placeholder="Ej: CUPE"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="idExterno">Id</Label>
                <Input
                  id="idExterno"
                  type="number"
                  value={idExterno}
                  onChange={(e) => setIdExterno(e.target.value)}
                  placeholder="34504"
                />
                <p className="text-xs text-muted-foreground">
                  Consecutivo global del Id (independiente de la serie), se autocompleta con el siguiente.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Entidad</Label>
                <Select value={entidadNombre} onValueChange={(v) => v && setEntidadNombre(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="EPS o aseguradora que remite" />
                  </SelectTrigger>
                  <SelectContent>
                    {entidades.map((e) => (
                      <SelectItem key={e.id} value={e.nombre}>
                        {e.nombre}
                      </SelectItem>
                    ))}
                    <SelectItem value={ENTIDAD_NUEVA}>+ Nueva entidad…</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {entidadNombre === ENTIDAD_NUEVA && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="entidadNueva">Nombre de la nueva entidad</Label>
                  <Input
                    id="entidadNueva"
                    value={entidadNueva}
                    onChange={(e) => setEntidadNueva(e.target.value)}
                    placeholder="Ej: NUEVA EPS"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tipoGlosa">Tipo de glosa</Label>
                  <Input
                    id="tipoGlosa"
                    value={tipoGlosa}
                    onChange={(e) => setTipoGlosa(e.target.value)}
                    placeholder="Glosa, devolución, ratificación…"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fechaLimite">Fecha límite</Label>
                  <Input
                    id="fechaLimite"
                    type="date"
                    value={fechaLimite}
                    onChange={(e) => setFechaLimite(e.target.value)}
                  />
                </div>
              </div>
              {tipoGlosa.trim() && (
                <p className="-mt-2 text-xs text-muted-foreground">
                  Se calculó como 5 días hábiles de Colombia desde hoy (Resolución 2284 de 2023). Puedes
                  corregirla.
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="descripcion">Descripción</Label>
                <Input
                  id="descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Glosa, factura o devolución"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="creadoPor">Registrado por</Label>
                <Input
                  id="creadoPor"
                  value={creadoPor}
                  onChange={(e) => setCreadoPor(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>

              <Button onClick={registrar} disabled={enviando} className="w-full">
                {enviando && <Loader2 className="mr-1 size-4 animate-spin" />}
                Registrar radicado
              </Button>

              {resultado && (
                <div className="relative rounded-md border-2 border-dashed border-primary/60 bg-accent/40 p-4 text-sm">
                  <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary/80">
                    Radicado registrado
                  </p>
                  <p className="num-folio text-lg font-bold text-primary">
                    {resultado.radicado.serie.codigo}-{resultado.radicado.numero}
                    {resultado.radicado.idExterno ? (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        Id {resultado.radicado.idExterno}
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-2 flex flex-col gap-0.5 text-foreground">
                    {resultado.radicado.entidad && <p>Entidad: {resultado.radicado.entidad.nombre}</p>}
                    {resultado.radicado.tipoGlosa && <p>Tipo: {resultado.radicado.tipoGlosa}</p>}
                    {resultado.radicado.fechaLimite && (
                      <p>
                        Fecha límite:{' '}
                        <span className="font-medium">
                          {format(new Date(resultado.radicado.fechaLimite), 'dd MMM yyyy', { locale: es })}
                        </span>
                      </p>
                    )}
                    {resultado.distribuible ? (
                      <>
                        <p>Asignado a: <span className="font-medium">{resultado.personaAsignada?.nombre.toUpperCase()}</span></p>
                        <p className="text-muted-foreground">{formatearFecha(resultado.radicado.fechaCreacion)}</p>
                        <p className="text-muted-foreground">Siguiente turno: {resultado.personaSiguiente?.nombre.toUpperCase()}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Esta serie no se reparte a los trabajadores, queda solo registrada.</p>
                    )}
                  </div>
                  {resultado.gapsDetectados.length > 0 && (
                    <p className="mt-2 text-amber-700 dark:text-amber-500">
                      Se detectaron {resultado.gapsDetectados.length} consecutivos sin radicado (
                      {resultado.gapsDetectados.map((n) => `${resultado.radicado.serie.codigo}-${n}`).join(', ')})
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="excel" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar histórico</CardTitle>
              <CardDescription>
                El archivo debe tener una columna &quot;consecutivo&quot; (ej: CUEM-2526). Opcionalmente Id,
                Descripción, Fecha Radica, Nombre Entidad (columna F), Fecha Límite (columna O) y Tipo
                Glosa (columna P) del Excel que compartimos entre empresas.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input p-8 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
              >
                <Upload className="size-6" />
                {archivo ? archivo.name : 'Haz clic para seleccionar un archivo .xlsx'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => seleccionarArchivo(e.target.files?.[0] ?? null)}
              />

              {cargandoPreview && (
                <p className="text-sm text-muted-foreground">Leyendo archivo…</p>
              )}

              {previewFilas && previewFilas.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">
                    Vista previa (primeras {previewFilas.length} de {previewTotal} filas)
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Consecutivo</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Registrado por</TableHead>
                        <TableHead>Entidad</TableHead>
                        <TableHead>Fecha límite</TableHead>
                        <TableHead>Tipo glosa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewFilas.map((fila) => (
                        <TableRow key={fila.fila}>
                          <TableCell className="num-folio">
                            {fila.serieCodigo}-{fila.numero}
                          </TableCell>
                          <TableCell>{fila.descripcion || '—'}</TableCell>
                          <TableCell>{fila.creadoPor || '—'}</TableCell>
                          <TableCell>{fila.entidadNombre || '—'}</TableCell>
                          <TableCell className="num-folio">{fila.fechaLimite || '—'}</TableCell>
                          <TableCell>{fila.tipoGlosa || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button onClick={confirmarImportacion} disabled={importando} className="w-full">
                    {importando && <Loader2 className="mr-1 size-4 animate-spin" />}
                    Confirmar importación
                  </Button>
                </div>
              )}

              {resultadoImport && (
                <div className="rounded-md border-2 border-dashed border-primary/60 bg-accent/40 p-4 text-sm">
                  <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary/80">
                    Importación completada
                  </p>
                  <p className="num-folio text-lg font-bold text-primary">{resultadoImport.procesados} radicados</p>
                  {resultadoImport.invalidas > 0 && (
                    <p className="mt-1 text-amber-700 dark:text-amber-500">
                      {resultadoImport.invalidas} filas con formato de consecutivo inválido (se ignoraron)
                    </p>
                  )}
                  {resultadoImport.gaps.length > 0 && (
                    <p className="mt-1 text-amber-700 dark:text-amber-500">
                      {resultadoImport.gaps.length} gaps generados ({resultadoImport.gaps.join(', ')})
                    </p>
                  )}
                  {resultadoImport.errores.length > 0 && (
                    <div className="mt-1 text-destructive">
                      <p>{resultadoImport.errores.length} filas con error:</p>
                      <ul className="list-inside list-disc">
                        {resultadoImport.errores.map((err) => (
                          <li key={err.fila}>
                            Fila {err.fila} (consecutivo {err.consecutivo}): {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
