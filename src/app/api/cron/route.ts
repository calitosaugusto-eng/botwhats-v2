// ===========================================
// CRON JOB - Lembretes Automáticos
// ===========================================
// Este endpoint deve ser chamado por um serviço de cron
// como Vercel Cron Jobs, cron-job.org, ou similar

import { NextRequest, NextResponse } from 'next/server'
import { sendClientReminders, sendDailySummaryToOwner, sendWeeklySummaryToOwner } from '@/lib/reminders'

export async function GET(request: NextRequest) {
  try {
    // Verificar token de segurança
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const job = searchParams.get('job')

    console.log(`🕐 Executando cron job: ${job || 'all'}`)

    switch (job) {
      case 'reminders':
        // Lembretes para clientes (executar a cada hora)
        await sendClientReminders()
        break

      case 'daily':
        // Resumo diário para donos (executar às 20:00)
        await sendDailySummaryToOwner()
        break

      case 'weekly':
        // Resumo semanal para donos (executar domingo 18:00)
        await sendWeeklySummaryToOwner()
        break

      default:
        // Executar todos
        await sendClientReminders()
        await sendDailySummaryToOwner()
        await sendWeeklySummaryToOwner()
    }

    return NextResponse.json({
      success: true,
      message: `Cron job '${job || 'all'}' executado com sucesso`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Erro no cron job:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}
