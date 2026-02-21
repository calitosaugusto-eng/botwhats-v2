// ===========================================
// SETUP ADMIN - Criar usuário administrador
// ===========================================
// Este endpoint cria o usuário admin (você)
// Acesse APENAS UMA VEZ: /api/setup-admin

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET(request: NextRequest) {
  try {
    // Verificar se já existe um admin
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'admin' }
    })

    if (existingAdmin) {
      return NextResponse.json({
        success: false,
        message: 'Admin já existe',
        admin: {
          email: existingAdmin.email,
          name: existingAdmin.name
        }
      })
    }

    // Criar usuário admin
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456'
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    const admin = await prisma.user.create({
      data: {
        email: 'admin@botwhats.com',
        password: hashedPassword,
        name: 'Administrador',
        role: 'admin',
        clientId: null,
        isActive: true
      }
    })

    console.log('✅ Usuário admin criado!')

    return NextResponse.json({
      success: true,
      message: 'Admin criado com sucesso!',
      admin: {
        email: admin.email,
        name: admin.name,
        password: adminPassword // Mostrar só na criação
      },
      warning: '⚠️ Anote a senha e delete este endpoint em produção!'
    })

  } catch (error) {
    console.error('Erro ao criar admin:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro ao criar admin'
    }, { status: 500 })
  }
}
