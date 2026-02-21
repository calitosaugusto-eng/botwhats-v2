// ===========================================
// SETUP API - Criar tabelas automaticamente
// ===========================================

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    console.log('🔄 Iniciando criação de tabelas...')

    // Criar tabelas via SQL raw
    
    // Tabela de Usuários (precisa ser criada primeiro)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" TEXT UNIQUE NOT NULL,
        "password" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'client',
        "clientId" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "lastLogin" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Client" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" TEXT NOT NULL,
        "slug" TEXT UNIQUE NOT NULL,
        "niche" TEXT NOT NULL DEFAULT 'sindicato',
        "phone" TEXT,
        "email" TEXT,
        "address" TEXT,
        "logo" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "plan" TEXT NOT NULL DEFAULT 'basic',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Member" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "email" TEXT,
        "cpf" TEXT,
        "membershipId" TEXT,
        "category" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "joinDate" TIMESTAMP(3),
        "notes" TEXT,
        "metadata" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Member_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Member_clientId_phone_key" UNIQUE ("clientId", "phone")
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Conversation" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "memberId" TEXT,
        "phone" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'active',
        "humanTakeover" BOOLEAN NOT NULL DEFAULT false,
        "summary" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Conversation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `)

    // Adicionar coluna humanTakeover se não existir (migração)
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Conversation' AND column_name = 'humanTakeover') THEN
          ALTER TABLE "Conversation" ADD COLUMN "humanTakeover" BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END $$;
    `).catch(() => {
      console.log('⚠️ Coluna humanTakeover já existe ou migração não necessária')
    })

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Message" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "conversationId" TEXT NOT NULL,
        "direction" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'text',
        "content" TEXT NOT NULL,
        "mediaUrl" TEXT,
        "status" TEXT NOT NULL DEFAULT 'sent',
        "isFromBot" BOOLEAN NOT NULL DEFAULT false,
        "metadata" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Message_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Template" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "variables" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "useCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Template_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Template_clientId_name_key" UNIQUE ("clientId", "name")
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Flow" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "trigger" TEXT NOT NULL,
        "description" TEXT,
        "steps" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "useCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Flow_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Setting" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Setting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Setting_clientId_key_key" UNIQUE ("clientId", "key")
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Analytics" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "messagesIn" INTEGER NOT NULL DEFAULT 0,
        "messagesOut" INTEGER NOT NULL DEFAULT 0,
        "newMembers" INTEGER NOT NULL DEFAULT 0,
        "resolved" INTEGER NOT NULL DEFAULT 0,
        "pendingHuman" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "Analytics_clientId_date_key" UNIQUE ("clientId", "date")
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT,
        "action" TEXT NOT NULL,
        "entity" TEXT NOT NULL,
        "entityId" TEXT,
        "details" TEXT,
        "ip" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NicheTemplate" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "niche" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "variables" TEXT,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "NicheTemplate_niche_name_key" UNIQUE ("niche", "name")
      );
    `)

    // ========================================
    // NOVAS TABELAS - SISTEMA DE AGENDAMENTOS
    // ========================================

    // Tabela de Conhecimento do Cliente
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClientKnowledge" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "keywords" TEXT,
        "priority" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ClientKnowledge_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)

    // Tabela de Profissionais
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Professional" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "phone" TEXT,
        "email" TEXT,
        "services" TEXT,
        "workingHours" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Professional_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)

    // Tabela de Serviços
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Service" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "duration" INTEGER NOT NULL DEFAULT 60,
        "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "category" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Service_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)

    // Tabela de Agendamentos
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Appointment" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "memberId" TEXT,
        "professionalId" TEXT,
        "serviceId" TEXT,
        "date" TIMESTAMP(3) NOT NULL,
        "startTime" TEXT NOT NULL,
        "endTime" TEXT NOT NULL,
        "duration" INTEGER NOT NULL DEFAULT 60,
        "status" TEXT NOT NULL DEFAULT 'confirmed',
        "price" DOUBLE PRECISION,
        "notes" TEXT,
        "reminderSent" BOOLEAN NOT NULL DEFAULT false,
        "reminderAt" TIMESTAMP(3),
        "cancelledAt" TIMESTAMP(3),
        "cancelledBy" TEXT,
        "cancelReason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Appointment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Appointment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `)

    // Tabela de Relatórios Semanais
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WeeklyReport" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "weekStart" TIMESTAMP(3) NOT NULL,
        "weekEnd" TIMESTAMP(3) NOT NULL,
        "totalAppointments" INTEGER NOT NULL DEFAULT 0,
        "completedAppointments" INTEGER NOT NULL DEFAULT 0,
        "cancelledAppointments" INTEGER NOT NULL DEFAULT 0,
        "noShowAppointments" INTEGER NOT NULL DEFAULT 0,
        "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "lostRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "newClients" INTEGER NOT NULL DEFAULT 0,
        "returningClients" INTEGER NOT NULL DEFAULT 0,
        "growthPercent" DOUBLE PRECISION,
        "topServices" TEXT,
        "topProfessionals" TEXT,
        "dailyBreakdown" TEXT,
        "sentAt" TIMESTAMP(3),
        "sentTo" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "WeeklyReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "WeeklyReport_clientId_weekStart_key" UNIQUE ("clientId", "weekStart")
      );
    `)

    // Tabela de Lembretes Diários
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DailyReminder" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "type" TEXT NOT NULL,
        "appointmentCount" INTEGER NOT NULL DEFAULT 0,
        "cancellations" INTEGER NOT NULL DEFAULT 0,
        "message" TEXT,
        "sentAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DailyReminder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "DailyReminder_clientId_date_type_key" UNIQUE ("clientId", "date", "type")
      );
    `)

    // Adicionar colunas à tabela Conversation
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Conversation' AND column_name = 'awaitingName') THEN
          ALTER TABLE "Conversation" ADD COLUMN "awaitingName" BOOLEAN NOT NULL DEFAULT true;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Conversation' AND column_name = 'context') THEN
          ALTER TABLE "Conversation" ADD COLUMN "context" TEXT;
        END IF;
      END $$;
    `).catch(() => {
      console.log('⚠️ Colunas de Conversation já existem')
    })

    console.log('✅ Tabelas criadas!')

    // Criar índices
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Member_clientId_idx" ON "Member"("clientId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Conversation_clientId_idx" ON "Conversation"("clientId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Message_clientId_idx" ON "Message"("clientId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId");`)

    console.log('✅ Índices criados!')

    // Criar cliente padrão
    const existingClient = await prisma.client.findUnique({
      where: { id: 'default' }
    }).catch(() => null)

    if (!existingClient) {
      await prisma.client.create({
        data: {
          id: 'default',
          name: 'Cliente Padrão',
          slug: 'default',
          niche: 'sindicato',
          plan: 'basic',
          isActive: true
        }
      })
      console.log('✅ Cliente padrão criado!')
    }

    // Criar configurações padrão
    const existingSettings = await prisma.setting.findMany({
      where: { clientId: 'default' }
    }).catch(() => [])

    if (existingSettings.length === 0) {
      await prisma.setting.createMany({
        data: [
          { clientId: 'default', key: 'botName', value: 'Assistente Virtual' },
          { clientId: 'default', key: 'welcomeMessage', value: 'Olá! Como posso ajudar você hoje?' },
          { clientId: 'default', key: 'businessHours', value: '{"start":"08:00","end":"18:00"}' },
          { clientId: 'default', key: 'botTone', value: 'professional' },
          { clientId: 'default', key: 'autoReply', value: 'true' }
        ]
      })
      console.log('✅ Configurações padrão criadas!')
    }

    return NextResponse.json({
      success: true,
      message: 'Banco de dados inicializado com sucesso!',
      tablesCreated: true,
      clientCreated: !existingClient
    })

  } catch (error) {
    console.error('❌ Erro no setup:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}
