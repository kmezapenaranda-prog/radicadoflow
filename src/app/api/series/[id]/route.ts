import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  }

  try {
    const { empresaId } = await requireRole(['admin', 'creador'])
    const body = await request.json()
    const { distribuible, consecutivoActual } = body as {
      distribuible?: boolean
      consecutivoActual?: number
    }

    const data: Record<string, unknown> = {}
    if (typeof distribuible === 'boolean') data.distribuible = distribuible
    if (typeof consecutivoActual === 'number') data.consecutivoActual = consecutivoActual

    const { count } = await prisma.serie.updateMany({ where: { id, empresaId }, data })
    if (count === 0) {
      return NextResponse.json({ error: 'Serie no encontrada' }, { status: 404 })
    }
    const serie = await prisma.serie.findUnique({ where: { id } })
    return NextResponse.json({ serie })
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
