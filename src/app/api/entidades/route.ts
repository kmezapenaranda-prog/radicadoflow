import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError, requireEmpresaId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const empresaId = await requireEmpresaId()
    const entidades = await prisma.entidad.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } })
    return NextResponse.json({ entidades })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}
