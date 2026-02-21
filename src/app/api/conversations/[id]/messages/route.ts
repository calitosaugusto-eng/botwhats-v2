// ===========================================
// CONVERSATION MESSAGES API
// ===========================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const clientId = searchParams.get('clientId') || 'default'

    // Buscar mensagens da conversa
    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        clientId
      },
      orderBy: { createdAt: 'asc' },
      take: 100
    })

    return NextResponse.json({ success: true, messages })
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar mensagens' },
      { status: 500 }
    )
  }
}
