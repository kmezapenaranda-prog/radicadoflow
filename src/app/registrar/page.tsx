'use client'

import { useRef, useState } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Upload } from 'lucide-react'

interface ResultadoRegistro {
  radicado: { consecutivo: number; fechaCreacion: string }
  personaAsignada: { nombre: string }
  personaSiguiente: { nombre: string }
  gapsDetectados: number[]
}

interface FilaExcel {
  fila: number
  consecutivo: number
  descripcion?: string
  creadoPor?: string
}

interface ResultadoImportacion {
  procesados: number
  errores: { fila: number; consecutivo: number; error: string }[]
  gaps: number[]
}

function formatearFecha(fechaIso: string) {
  const texto = format(new Date(fechaIso), "dd MMM yyyy - hh:mm a", { locale: es })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default function RegistrarPage() {
  const [consecutivo, setConsecutivo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [creadoPor, setCreadoPor] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoRegistro | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [previewFilas, setPreviewFilas] = useState<FilaExcel[] | null>(null)
  const [previewTotal, setPreviewTotal] = useState(0)
  const [cargandoPreview, setCargandoPreview] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState<ResultadoImportacion | null>(null)

  async function registrar() {
    const consecutivoNum = Number(consecutivo)
    if (!consecutivo || !Number.isInteger(consecutivoNum) || consecutivoNum <= 0) {
      toast.error('Ingresa un consecutivo válido')
      return
    }

    setEnviando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/radicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consecutivo: consecutivoNum,
          descripcion: descripcion || undefined,
          creadoPor: creadoPor || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo registrar el radicado')
        return
      }
      setResultado(data)
      toast.success(`Radicado #${data.radicado.consecutivo} registrado`)
      setConsecutivo('')
      setDescripcion('')
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
        <h1 className="text-2xl font-semibold">Registrar radicado</h1>
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
              <CardDescription>El sistema asigna automáticamente a la siguiente persona en turno.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="consecutivo">Consecutivo *</Label>
                <Input
                  id="consecutivo"
                  type="number"
                  value={consecutivo}
                  onChange={(e) => setConsecutivo(e.target.value)}
                  placeholder="00045"
                  onKeyDown={(e) => e.key === 'Enter' && registrar()}
                />
              </div>
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
                <div className="flex flex-col gap-1 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <p>✅ Radicado #{resultado.radicado.consecutivo} registrado</p>
                  <p>👤 Asignado a: {resultado.personaAsignada.nombre.toUpperCase()}</p>
                  <p>📅 Fecha: {formatearFecha(resultado.radicado.fechaCreacion)}</p>
                  <p>⚡ Siguiente turno: {resultado.personaSiguiente.nombre.toUpperCase()}</p>
                  {resultado.gapsDetectados.length > 0 && (
                    <p className="mt-1 text-amber-700">
                      ⚠️ Se detectaron {resultado.gapsDetectados.length} consecutivos sin radicado (
                      {resultado.gapsDetectados.join(', ')})
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
                El archivo debe tener columnas: consecutivo, descripcion, creadoPor
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewFilas.map((fila) => (
                        <TableRow key={fila.fila}>
                          <TableCell>{fila.consecutivo}</TableCell>
                          <TableCell>{fila.descripcion || '—'}</TableCell>
                          <TableCell>{fila.creadoPor || '—'}</TableCell>
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
                <div className="flex flex-col gap-1 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <p>✅ {resultadoImport.procesados} radicados procesados</p>
                  {resultadoImport.gaps.length > 0 && (
                    <p className="text-amber-700">
                      ⚠️ {resultadoImport.gaps.length} gaps generados ({resultadoImport.gaps.join(', ')})
                    </p>
                  )}
                  {resultadoImport.errores.length > 0 && (
                    <div className="text-red-700">
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
