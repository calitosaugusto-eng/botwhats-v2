// ===========================================
// API PARA ATENDENTE HUMANO RESPONDER
// ===========================================
// Quando o humano envia uma mensagem:
// 1. Marca humanTakeover = true (bot para de responder)
// 2. Envia mensagem via WhatsApp API
// 3. Salva no banco de dados

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const body = await request.json()
    const { message, clientId } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Mensagem é obrigatória' },
        { status: 400 }
      )
    }

    // 1. Buscar conversa
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { client: true }
    })

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversa não encontrada' },
        { status: 404 }
      )
    }

    // 2. MARCAR HUMAN TAKEOVER
    // Na primeira mensagem do humano, o bot para de responder
    const wasBotActive = !conversation.humanTakeover
    
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { 
        humanTakeover: true,
        updatedAt: new Date()
      }
    })

    console.log(`👤 Humano assumiu conversa ${conversationId}. Bot DESATIVADO nesta conversa.`)

    // 3. Enviar mensagem via WhatsApp
    try {
      await sendWhatsAppMessage(conversation.phone, message)
    } catch (sendError) {
      console.error('Erro ao enviar via WhatsApp:', sendError)
      // Continua mesmo com erro - salva no banco
    }

    // 4. Salvar mensagem no banco
    const savedMessage = await prisma.message.create({
      data: {
        clientId: conversation.clientId,
        conversationId: conversationId,
        direction: 'outbound',
        type: 'text',
        content: message,
        status: 'sent',
        isFromBot: false // Mensagem de HUMANO, não do bot
      }
    })

    return NextResponse.json({
      success: true,
      message: savedMessage,
      humanTakeover: true,
      wasBotActive // Indica se o bot estava ativo antes
    })

  } catch (error) {
    console.error('Erro ao enviar resposta humana:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno' },
      { status: 500 }
    )
  }
}
