// ===========================================
// API DE REGISTRO DE USUÁRIO
// ===========================================
// Cria novo usuário + estabelecimento (Client)
// Cada usuário tem seu próprio clientId isolado

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, businessName, niche, phone, address } = body

    // Validações
    if (!email || !password || !name || !businessName) {
      return NextResponse.json(
        { success: false, error: 'Preencha todos os campos obrigatórios' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      )
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Este email já está cadastrado' },
        { status: 400 }
      )
    }

    // Criar slug do estabelecimento
    const slug = businessName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    // Verificar se slug já existe
    const existingSlug = await prisma.client.findUnique({
      where: { slug }
    })

    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug

    // Criptografar senha
    const hashedPassword = await bcrypt.hash(password, 10)

    // Criar estabelecimento e usuário em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar estabelecimento
      const client = await tx.client.create({
        data: {
          name: businessName,
          slug: finalSlug,
          niche: niche || 'salao',
          phone,
          address,
          plan: 'basic',
          isActive: true
        }
      })

      // 2. Criar usuário vinculado ao estabelecimento
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'client',
          clientId: client.id,
          isActive: true
        }
      })

      // 3. Criar configurações padrão
      await tx.setting.createMany({
        data: [
          { clientId: client.id, key: 'botName', value: 'Assistente Virtual' },
          { clientId: client.id, key: 'welcomeMessage', value: 'Olá! Como posso ajudar você hoje?' },
          { clientId: client.id, key: 'businessHours', value: '{"start":"08:00","end":"18:00"}' },
          { clientId: client.id, key: 'botTone', value: 'professional' },
          { clientId: client.id, key: 'autoReply', value: 'true' },
          { clientId: client.id, key: 'ownerPhone', value: phone || '' }
        ]
      })

      return { client, user }
    })

    console.log(`✅ Novo usuário registrado: ${email} - ${result.client.name}`)

    return NextResponse.json({
      success: true,
      message: 'Cadastro realizado com sucesso!',
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name
      },
      client: {
        id: result.client.id,
        name: result.client.name,
        slug: result.client.slug
      }
    })

  } catch (error) {
    console.error('Erro no registro:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno. Tente novamente.' },
      { status: 500 }
    )
  }
}
