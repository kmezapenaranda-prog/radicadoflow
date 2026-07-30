import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NoEmpresaError, requireEmpresaId } from '@/lib/tenant'
import { ForbiddenError, requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const empresaId = await requireEmpresaId()
    const series = await prisma.serie.findMany({ where: { empresaId }, orderBy: { codigo: 'asc' } })
    // El "Id" (idExterno) es una secuencia global, compartida entre todas las
    // series (CUEM, CUPE, UCI...) de esta empresa, no independiente por serie.
    const { _max } = await prisma.radicado.aggregate({
      where: { empresaId },
      _max: { idExterno: true },
    })
    const proximoIdExterno = (_max.idExterno ?? 0) + 1
    return NextResponse.json({ series, proximoIdExterno })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { empresaId } = await requireRole(['admin', 'creador'])
    const body = await request.json()
    const { codigo, distribuible, consecutivoActual } = body as {
      codigo?: string
      distribuible?: boolean
      consecutivoActual?: number
    }

    if (!codigo || !codigo.trim()) {
      return NextResponse.json({ error: 'El código de la serie es obligatorio' }, { status: 400 })
    }

    const serie = await prisma.serie.create({
      data: {
        empresaId,
        codigo: codigo.trim().toUpperCase(),
        distribuible: distribuible ?? true,
        consecutivoActual: consecutivoActual ?? 0,
      },
    })

    return NextResponse.json({ serie }, { status: 201 })
  } catch (error) {
    if (error instanceof NoEmpresaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una serie con ese código' }, { status: 400 })
    }
    throw error
  }
}
