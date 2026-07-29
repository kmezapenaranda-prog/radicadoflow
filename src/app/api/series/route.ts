import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const series = await prisma.serie.findMany({ orderBy: { codigo: 'asc' } })
  return NextResponse.json({ series })
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
