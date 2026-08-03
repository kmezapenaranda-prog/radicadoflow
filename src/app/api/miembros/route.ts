import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { empresaId } = await requireRole(['admin'])

    const miembros = await prisma.usuario.findMany({
      where: { empresaId },
      orderBy: { nombre: 'asc' },
    })

    return NextResponse.json({
      miembros: miembros.map((m) => ({
        id: m.id,
        userId: m.id,
        nombre: m.nombre,
        email: m.email,
        perfil: m.perfil,
        debeCambiarPassword: m.debeCambiarPassword,
      })),
    })
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
