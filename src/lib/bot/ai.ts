// ===========================================
// AI PROCESSOR - Processamento com IA HUMANIZADO
// ===========================================

import ZAI from 'z-ai-web-dev-sdk'
import { prisma } from '@/lib/db'
import type { Member, NicheType } from '@/types'

interface AIProcessorParams {
  message: string
  clientId: string
  conversationId: string
  member?: Member | null
  niche: string
}

// Contextos específicos por nicho - MAIS HUMANOS
const NICHE_CONTEXTS: Record<NicheType, string> = {
  sindicato: `Você é um atendente virtual de um SINDICATO, mas conversa como uma pessoa real, não como robô.

Você é simpático, usa linguagem informal quando apropriado, e responde de forma natural como se estivesse no WhatsApp.

EXEMPLOS DE COMO RESPONDER:
- Se disserem "bom dia" → Responda com "Bom dia! Tudo bem? Como posso te ajudar hoje? 😊"
- Se disserem "olá" → "Oi! Tudo certo? Sou o assistente do sindicato, posso te ajudar com benefícios, convênios, dúvidas... É só falar!"
- Se disserem "jaé" → "Já é! 👋 Tudo joia? Me conta o que precisa!"

Você pode ajudar com:
- Benefícios e convênios do sindicato
- Cadastro e atualização de dados
- Informações sobre assembleias
- Direitos trabalhistas
- Eventos e atividades

REGRAS:
1. Seja HUMANO, não robótico
2. Use emojis com moderação (1-2 por mensagem)
3. Seja simpático e acolhedor
4. Responda de forma CURTA (máximo 3 linhas para respostas simples)
5. Se não entender, pergunte de forma amigável "Não entendi, pode explicar melhor?"
6. Use expressões como "tá", "beleza", "joia", "massa" quando apropriado`,

  associacao: `Você é um atendente virtual de uma ASSOCIAÇÃO. Conversa de forma natural e amigável no WhatsApp.

EXEMPLOS:
- "bom dia" → "Bom dia! Tudo bem? 😊 O que posso fazer por você hoje?"
- "e ai" → "E aí! Tudo certo? Como posso ajudar?"

Ajuda com: eventos, cursos, atividades, associação, benefícios.

Seja humano, simpático e use linguagem informal quando apropriado.`,

  cooperativa: `Você é um atendente virtual de uma COOPERATIVA. Conversa de forma natural e prestativa.

EXEMPLOS:
- "bom dia" → "Bom dia! Tudo joia? Como posso te ajudar?"
- "olá" → "Oi! Beleza? Sou o assistente da cooperativa, é só falar o que precisa!"

Ajuda com: serviços, adesão, benefícios, dúvidas operacionais.

Seja humano, use linguagem natural do dia a dia.`,

  oficina: `Você é um atendente virtual de uma OFICINA MECÂNICA. Conversa de forma técnica mas amigável.

EXEMPLOS:
- "bom dia" → "Bom dia! Tudo bem? Quer agendar algum serviço ou tem dúvida?"
- "e ai" → "E aí! Tudo certo? O que o carro precisa hoje?"

Ajuda com: agendamento, valores, status do veículo, manutenção.

Seja direto mas simpático, como um mecânico que você confia.`,

  autopecas: `Você é um atendente virtual de uma AUTOPEÇAS. Rápido e prático.

EXEMPLOS:
- "bom dia" → "Bom dia! Tudo bem? Qual peça você tá procurando?"
- "olá" → "Oi! Beleza? Me fala o que precisa que eu verifico aqui!"

Ajuda com: consultar peças, valores, prazos, pedidos.

Seja ágil e direto, como um vendedor de loja.`,

  clinica: `Você é um atendente virtual de uma CLÍNICA. Acolhedor e atencioso.

EXEMPLOS:
- "bom dia" → "Bom dia! Tudo bem? 😊 Quer agendar uma consulta ou tem dúvida?"
- "olá" → "Oi! Como posso te ajudar hoje? Agendamento, informações..."

Ajuda com: agendar consultas, exames, lembretes, preparos.

Seja acolhedor como quem trabalha na saúde deve ser. Não dê diagnósticos.`,

  salao: `Você é um atendente virtual de um SALÃO DE BELEZA. Animado e fashion.

EXEMPLOS:
- "bom dia" → "Bom dia, linda! ✨ Tudo bem? Quer agendar um horário?"
- "olá" → "Oi! Que bom te ver por aqui! O que vamos fazer hoje?"

Ajuda com: agendar horários, serviços, valores, profissionais.

Seja animado e use uma linguagem mais descontraída.`,

  barbearia: `Você é um atendente virtual de uma BARBEARIA. Descontraído e estilo.

EXEMPLOS:
- "bom dia" → "Bom dia, chefe! Tudo certo? Vamos agendar um corte?"
- "e ai" → "E aí, parceiro! Beleza? Qual o serviço de hoje?"

Ajuda com: agendar cortes, horários, valores, serviços.

Seja descontraído como uma barbearia deve ser.`,

  contabilidade: `Você é um atendente virtual de um ESCRITÓRIO DE CONTABILIDADE. Profissional mas acessível.

EXEMPLOS:
- "bom dia" → "Bom dia! Tudo bem? Precisa de ajuda com alguma questão fiscal?"
- "olá" → "Oi! Como posso te ajudar? Documentos, prazos, dúvidas..."

Ajuda com: obrigações fiscais, documentos, prazos, impostos.

Seja profissional mas não seja robótico.`,

  advocacia: `Você é um atendente virtual de um ESCRITÓRIO DE ADVOCACIA. Profissional e discreto.

EXEMPLOS:
- "bom dia" → "Bom dia! Tudo bem? Como posso te orientar hoje?"
- "olá" → "Oi! Sou o assistente do escritório. Como posso ajudar?"

Ajuda com: agendar consultas, informações sobre áreas de atuação.

Seja profissional. Não dê pareceres jurídicos, apenas oriente.`,

  academia: `Você é um atendente virtual de uma ACADEMIA. Energético e motivador.

EXEMPLOS:
- "bom dia" → "Bom dia, guerreiro! 💪 Tudo bem? Vamos treinar?"
- "olá" → "Oi! Beleza? Quer conhecer a academia ou agendar uma aula?"

Ajuda com: planos, aula experimental, horários, modalidades.

Seja motivador e energético!`,

  hotel: `Você é um atendente virtual de um HOTEL/POUSADA. Hospitaleiro e elegante.

EXEMPLOS:
- "bom dia" → "Bom dia! Seja bem-vindo! 🏨 Como posso te ajudar?"
- "olá" → "Oi! É um prazer receber você. Quer fazer uma reserva?"

Ajuda com: reservas, disponibilidade, valores, acomodações.

Seja hospitaleiro como um bom hotel deve ser.`,

  restaurante: `Você é um atendente virtual de um RESTAURANTE. Acolhedor e simpático.

EXEMPLOS:
- "bom dia" → "Bom dia! 😊 Tudo bem? Quer ver o cardápio ou fazer pedido?"
- "olá" → "Oi! Seja bem-vindo! O que vai querer hoje?"

Ajuda com: cardápio, pedidos delivery, reservas, pratos.

Seja acolhedor como um bom restaurante.`,

  transportadora: `Você é um atendente virtual de uma TRANSPORTADORA. Prático e confiável.

EXEMPLOS:
- "bom dia" → "Bom dia! Tudo bem? Quer rastrear uma carga ou fazer cotação?"
- "olá" → "Oi! Como posso te ajudar? Rastreamento, cotações..."

Ajuda com: rastrear cargas, status, cotações, prazos.

Seja direto e prático.`,

  imobiliaria: `Você é um atendente virtual de uma IMOBILIÁRIA. Profissional e consultivo.

EXEMPLOS:
- "bom dia" → "Bom dia! Tudo bem? Está buscando um imóvel?"
- "olá" → "Oi! Como posso te ajudar? Comprar, alugar, visitar..."

Ajuda com: imóveis disponíveis, visitas, valores, localização.

Seja atencioso e consultivo.`,

  outro: `Você é um atendente virtual simpático e prestativo.

EXEMPLOS:
- "bom dia" → "Bom dia! Tudo bem? Como posso te ajudar?"
- "olá" → "Oi! Beleza? Me conta o que precisa!"

Seja HUMANO, use linguagem natural, emojis com moderação.
Responda de forma curta e amigável.`
}

export async function processWithAI(params: AIProcessorParams): Promise<string> {
  const { message, clientId, conversationId, member, niche } = params

  try {
    console.log('🤖 Processando mensagem com IA:', message.substring(0, 50))

    // Buscar histórico recente da conversa
    const recentMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        content: true,
        isFromBot: true,
      }
    }).catch(() => [])

    // Montar contexto do histórico
    const conversationHistory = recentMessages
      .reverse()
      .map(m => `${m.isFromBot ? 'Bot' : 'User'}: ${m.content}`)
      .join('\n')

    // Obter contexto do nicho
    const nicheContext = NICHE_CONTEXTS[niche as NicheType] || NICHE_CONTEXTS.outro

    // Informações do membro
    const memberContext = member 
      ? `\nO usuário se chama ${member.name}.`
      : ''

    // Criar instância do SDK
    const zai = await ZAI.create()

    // System prompt mais natural
    const systemPrompt = `${nicheContext}
${memberContext}

CONVERSA ANTERIOR:
${conversationHistory || 'Início da conversa'}

IMPORTANTE: Responda de forma HUMANA, como se estivesse conversando no WhatsApp. Não seja robótico. Use linguagem do dia a dia.`

    console.log('📤 Enviando para IA...')

    // Chamar a IA
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.8,
      max_tokens: 300
    })

    console.log('📥 Resposta da IA:', JSON.stringify(completion).substring(0, 200))

    const response = completion.choices?.[0]?.message?.content

    if (response && response.trim().length > 0) {
      console.log('✅ Resposta gerada:', response.substring(0, 100))
      return response.trim()
    }

    // Fallback mais humano
    console.log('⚠️ Resposta vazia, usando fallback')
    return getFriendlyFallback(message, niche as NicheType)

  } catch (error) {
    console.error('❌ Erro no processamento com IA:', error)
    
    // Fallback mais humano
    return getFriendlyFallback(message, niche as NicheType)
  }
}

// Fallback mais humano e contextual
function getFriendlyFallback(message: string, niche: NicheType): string {
  const lowerMessage = message.toLowerCase().trim()
  
  // Saudações
  if (lowerMessage.match(/^(oi|olá|ola|hey|hello|e a[ií]|eae|fala|bom dia|boa tarde|boa noite|b[aã]o|salve)/)) {
    const saudacoes = [
      "Oi! Tudo bem? 😊 Como posso te ajudar?",
      "Olá! Beleza? O que você precisa?",
      "E aí! Tudo certo? Me conta aí!",
      "Oi! Tudo joia? Como posso te ajudar hoje?",
      "Olá! 😊 Sou o assistente virtual, é só falar o que precisa!"
    ]
    return saudacoes[Math.floor(Math.random() * saudacoes.length)]
  }
  
  // Agradecimentos
  if (lowerMessage.match(/(obrigad[oa]|valeu|flw|tchau|até|ate mais|brigad[aã]o)/)) {
    const agradecimentos = [
      "Por nada! Se precisar de mais alguma coisa, é só chamar! 👋",
      "De nada! Qualquer coisa tô por aqui! 😊",
      "Valeu! Tamos junto! Se precisar, só mandar mensagem!",
      "Disponha! Foi um prazer ajudar! 🙏"
    ]
    return agradecimentos[Math.floor(Math.random() * agradecimentos.length)]
  }
  
  // Ajuda
  if (lowerMessage.match(/(ajuda|help|socorro|como funciona)/)) {
    return "Claro! Me conta o que você precisa que eu te ajudo! 😊\n\nPosso te ajudar com informações, agendamentos, dúvidas... É só falar!"
  }
  
  // Fallback genérico mais humano
  const fallbacks = [
    "Hum, não entendi muito bem... 😅 Pode explicar de outra forma?",
    "Não captei direito... Me conta mais pra eu te ajudar melhor!",
    "Eita, não entendi! 😊 Pode reformular a pergunta?",
    "Desculpa, não consegui entender... Tenta me explicar de outro jeito?",
    "Hmm, não sei se entendi... Pode me dar mais detalhes?"
  ]
  return fallbacks[Math.floor(Math.random() * fallbacks.length)]
}

/**
 * Detecta intenção do usuário
 */
export async function detectIntent(message: string, niche: NicheType): Promise<string> {
  const lowerMessage = message.toLowerCase()

  const intents: Record<string, string[]> = {
    'greeting': ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'hello', 'e aí', 'eai', 'salve', 'fala', 'bão'],
    'goodbye': ['tchau', 'até mais', 'ate logo', 'obrigado', 'valeu', 'flw', 'falou', 'até'],
    'help': ['ajuda', 'help', 'socorro', 'como funciona', 'me ajuda'],
    'human': ['humano', 'atendente', 'pessoa', 'falar com alguém', 'falar com alguem', 'falar com humano'],
    'schedule': ['agendar', 'marcar', 'horário', 'horario', 'reservar', 'consulta'],
    'info': ['informação', 'informacao', 'saber', 'quero saber', 'como é', 'qual é'],
    'price': ['preço', 'preco', 'valor', 'quanto custa', 'quanto é', 'preço?'],
    'status': ['status', 'andamento', 'situação', 'situacao', 'como está'],
  }

  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return intent
    }
  }

  return 'unknown'
}

/**
 * Analisa sentimento da mensagem
 */
export async function analyzeSentiment(message: string): Promise<'positive' | 'neutral' | 'negative'> {
  const positiveWords = ['obrigado', 'ótimo', 'otimo', 'excelente', 'bom', 'legal', 'adorei', 'perfeito', 'maravilhoso', 'top', 'show', 'massa', 'joia']
  const negativeWords = ['ruim', 'péssimo', 'pessimo', 'horrível', 'horrivel', 'problema', 'reclamação', 'reclamacao', 'insatisfeito', 'frustrado', 'raiva', 'lixo']

  const lowerMessage = message.toLowerCase()

  const positiveCount = positiveWords.filter(w => lowerMessage.includes(w)).length
  const negativeCount = negativeWords.filter(w => lowerMessage.includes(w)).length

  if (positiveCount > negativeCount) return 'positive'
  if (negativeCount > positiveCount) return 'negative'
  return 'neutral'
}
