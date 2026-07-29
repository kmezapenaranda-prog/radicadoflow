import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  }

  const body = await request.json()
  const { distribuible, consecutivoActual } = body as {
    distribuible?: boolean
    consecutivoActual?: number
  }

  const data: Record<string, unknown> = {}
  if (typeof distribuible === 'boolean') data.distribuible = distribuible
  if (typeof consecutivoActual === 'number') data.consecutivoActual = consecutivoActual

  try {
    const serie = await prisma.serie.update({ where: { id }, data })
    return NextResponse.json({ serie })
  } catch {
    return NextResponse.json({ error: 'Serie no encontrada' }, { status: 404 })
  }
}
