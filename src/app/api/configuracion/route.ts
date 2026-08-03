import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'
import { obtenerUsuarioSesion } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sesion = await obtenerUsuarioSesion()
  if (!sesion) {
    return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })
  }

  const usuario = { nombre: sesion.nombre, email: sesion.email }

  // Sin empresa activa (típico del super admin recién ingresado, antes de
  // elegir/crear una) no hay nada de negocio que devolver todavía, pero el
  // cliente sigue necesitando saber quién es y si es super admin.
  if (!sesion.empresaId) {
    return NextResponse.json({
      configuracion: null,
      personas: [],
      personaEnTurno: null,
      series: [],
      perfil: null,
      esSuperAdmin: sesion.esSuperAdmin,
      empresa: null,
      usuario,
    })
  }

  const empresaId = sesion.empresaId

  const [configuracion, personas, series, empresa] = await Promise.all([
    prisma.configuracion.upsert({ where: { empresaId }, update: {}, create: { empresaId } }),
    prisma.persona.findMany({ where: { empresaId, activo: true }, orderBy: { orden: 'asc' } }),
    prisma.serie.findMany({ where: { empresaId }, orderBy: { codigo: 'asc' } }),
    prisma.empresa.findUnique({ where: { id: empresaId } }),
  ])

  const personaEnTurno = personas.length > 0 ? personas[configuracion.turnoActual % personas.length] : null

  return NextResponse.json({
    configuracion,
    personas,
    personaEnTurno,
    series,
    perfil: sesion.perfil,
    esSuperAdmin: sesion.esSuperAdmin,
    empresa,
    usuario,
  })
}

export async function PUT(request: NextRequest) {
  try {
    const { empresaId } = await requireRole(['admin', 'creador'])
    const body = await request.json()
    const { turnoActual } = body as { turnoActual?: number }

    const data: { turnoActual?: number } = {}
    if (typeof turnoActual === 'number') data.turnoActual = turnoActual

    const configuracion = await prisma.configuracion.upsert({
      where: { empresaId },
      update: data,
      create: { empresaId, ...data },
    })

    return NextResponse.json({ configuracion })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }
}
