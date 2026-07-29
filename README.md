# RadicadoFlow

Sistema de asignación automática de radicados para equipos de
auditoría/facturación de salud. Cuando el responsable registra un
radicado (glosa, factura o devolución), el sistema lo asigna
automáticamente al siguiente auditor en turno (rotación circular) y
detecta consecutivos sin radicado (GAPs).

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Prisma ORM + PostgreSQL (misma base en dev y en prod)
- exceljs para importar/exportar Excel
- date-fns para fechas

## Desarrollo local

Necesitas una base PostgreSQL (Vercel Postgres o [Neon](https://neon.tech),
ambos tienen plan gratuito). Copia su cadena de conexión a `.env`.

```bash
npm install
cp .env.example .env   # y pega tu DATABASE_URL real
npx prisma db push
npx prisma db seed
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Empieza por
`/configuracion` para dar de alta al equipo y su orden de rotación.

## Estructura

```
/app
  /page.tsx                    Dashboard principal
  /configuracion/page.tsx      Setup de personas y turnos
  /registrar/page.tsx          Registro manual + importación Excel
  /consecutivos/page.tsx       Línea de tiempo de consecutivos y gaps
  /informes/page.tsx           Informe mensual + exportación Excel
  /api/...                     Rutas de la API (ver CLAUDE.md)
```

## Deploy a Vercel

1. Push este repo a GitHub.
2. Ir a [vercel.com](https://vercel.com) → New Project → importar el repo.
3. Configurar la variable de entorno `DATABASE_URL` con una base
   Postgres (Vercel Postgres/Storage o [Neon](https://neon.tech)).
4. Antes o después del primer deploy, correr `npx prisma db push`
   apuntando a esa base (con `DATABASE_URL` en el entorno) para crear
   las tablas — el build de Vercel no lo hace automáticamente.
5. Deploy automático activado en cada push a `master` (ver
   `.github/workflows/ci.yml` para la validación previa).
