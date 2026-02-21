// ===========================================
// CAPTURA AUTOMÁTICA DE NOME/CONTATO
// ===========================================
// Sistema que identifica novos contatos e solicita o nome
// Salva automaticamente no banco vinculado ao clientId

import { prisma } from '@/lib/db'

// ===========================================
// TIPOS
// ===========================================
interface ContactInfo {
  isNew: boolean
  memberId?: string
  memberName?: string
  awaitingName: boolean
}

interface ConversationContext {
  step: string
  data: Record<string, any>
}

// ===========================================
// VERIFICAR/REGISTRAR CONTATO
// ===========================================
export async function identifyContact(
  clientId: string,
  phone: string,
  conversationId: string
): Promise<ContactInfo> {
  
  // Buscar membro existente
  const existingMember = await prisma.member.findUnique({
    where: {
      clientId_phone: {
        clientId,
        phone
      }
    }
  })
  
  if (existingMember) {
    // Contato já existe - atualizar conversa
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        memberId: existingMember.id,
        awaitingName: false
      }
    })
    
    return {
      isNew: false,
      memberId: existingMember.id,
      memberName: existingMember.name,
      awaitingName: false
    }
  }
  
  // Novo contato - verificar se a conversa está aguardando nome
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId }
  })
  
  return {
    isNew: true,
    awaitingName: conversation?.awaitingName ?? true
  }
}

// ===========================================
// SALVAR NOME DO CONTATO
// ===========================================
export async function saveContactName(
  clientId: string,
  phone: string,
  name: string,
  conversationId: string
): Promise<{ success: boolean; memberId?: string; error?: string }> {
  
  try {
    // Limpar nome
    const cleanName = name.trim()
      .replace(/^(meu nome é |eu me chamo |sou a |sou o |é |nome: )/i, '')
      .trim()
    
    if (cleanName.length < 2) {
      return { success: false, error: 'Nome muito curto' }
    }
    
    // Verificar se já existe
    const existing = await prisma.member.findUnique({
      where: {
        clientId_phone: {
          clientId,
          phone
        }
      }
    })
    
    if (existing) {
      // Atualizar nome se existir
      await prisma.member.update({
        where: { id: existing.id },
        data: { name: cleanName }
      })
      
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          memberId: existing.id,
          awaitingName: false
        }
      })
      
      return { success: true, memberId: existing.id }
    }
    
    // Criar novo membro
    const newMember = await prisma.member.create({
      data: {
        clientId,
        name: cleanName,
        phone,
        status: 'active'
      }
    })
    
    // Atualizar conversa
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        memberId: newMember.id,
        awaitingName: false
      }
    })
    
    return { success: true, memberId: newMember.id }
    
  } catch (error) {
    console.error('Erro ao salvar contato:', error)
    return { success: false, error: 'Erro ao salvar contato' }
  }
}

// ===========================================
// GERENCIAR CONTEXTO DA CONVERSA
// ===========================================
export async function getConversationContext(conversationId: string): Promise<ConversationContext | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId }
  })
  
  if (!conversation || !conversation.context) {
    return null
  }
  
  try {
    return JSON.parse(conversation.context)
  } catch {
    return null
  }
}

export async function setConversationContext(
  conversationId: string,
  context: ConversationContext
): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      context: JSON.stringify(context)
    }
  })
}

export async function clearConversationContext(conversationId: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      context: null
    }
  })
}

// ===========================================
// DETECTAR INTENÇÃO DE AGENDAMENTO
// ===========================================
export function detectSchedulingIntent(message: string): {
  isScheduling: boolean
  date?: string
  time?: string
  service?: string
} {
  const lowerMsg = message.toLowerCase()
  
  // Palavras-chave de agendamento
  const schedulingKeywords = [
    'agendar', 'marcar', 'horário', 'hora', 'reservar',
    'queria marcar', 'gostaria de agendar', 'posso agendar',
    'tem horário', 'tem vaga', 'disponível', 'disponibilidade'
  ]
  
  const isScheduling = schedulingKeywords.some(kw => lowerMsg.includes(kw))
  
  if (!isScheduling) {
    return { isScheduling: false }
  }
  
  // Tentar extrair data
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})(\/\d{2,4})?/,  // 15/01 ou 15/01/2024
    /(hoje|amanhã|depois de amanhã)/i,
    /(segunda|terça|quarta|quinta|sexta|sábado|domingo)/i,
    /próxim[oa] (segunda|terça|quarta|quinta|sexta|sábado|domingo)/i
  ]
  
  let detectedDate: string | undefined
  
  for (const pattern of datePatterns) {
    const match = lowerMsg.match(pattern)
    if (match) {
      detectedDate = match[0]
      break
    }
  }
  
  // Tentar extrair horário
  const timeMatch = lowerMsg.match(/(\d{1,2})(?::(\d{2}))?(?:\s*(h|horas?))?/i)
  const detectedTime = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2] || '00'}` : undefined
  
  // Tentar extrair serviço
  const serviceKeywords = ['corte', 'coloração', 'manicure', 'pedicure', 'barba', 'sobrancelha', 'escova', 'hidratação']
  const detectedService = serviceKeywords.find(s => lowerMsg.includes(s))
  
  return {
    isScheduling: true,
    date: detectedDate,
    time: detectedTime,
    service: detectedService
  }
}

// ===========================================
// GERAR RESPOSTA DE BOAS-VINDAS
// ===========================================
export function generateWelcomeMessage(businessName: string, timeOfDay: string): string {
  const greetings: Record<string, string> = {
    'manha': `Bom dia! ☀️`,
    'tarde': `Boa tarde! 🌤️`,
    'noite': `Boa noite! 🌙`
  }
  
  return `${greetings[timeOfDay] || 'Olá!'} 

Sou a assistente virtual do ${businessName}! 👋

Para começar, como posso te chamar?`
}

// ===========================================
// FORMATAR DATA PARA EXIBIÇÃO
// ===========================================
export function formatDate(date: Date): string {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const dateStr = date.toDateString()
  
  if (dateStr === today.toDateString()) return 'hoje'
  if (dateStr === tomorrow.toDateString()) return 'amanhã'
  
  const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  
  return `${days[date.getDay()]}, ${date.getDate()}/${months[date.getMonth()]}`
}

// ===========================================
// PARSEAR DATA DE MENSAGEM
// ===========================================
export function parseDateFromMessage(message: string): Date | null {
  const lowerMsg = message.toLowerCase()
  const today = new Date()
  
  // Hoje
  if (lowerMsg.includes('hoje')) {
    return today
  }
  
  // Amanhã
  if (lowerMsg.includes('amanhã') || lowerMsg.includes('amanha')) {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow
  }
  
  // Dia da semana
  const daysMap: Record<string, number> = {
    'domingo': 0, 'segunda': 1, 'terça': 2, 'quarta': 3,
    'quinta': 4, 'sexta': 5, 'sábado': 6
  }
  
  for (const [day, targetDay] of Object.entries(daysMap)) {
    if (lowerMsg.includes(day)) {
      const result = new Date(today)
      const currentDay = today.getDay()
      let daysUntil = targetDay - currentDay
      
      // Se "próximo(a)", avança uma semana
      if (lowerMsg.includes('próxim') || lowerMsg.includes('proxim')) {
        daysUntil += 7
      }
      
      // Se o dia já passou nesta semana, avança para próxima
      if (daysUntil <= 0) {
        daysUntil += 7
      }
      
      result.setDate(result.getDate() + daysUntil)
      return result
    }
  }
  
  // Data específica (15/01, 15/01/2024)
  const dateMatch = lowerMsg.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (dateMatch) {
    const day = parseInt(dateMatch[1])
    const month = parseInt(dateMatch[2]) - 1
    let year = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear()
    if (year < 100) year += 2000
    
    return new Date(year, month, day)
  }
  
  return null
}
