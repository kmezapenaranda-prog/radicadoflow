// Días hábiles de Colombia: calcula festivos para cualquier año (no una
// lista fija que se puede quedar desactualizada). Domingo de Pascua vía el
// algoritmo de Meeus/Jones/Butcher; festivos trasladables al lunes según la
// Ley 51 de 1983 ("Ley Emiliani").

function calcularDomingoPascua(anio: number): Date {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(anio, mes - 1, dia)
}

function sumarDias(fecha: Date, dias: number): Date {
  const resultado = new Date(fecha)
  resultado.setDate(resultado.getDate() + dias)
  return resultado
}

// Festivos que no caen en lunes se trasladan al lunes siguiente.
function trasladarALunes(fecha: Date): Date {
  const resultado = new Date(fecha)
  while (resultado.getDay() !== 1) {
    resultado.setDate(resultado.getDate() + 1)
  }
  return resultado
}

function formatearYMD(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function festivosColombia(anio: number): Date[] {
  const pascua = calcularDomingoPascua(anio)

  const fijos = [
    new Date(anio, 0, 1), // Año Nuevo
    new Date(anio, 4, 1), // Día del Trabajo
    new Date(anio, 6, 20), // Día de la Independencia
    new Date(anio, 7, 7), // Batalla de Boyacá
    new Date(anio, 11, 8), // Inmaculada Concepción
    new Date(anio, 11, 25), // Navidad
  ]

  // Semana Santa: siempre jueves/viernes antes de Pascua, no se trasladan.
  const semanaSanta = [sumarDias(pascua, -3), sumarDias(pascua, -2)]

  const trasladables = [
    new Date(anio, 0, 6), // Reyes Magos
    new Date(anio, 2, 19), // San José
    sumarDias(pascua, 39), // Ascensión del Señor
    sumarDias(pascua, 60), // Corpus Christi
    sumarDias(pascua, 68), // Sagrado Corazón de Jesús
    new Date(anio, 5, 29), // San Pedro y San Pablo
    new Date(anio, 7, 15), // Asunción de la Virgen
    new Date(anio, 9, 12), // Día de la Raza
    new Date(anio, 10, 1), // Todos los Santos
    new Date(anio, 10, 11), // Independencia de Cartagena
  ].map(trasladarALunes)

  return [...fijos, ...semanaSanta, ...trasladables]
}

const cacheFestivos = new Map<number, Set<string>>()
function festivosDelAnio(anio: number): Set<string> {
  let set = cacheFestivos.get(anio)
  if (!set) {
    set = new Set(festivosColombia(anio).map(formatearYMD))
    cacheFestivos.set(anio, set)
  }
  return set
}

export function esFestivoColombia(fecha: Date): boolean {
  return festivosDelAnio(fecha.getFullYear()).has(formatearYMD(fecha))
}

export function esDiaHabilColombia(fecha: Date): boolean {
  const diaSemana = fecha.getDay()
  if (diaSemana === 0 || diaSemana === 6) return false
  return !esFestivoColombia(fecha)
}

// Cuenta exactamente `diasHabiles` días hábiles hacia adelante desde
// `fechaInicio` (sin contar fechaInicio como uno de ellos).
export function sumarDiasHabilesColombia(fechaInicio: Date, diasHabiles: number): Date {
  const resultado = new Date(fechaInicio)
  let contados = 0
  while (contados < diasHabiles) {
    resultado.setDate(resultado.getDate() + 1)
    if (esDiaHabilColombia(resultado)) contados++
  }
  return resultado
}

// Resolución 2284 de 2023 (Minsalud, vigente desde el 1 de abril de 2024),
// artículo 6: tanto para glosas como para devoluciones, la entidad
// responsable de pago tiene 5 días hábiles para formular/comunicar, el
// prestador tiene 5 días hábiles para responder, y la entidad tiene otros 5
// días hábiles para ratificar o levantar -- las tres etapas usan el mismo
// plazo de 5 días hábiles.
const DIAS_PLAZO_RESPUESTA = 5
const PATRONES_CON_PLAZO = [/glosa/, /devoluci/, /ratificaci/]

function normalizarTipo(tipoGlosa: string): string {
  return tipoGlosa
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function requierePlazoDeRespuesta(tipoGlosa: string): boolean {
  const normalizado = normalizarTipo(tipoGlosa)
  return PATRONES_CON_PLAZO.some((patron) => patron.test(normalizado))
}

// Devuelve la fecha límite (radicación + 5 días hábiles de Colombia) si el
// tipo corresponde a glosa/devolución/ratificación, o null si no aplica.
export function calcularFechaLimiteRespuesta(fechaRadicacion: Date, tipoGlosa: string): Date | null {
  if (!requierePlazoDeRespuesta(tipoGlosa)) return null
  return sumarDiasHabilesColombia(fechaRadicacion, DIAS_PLAZO_RESPUESTA)
}
