# CLAUDE.md — RadicadoFlow
## Sistema Automático de Asignación de Radicados

> **INSTRUCCIÓN PARA CLAUDE CODE**: Este archivo es un loop autónomo.
> Ejecuta cada FASE en orden. Al final de cada fase haz `git commit`.
> No esperes instrucciones entre fases. Si algo falla, intenta corregirlo
> antes de pedir ayuda. Solo detente si un error es bloqueante.

---

## CONTEXTO DEL NEGOCIO

Sistema para equipos de auditoría/facturación de salud en Colombia.
Cuando el responsable registra un **radicado** (glosa, factura o devolución),
el sistema asigna automáticamente ese radicado al siguiente auditor
en turno (rotación circular). Incluye:

- Configuración inicial de personas y turnos
- Registro de radicados con asignación automática
- Seguimiento de **consecutivos** (si un consecutivo no genera radicado = GAP)
- Informe diario y reporte mensual exportable a Excel

---

## STACK TECNOLÓGICO

```
Framework:   Next.js 14 (App Router) + TypeScript
Estilos:     Tailwind CSS + shadcn/ui
Base datos:  Prisma ORM + SQLite (dev) / PostgreSQL (prod Vercel)
Excel:       exceljs (lectura y exportación)
Fechas:      date-fns
Deploy:      GitHub → Vercel (CI/CD automático)
```

---

## MODELO DE DATOS (Prisma Schema)

```prisma
model Configuracion {
  id                Int      @id @default(1)
  consecutivoActual Int      @default(0)
  turnoActual       Int      @default(0)   // índice de la persona actual en rotación
  updatedAt         DateTime @updatedAt
}

model Persona {
  id         Int        @id @default(autoincrement())
  nombre     String
  email      String?
  orden      Int        // posición en la rotación (1, 2, 3...)
  activo     Boolean    @default(true)
  radicados  Radicado[]
  createdAt  DateTime   @default(now())
}

model Radicado {
  id           Int      @id @default(autoincrement())
  consecutivo  Int      @unique  // número consecutivo del radicado
  descripcion  String?
  personaId    Int?             // null si es un GAP (sin asignación)
  persona      Persona? @relation(fields: [personaId], references: [id])
  esGap        Boolean  @default(false)  // true si consecutivo no tuvo radicado
  creadoPor    String?           // quien lo registró
  fechaCreacion DateTime @default(now())
  mes          Int               // mes del año (1-12)
  anio         Int               // año
}
```

---

## ARQUITECTURA DE RUTAS (Next.js App Router)

```
/app
  /page.tsx                    → Dashboard principal (últimos radicados + stats hoy)
  /configuracion/page.tsx      → Setup inicial de personas y consecutivo base
  /registrar/page.tsx          → Formulario para registrar nuevo radicado
  /consecutivos/page.tsx       → Vista de consecutivos con gaps marcados
  /informes/page.tsx           → Informe mensual con exportación Excel
  /api
    /radicados/route.ts        → GET (listar) / POST (crear con asignación automática)
    /personas/route.ts         → GET / POST / PUT / DELETE personas
    /configuracion/route.ts    → GET / PUT configuración
    /informes/mensual/route.ts → GET informe mensual (con query ?mes=&anio=)
    /importar-excel/route.ts   → POST importar radicados desde Excel
    /exportar-excel/route.ts   → GET exportar informe a Excel
```

---

## LÓGICA DE NEGOCIO CLAVE

### Asignación Rotativa

```typescript
// Al registrar un radicado:
// 1. Obtener la configuración actual
// 2. Tomar turnoActual → asignar a personas[turnoActual]
// 3. Incrementar turnoActual % totalPersonasActivas
// 4. Guardar en DB

async function asignarSiguientePersona(prisma: PrismaClient) {
  const config = await prisma.configuracion.findFirst()
  const personas = await prisma.persona.findMany({
    where: { activo: true },
    orderBy: { orden: 'asc' }
  })
  if (personas.length === 0) throw new Error('No hay personas configuradas')
  
  const personaAsignada = personas[config.turnoActual % personas.length]
  const nuevoTurno = (config.turnoActual + 1) % personas.length
  
  await prisma.configuracion.update({
    where: { id: 1 },
    data: { turnoActual: nuevoTurno }
  })
  
  return personaAsignada
}
```

### Detección de GAPs en Consecutivos

```typescript
// Al registrar consecutivo N, verificar si existe N-1 sin radicado.
// Si el sistema tenía consecutivoActual = 45 y llega el 47,
// el 46 es un GAP: se marca esGap=true, personaId=null.

async function detectarYMarcarGaps(
  prisma: PrismaClient, 
  nuevoConsecutivo: number, 
  consecutivoActual: number
) {
  for (let i = consecutivoActual + 1; i < nuevoConsecutivo; i++) {
    await prisma.radicado.create({
      data: {
        consecutivo: i,
        esGap: true,
        personaId: null,
        mes: new Date().getMonth() + 1,
        anio: new Date().getFullYear()
      }
    })
  }
}
```

### Importación desde Excel

```typescript
// El Excel puede tener columnas: consecutivo, descripcion, creadoPor, fecha
// El sistema procesa fila por fila y aplica la misma lógica de asignación
// Detección de gaps funciona igual que en registro manual
```

---

## FASES DE CONSTRUCCIÓN (EJECUTAR EN ORDEN)

---

### FASE 1 — Scaffolding y configuración del proyecto

```bash
npx create-next-app@latest radicadoflow \
  --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint

cd radicadoflow

# Instalar dependencias
npm install @prisma/client prisma exceljs date-fns
npm install -D prisma

# shadcn/ui init
npx shadcn@latest init -d

# Componentes shadcn necesarios
npx shadcn@latest add button card table badge input label \
  select dialog toast progress separator tabs

# Prisma init con SQLite
npx prisma init --datasource-provider sqlite
```

Crear `prisma/schema.prisma` con el modelo de datos definido arriba.

```bash
npx prisma db push
npx prisma generate
```

Crear seed inicial:
```bash
# prisma/seed.ts — crear Configuracion inicial con id=1
npx prisma db seed
```

**Commit al terminar:**
```bash
git add . && git commit -m "feat: scaffolding inicial Next.js + Prisma + shadcn"
```

---

### FASE 2 — API Routes (backend completo)

Implementar en orden:

1. **`/api/configuracion/route.ts`**
   - `GET`: devuelve configuración + lista de personas activas
   - `PUT`: actualiza consecutivo base y turno

2. **`/api/personas/route.ts`**
   - `GET`: lista personas ordenadas por `orden`
   - `POST`: crear persona (al crear, asignar `orden = max(orden) + 1`)
   - `PUT /api/personas/[id]`: actualizar nombre/email/activo
   - `DELETE /api/personas/[id]`: soft delete (`activo = false`)

3. **`/api/radicados/route.ts`**
   - `POST`: endpoint principal. Body: `{ consecutivo, descripcion, creadoPor }`
     - Detectar gaps, asignar persona, guardar radicado
     - Responder con `{ radicado, personaAsignada, turnoSiguiente }`
   - `GET`: listar radicados con filtros `?mes=&anio=&personaId=`

4. **`/api/importar-excel/route.ts`**
   - `POST multipart/form-data`: recibe archivo Excel
   - Parsear con `exceljs`, procesar fila por fila
   - Retornar `{ procesados, errores, gaps }`

5. **`/api/informes/mensual/route.ts`**
   - `GET ?mes=7&anio=2026`
   - Retornar:
     ```json
     {
       "totalRadicados": 124,
       "totalGaps": 3,
       "porPersona": [{"nombre": "Ana", "total": 42}, ...],
       "porDia": [{"fecha": "2026-07-01", "total": 8}, ...]
     }
     ```

6. **`/api/exportar-excel/route.ts`**
   - `GET ?mes=7&anio=2026`
   - Generar Excel con exceljs:
     - Hoja 1: Resumen del mes (totales por persona y por día)
     - Hoja 2: Detalle completo (todos los radicados con consecutivo, persona, fecha)
     - Hoja 3: Consecutivos con GAPs marcados en rojo
   - Devolver como `application/octet-stream`

**Commit al terminar:**
```bash
git add . && git commit -m "feat: API routes completas con lógica de asignación y gaps"
```

---

### FASE 3 — Página de Configuración (`/configuracion`)

Diseño: panel limpio tipo "Setup Wizard" con dos secciones:

**Sección A — Personas del equipo**
- Tabla con columnas: Orden | Nombre | Email | Turno actual | Estado
- Botón "Agregar persona" → modal con formulario (nombre, email opcional)
- Drag-and-drop o flechas para reordenar (cambiar `orden`)
- Toggle activo/inactivo
- Indicador visual de quién tiene el turno AHORA (badge azul)

**Sección B — Configuración de consecutivos**
- Campo: "Consecutivo inicial" (para cuando se importa un Excel con histórico)
- Campo: "Turno inicial" (persona que empieza la rotación)
- Botón "Reiniciar turno" (vuelve al inicio de la rotación)
- Alert de advertencia antes de guardar cambios

**Commit al terminar:**
```bash
git add . && git commit -m "feat: página configuración con gestión de personas y turnos"
```

---

### FASE 4 — Página de Registro (`/registrar`)

Diseño: formulario centrado, minimalista, enfocado en velocidad de entrada.

**Formulario de registro manual:**
```
┌─────────────────────────────────┐
│  Consecutivo *    [ 00045    ]  │
│  Descripción      [ ________ ]  │
│  Registrado por   [ ________ ]  │
│                                 │
│  [  REGISTRAR RADICADO  ]       │
└─────────────────────────────────┘
```

**Al hacer submit:**
- Mostrar spinner mientras llama a `POST /api/radicados`
- Mostrar tarjeta de resultado:
  ```
  ✅ Radicado #00045 registrado
  👤 Asignado a: ANA MARTÍNEZ
  📅 Fecha: 29 Jul 2026 - 10:34 AM
  ⚡ Siguiente turno: CARLOS RUIZ
  ```
- Si hubo GAPs: `⚠️ Se detectaron 2 consecutivos sin radicado (43, 44)`

**Tab secundario: Importar desde Excel**
- Drop zone para archivo `.xlsx`
- Preview de las primeras 5 filas antes de importar
- Botón "Confirmar importación"
- Tabla de resultados: procesados / errores / gaps generados
- El Excel debe tener columnas: `consecutivo`, `descripcion`, `creadoPor`

**Commit al terminar:**
```bash
git add . && git commit -m "feat: registro manual e importación desde Excel"
```

---

### FASE 5 — Dashboard Principal (`/`)

Header con stats del día:
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ HOY      │ │ MES      │ │ GAPS     │ │ TURNO    │
│   12     │ │   89     │ │    1     │ │  CARLOS  │
│ radicados│ │ radicados│ │ este mes │ │ le toca  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

Tabla "Últimos 20 radicados":
- Columnas: # | Consecutivo | Persona | Registrado por | Fecha/hora | Badge (normal/GAP)
- Filas de GAPs en rojo suave con ícono ⚠️

Sidebar derecho (o sección inferior):
- Mini-gráfico de barras: radicados por día (últimos 7 días)
- Top personas del mes (ranking)

**Commit al terminar:**
```bash
git add . && git commit -m "feat: dashboard con stats en tiempo real"
```

---

### FASE 6 — Página de Consecutivos (`/consecutivos`)

Vista de línea de tiempo de consecutivos con estados visuales:

```
[ Filtrar por mes: Julio 2026 ▼ ]  [ Buscar consecutivo: _____ ]

#0041  ✅ Ana M.     29 Jul  10:01
#0042  ✅ Carlos R.  29 Jul  10:15
#0043  ⚠️ GAP        —       —        ← fila roja
#0044  ✅ Luis P.    29 Jul  11:02
#0045  ✅ Ana M.     29 Jul  11:30
```

- Paginación de 50 en 50
- Exportar vista filtrada a Excel
- Estadísticas: total asignados / total gaps / % completitud

**Commit al terminar:**
```bash
git add . && git commit -m "feat: vista de consecutivos con detección de gaps"
```

---

### FASE 7 — Informes Mensuales (`/informes`)

**Selector de mes/año** en la parte superior.

**Resumen ejecutivo:**
```
INFORME JULIO 2026
────────────────────────────────────
Total radicados asignados:   124
Total consecutivos GAP:        3  
Total personas activas:        4
────────────────────────────────────
```

**Tabla por persona:**
| Persona    | Radicados | % del mes | Días activos |
|------------|-----------|-----------|--------------|
| Ana M.     | 34        | 27.4%     | 18           |
| Carlos R.  | 32        | 25.8%     | 17           |

**Tabla por día** (para el reporte de fin de mes):
| Fecha          | Total | Ana | Carlos | Luis | Patricia |
|----------------|-------|-----|--------|------|----------|
| Lun 01 Jul     |   8   |  2  |   2    |  2   |    2     |
| Mar 02 Jul     |   5   |  2  |   1    |  1   |    1     |

**Botón prominente:**
```
[ 📥 Exportar Informe Completo Excel ]
```

**Commit al terminar:**
```bash
git add . && git commit -m "feat: informes mensuales con exportación Excel"
```

---

### FASE 8 — UI/UX Final y Navegación

**Layout global (`/app/layout.tsx`):**
- Sidebar izquierdo con navegación:
  ```
  🏠 Dashboard
  ➕ Registrar
  📋 Consecutivos  
  📊 Informes
  ⚙️  Configuración
  ```
- Header con: nombre del sistema + turno actual destacado
- Tema: limpio, profesional, colores neutros (gris/slate + azul índigo)
- Responsive (colapsable en móvil)

**Mejoras UX:**
- Toast notifications en todas las acciones (react-hot-toast o shadcn Toast)
- Skeleton loaders en tablas mientras cargan datos
- Confirmación en acciones destructivas (eliminar persona, reiniciar turno)
- Shortcut teclado: `Ctrl+R` → ir a /registrar

**Commit al terminar:**
```bash
git add . && git commit -m "feat: layout global, navegación y polish UX"
```

---

### FASE 9 — Preparación para Producción + Vercel

1. **Variables de entorno:**

Crear `.env.example`:
```env
# Desarrollo (SQLite)
DATABASE_URL="file:./dev.db"

# Producción (Vercel Postgres o Neon)
# DATABASE_URL="postgresql://user:pass@host:5432/radicadoflow"
```

2. **Adaptar Prisma para producción:**
   - En `package.json` agregar: `"postinstall": "prisma generate"`
   - En `prisma/schema.prisma` comentar SQLite, dejar PostgreSQL como opción con env var

3. **`vercel.json`** (si es necesario para rutas o build):
```json
{
  "buildCommand": "npx prisma generate && next build",
  "devCommand": "next dev",
  "installCommand": "npm install"
}
```

4. **`README.md`** con instrucciones de deploy:
```markdown
## Deploy a Vercel

1. Push este repo a GitHub
2. Ir a vercel.com → New Project → importar repo
3. Configurar variable: DATABASE_URL (Vercel Postgres o Neon)
4. Deploy automático activado en cada push a main
```

**Push final:**
```bash
git add .
git commit -m "feat: configuración producción + Vercel ready"
git push origin main
```

---

### FASE 10 — GitHub Actions (opcional, CI)

Crear `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '20' }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run build
```

**Commit:**
```bash
git add . && git commit -m "ci: GitHub Actions workflow"
git push origin main
```

---

## RESUMEN DE COMANDOS INICIALES PARA CLAUDE CODE

Cuando inicies Claude Code, ejecuta esto primero:

```bash
# 1. Crear repo en GitHub (hazlo manualmente o con gh CLI)
gh repo create radicadoflow --public --description "Sistema de asignación de radicados"

# 2. Claude Code tomará el CLAUDE.md desde aquí y ejecutará las fases
# Simplemente inicia con: claude
```

---

## NOTAS IMPORTANTES

- **Consecutivo**: es un número entero, único, que puede venir del Excel importado
- **GAP**: cuando el consecutivo salta (ej: llega el 47 y el 46 no existía), el 46 queda como GAP
- **Turno**: es el índice circular. Si hay 4 personas (0,1,2,3), el turno rota: 0→1→2→3→0...
- **Un consecutivo sin asignación** = no consume turno. Solo los radicados reales rotan el turno
- **El informe de fin de mes** = tabla por persona + tabla por día, exportable a Excel
- **La persona que registra** (creadoPor) ≠ persona asignada. Cualquiera puede registrar, pero el sistema decide quién recibe el trabajo

---

## ARCHIVOS QUE CLAUDE CODE NO DEBE MODIFICAR

- `prisma/migrations/` (solo agregar, nunca borrar)
- `.env` (solo `.env.example` va al repo)
- `CLAUDE.md` (este archivo)
