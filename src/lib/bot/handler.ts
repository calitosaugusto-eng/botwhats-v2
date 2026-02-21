// ===========================================
// BOT HANDLER - Processamento de Mensagens
// ===========================================
// Sistema completo com:
// - Captura automática de nome
// - Sistema de agendamentos
// - Human Takeover
// - Isolamento por cliente

import { sendWhatsAppMessage } from '@/lib/whatsapp/client'
import { processWithAI } from '@/lib/bot/ai'
import { prisma } from '@/lib/db'
import { 
  identifyContact, 
  saveContactName, 
  getConversationContext,
  setConversationContext,
  clearConversationContext,
  detectSchedulingIntent,
  generateWelcomeMessage,
  parseDateFromMessage
} from '@/lib/contacts'
import {
  checkAvailability,
  createAppointment,
  getAvailableSlots,
  getAppointmentsForDay
} from '@/lib/appointments'

// ===========================================
// TIPOS
// ===========================================
interface IncomingMessage {
  from: string
  messageId: string
  timestamp: string
  type: string
  text?: string
  contact?: {
    profile?: {
      name?: string
    }
    wa_id: string
  }
  metadata?: {
    display_phone_number: string
    phone_number_id: string
  }
}

// ===========================================
// FUNÇÃO PRINCIPAL
// ===========================================
export async function handleIncomingMessage(data: IncomingMessage) {
  const { from, messageId, type, text, contact, metadata } = data

  console.log(`🔔 Mensagem recebida de ${from}: ${text}`)

  try {
    // ========================================
    // 1. IDENTIFICAR CLIENTE (Estabelecimento)
    // ========================================
    // Cada estabelecimento tem seu próprio WhatsApp conectado
    const phoneNumberId = metadata?.phone_number_id
    
    let client = await prisma.client.findFirst({
      where: { 
        OR: [
          { phone: phoneNumberId },
          { id: 'default' } // Cliente padrão para testes
        ]
      },
      include: { 
        settings: true,
        services: { where: { isActive: true } },
        professionals: { where: { isActive: true } }
      }
    })

    if (!client) {
      client = await prisma.client.findFirst({
        include: { 
          settings: true,
          services: { where: { isActive: true } },
          professionals: { where: { isActive: true } }
        }
      })
      
      if (!client) {
        client = await prisma.client.create({
          data: {
            name: 'Cliente Padrão',
            slug: 'default',
            niche: 'salao',
            phone: phoneNumberId || from,
          },
          include: { 
            settings: true,
            services: true,
            professionals: true
          }
        })
      }
    }

    // ========================================
    // 2. BUSCAR OU CRIAR CONVERSA
    // ========================================
    let conversation = await prisma.conversation.findFirst({
      where: {
        clientId: client.id,
        phone: from,
        status: 'active'
      },
      include: { 
        member: true,
        messages: { 
          take: 10, 
          orderBy: { createdAt: 'desc' } 
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const isNewConversation = !conversation

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          clientId: client.id,
          phone: from,
          status: 'active',
          humanTakeover: false,
          awaitingName: true
        },
        include: { 
          member: true,
          messages: true 
        }
      })
    }

    // ========================================
    // 3. SALVAR MENSAGEM RECEBIDA
    // ========================================
    await prisma.message.create({
      data: {
        clientId: client.id,
        conversationId: conversation.id,
        direction: 'inbound',
        type: type || 'text',
        content: text || '',
        status: 'delivered',
        isFromBot: false,
        metadata: { messageId, contact }
      }
    })

    // ========================================
    // 4. VERIFICAR HUMAN TAKEOVER
    // ========================================
    if (conversation.humanTakeover) {
      console.log(`👤 Humano assumiu esta conversa. Bot não responderá.`)
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() }
      })
      return
    }

    // ========================================
    // 5. PROCESSAR MENSAGEM
    // ========================================
    let response: string

    if (type !== 'text' || !text) {
      response = getNotSupportedMessage()
    } else {
      response = await processMessage({
        text,
        client,
        conversation,
        member: conversation.member,
        isNewConversation
      })
    }

    // ========================================
    // 6. ENVIAR RESPOSTA
    // ========================================
    await sendWhatsAppMessage(from, response)

    // ========================================
    // 7. SALVAR RESPOSTA
    // ========================================
    await prisma.message.create({
      data: {
        clientId: client.id,
        conversationId: conversation.id,
        direction: 'outbound',
        type: 'text',
        content: response,
        status: 'sent',
        isFromBot: true
      }
    })

    // ========================================
    // 8. ATUALIZAR CONVERSA
    // ========================================
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() }
    })

    console.log(`✅ Resposta enviada para ${from}`)

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error)
    
    try {
      await sendWhatsAppMessage(from, getErrorMessage())
    } catch (sendError) {
      console.error('Erro ao enviar mensagem de erro:', sendError)
    }
  }
}

// ===========================================
// PROCESSADOR DE MENSAGEM
// ===========================================
async function processMessage(params: {
  text: string
  client: any
  conversation: any
  member: any
  isNewConversation: boolean
}): Promise<string> {
  const { text, client, conversation, member, isNewConversation } = params
  const lowerText = text.toLowerCase().trim()

  // ========================================
  // FLUXO 1: NOVA CONVERSA - SAUDAÇÃO
  // ========================================
  if (isNewConversation || conversation.messages?.length <= 1) {
    const timeOfDay = getTimeOfDay()
    const businessName = client.name || 'estabelecimento'
    return generateWelcomeMessage(businessName, timeOfDay)
  }

  // ========================================
  // FLUXO 2: CAPTURA DE NOME
  // ========================================
  if (conversation.awaitingName && !member) {
    // Verificar se a mensagem parece ser um nome
    const isProbablyName = lowerText.length >= 2 && 
      !lowerText.includes('quero') && 
      !lowerText.includes('gostaria') &&
      !lowerText.includes('agendar') &&
      !lowerText.includes('horário') &&
      lowerText.split(' ').length <= 4

    if (isProbablyName) {
      const result = await saveContactName(
        client.id,
        conversation.phone,
        text,
        conversation.id
      )

      if (result.success) {
        const savedMember = await prisma.member.findUnique({
          where: { id: result.memberId }
        })
        
        return `Prazer, ${savedMember?.name}! 😊

Como posso te ajudar hoje?

📋 *Opções:*
• Agendar horário
• Ver serviços e valores
• Falar com atendente

É só me dizer o que precisa!`
      }
    }
    
    // Se não parece nome, pedir novamente
    return `Desculpe, não entendi seu nome. 

Pode me dizer como posso te chamar?`
  }

  // ========================================
  // FLUXO 3: SISTEMA DE AGENDAMENTO
  // ========================================
  const schedulingIntent = detectSchedulingIntent(text)
  
  if (schedulingIntent.isScheduling) {
    return await handleSchedulingFlow({
      text,
      client,
      conversation,
      member,
      intent: schedulingIntent
    })
  }

  // ========================================
  // FLUXO 4: VER HORÁRIOS DISPONÍVEIS
  // ========================================
  if (lowerText.includes('horário') && (lowerText.includes('ver') || lowerText.includes('disponível') || lowerText.includes('quais'))) {
    return await handleShowAvailableSlots(client, conversation)
  }

  // ========================================
  // FLUXO 5: VER SERVIÇOS
  // ========================================
  if (lowerText.includes('serviço') || lowerText.includes('valor') || lowerText.includes('preço')) {
    return handleShowServices(client)
  }

  // ========================================
  // FLUXO 6: FALAR COM ATENDENTE
  // ========================================
  if (lowerText.includes('atendente') || lowerText.includes('humano') || lowerText.includes('falar com')) {
    // Marcar para humano assumir
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { humanTakeover: true }
    })
    
    return `Perfeito! Vou transferir você para um atendente humano. 

Aguarde um momento que já irão te responder. 👩‍💼`
  }

  // ========================================
  // FLUXO 7: PROCESSAR COM IA
  // ========================================
  return await processWithAI({
    message: text,
    clientId: client.id,
    conversationId: conversation.id,
    member: member,
    niche: client.niche
  })
}

// ===========================================
// HANDLER: FLUXO DE AGENDAMENTO
// ===========================================
async function handleSchedulingFlow(params: {
  text: string
  client: any
  conversation: any
  member: any
  intent: any
}): Promise<string> {
  const { text, client, conversation, member, intent } = params

  // Buscar contexto da conversa
  let context = await getConversationContext(conversation.id)
  
  // Se não tem contexto, iniciar fluxo de agendamento
  if (!context || context.step === 'idle') {
    // Tentar extrair data da mensagem
    const date = parseDateFromMessage(text)
    
    if (!date) {
      // Perguntar a data
      await setConversationContext(conversation.id, {
        step: 'waiting_date',
        data: { service: intent.service }
      })
      
      return `Ótimo! Vou te ajudar a agendar! 📅

Para qual dia você gostaria de agendar?

*Exemplos:*
• hoje
• amanhã  
• segunda-feira
• 15/01`
    }

    // Se tem data mas não tem horário
    if (date && !intent.time) {
      const slots = await getAvailableSlots(client.id, date, 60)
      const availableSlots = slots.filter(s => s.available).slice(0, 8)
      
      if (availableSlots.length === 0) {
        return `Infelizmente não tenho horários disponíveis para ${formatDate(date)}. 😔

Quer tentar outro dia?`
      }

      await setConversationContext(conversation.id, {
        step: 'waiting_time',
        data: { 
          date: date.toISOString(),
          service: intent.service
        }
      })

      const slotsText = availableSlots
        .map(s => `• ${s.time}`)
        .join('\n')

      return `Tenho os seguintes horários disponíveis para ${formatDate(date)}:

${slotsText}

Qual horário você prefere?`
    }

    // Se tem data e horário
    if (date && intent.time) {
      return await tryCreateAppointment({
        clientId: client.id,
        memberId: member?.id,
        date,
        time: intent.time,
        service: intent.service,
        conversationId: conversation.id
      })
    }
  }

  // ========================================
  // STEP: AGUARDANDO DATA
  // ========================================
  if (context?.step === 'waiting_date') {
    const date = parseDateFromMessage(text)
    
    if (!date) {
      return `Não consegui entender a data. 

Pode me dizer de outra forma? Por exemplo:
• amanhã
• segunda-feira
• 20/01`
    }

    const slots = await getAvailableSlots(client.id, date, 60)
    const availableSlots = slots.filter(s => s.available).slice(0, 8)
    
    if (availableSlots.length === 0) {
      return `Não tenho horários disponíveis para ${formatDate(date)}. 😔

Quer tentar outro dia?`
    }

    await setConversationContext(conversation.id, {
      step: 'waiting_time',
      data: { 
        ...context.data,
        date: date.toISOString()
      }
    })

    const slotsText = availableSlots
      .map(s => `• ${s.time}`)
      .join('\n')

    return `Perfeito! Horários disponíveis para ${formatDate(date)}:

${slotsText}

Qual você prefere?`
  }

  // ========================================
  // STEP: AGUARDANDO HORÁRIO
  // ========================================
  if (context?.step === 'waiting_time') {
    const timeMatch = text.match(/(\d{1,2})[:h]?(\d{2})?/)
    
    if (!timeMatch) {
      return `Não entendi o horário. 

Pode me dizer apenas o número? Exemplo: 14 ou 14:30`
    }

    const time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2] || '00'}`
    const date = new Date(context.data.date)

    return await tryCreateAppointment({
      clientId: client.id,
      memberId: member?.id,
      date,
      time,
      service: context.data.service,
      conversationId: conversation.id
    })
  }

  // Fallback
  return await processWithAI({
    message: text,
    clientId: client.id,
    conversationId: conversation.id,
    member,
    niche: client.niche
  })
}

// ===========================================
// CRIAR AGENDAMENTO
// ===========================================
async function tryCreateAppointment(params: {
  clientId: string
  memberId?: string
  date: Date
  time: string
  service?: string
  conversationId: string
}): Promise<string> {
  const { clientId, memberId, date, time, service, conversationId } = params

  // Buscar serviço
  let serviceRecord = null
  if (service) {
    serviceRecord = await prisma.service.findFirst({
      where: {
        clientId,
        name: { contains: service, mode: 'insensitive' }
      }
    })
  }

  const duration = serviceRecord?.duration || 60

  const result = await createAppointment({
    clientId,
    memberId,
    date,
    startTime: time,
    duration,
    serviceId: serviceRecord?.id,
    price: serviceRecord?.price
  })

  if (!result.success) {
    // Limpar contexto
    await clearConversationContext(conversationId)
    
    return `Desculpe, não consegui agendar. ${result.error}

Quer tentar outro horário?`
  }

  // Limpar contexto
  await clearConversationContext(conversationId)

  const apt = result.appointment

  return `✅ *Agendamento Confirmado!*

📅 Data: ${formatDate(date)}
⏰ Horário: ${time}
${serviceRecord ? `💅 Serviço: ${serviceRecord.name}` : ''}
${serviceRecord?.price ? `💰 Valor: R$ ${serviceRecord.price.toFixed(2)}` : ''}

Você receberá um lembrete antes do horário. 

Precisa de mais alguma coisa?`
}

// ===========================================
// HANDLER: MOSTRAR HORÁRIOS
// ===========================================
async function handleShowAvailableSlots(client: any, conversation: any): Promise<string> {
  const today = new Date()
  const slots = await getAvailableSlots(client.id, today, 60)
  const availableSlots = slots.filter(s => s.available).slice(0, 10)
  
  if (availableSlots.length === 0) {
    return `Não tenho horários disponíveis para hoje. 😔

Quer ver horários de amanhã?`
  }

  const slotsText = availableSlots
    .map(s => `• ${s.time}`)
    .join('\n')

  return `📅 *Horários disponíveis hoje:*

${slotsText}

Qual você gostaria de agendar?`
}

// ===========================================
// HANDLER: MOSTRAR SERVIÇOS
// ===========================================
function handleShowServices(client: any): string {
  const services = client.services || []
  
  if (services.length === 0) {
    return `No momento não tenho os serviços cadastrados.

Quer falar com um atendente para mais informações?`
  }

  const servicesText = services
    .slice(0, 8)
    .map((s: any) => `• ${s.name} - R$ ${s.price?.toFixed(2) || 'a combinar'}`)
    .join('\n')

  return `📋 *Nossos Serviços:*

${servicesText}

Quer agendar algum desses serviços?`
}

// ===========================================
// FUNÇÕES AUXILIARES
// ===========================================
function getTimeOfDay(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'manha'
  if (hour >= 12 && hour < 18) return 'tarde'
  return 'noite'
}

function formatDate(date: Date): string {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  if (date.toDateString() === today.toDateString()) return 'hoje'
  if (date.toDateString() === tomorrow.toDateString()) return 'amanhã'
  
  const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  
  return `${days[date.getDay()]}, ${date.getDate()}/${months[date.getMonth()]}`
}

function getNotSupportedMessage(): string {
  return `🤖 No momento só consigo processar mensagens de texto.

Digite sua dúvida ou mensagem que terei prazer em ajudar!`
}

function getErrorMessage(): string {
  return `🤖 Desculpe, ocorreu um erro ao processar sua mensagem.

Por favor, tente novamente em alguns instantes.`
}
