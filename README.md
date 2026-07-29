# RadicadoFlow

Sistema de asignación automática de radicados para equipos de
auditoría/facturación de salud. Cuando el responsable registra un
radicado (glosa, factura o devolución), el sistema lo asigna
automáticamente al siguiente auditor en turno (rotación circular) y
detecta consecutivos sin radicado (GAPs).

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Prisma ORM + SQLite (dev) / PostgreSQL (prod)
- exceljs para importar/exportar Excel
- date-fns para fechas

## Desarrollo local

```bash
npm install
cp .env.example .env
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
   Postgres (Vercel Postgres o [Neon](https://neon.tech)).
4. En `prisma/schema.prisma`, cambiar `provider = "sqlite"` por
   `provider = "postgresql"` en el bloque `datasource db` antes de
   desplegar a producción.
5. Deploy automático activado en cada push a `main` (ver
   `.github/workflows/ci.yml` para la validación previa).
