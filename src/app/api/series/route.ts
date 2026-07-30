import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const series = await prisma.serie.findMany({ orderBy: { codigo: 'asc' } })
  // El "Id" (idExterno) es una secuencia global, compartida entre todas las
  // series (CUEM, CUPE, UCI...), no independiente por serie.
  const { _max } = await prisma.radicado.aggregate({ _max: { idExterno: true } })
  const proximoIdExterno = (_max.idExterno ?? 0) + 1
  return NextResponse.json({ series, proximoIdExterno })
}

export async function POST(request: NextRequest) {
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
      codigo: codigo.trim().toUpperCase(),
      distribuible: distribuible ?? true,
      consecutivoActual: consecutivoActual ?? 0,
    },
  })

  return NextResponse.json({ serie }, { status: 201 })
}
