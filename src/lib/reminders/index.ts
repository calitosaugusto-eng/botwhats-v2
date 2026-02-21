// ===========================================
// SISTEMA DE LEMBRETES AUTOMÁTICOS
// ===========================================
// - Lembretes para clientes (2h antes)
// - Resumo diário para o dono
// - Resumo semanal para o dono
// - Notificação de cancelamentos

import { prisma } from '@/lib/db'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'

// ===========================================
// LEMBRETE PARA CLIENTE (2h antes)
// ===========================================
export async function sendClientReminders() {
  const now = new Date()
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  
  // Buscar agendamentos nas próximas 2h que ainda não receberam lembrete
  const appointments = await prisma.appointment.findMany({
    where: {
      status: 'confirmed',
      reminderSent: false,
      date: {
        gte: now,
        lte: twoHoursFromNow
      }
    },
    include: {
      member: true,
      service: true,
      professional: true,
      client: true
    }
  })

  console.log(`📅 Encontrados ${appointments.length} agendamentos para lembrete`)

  for (const apt of appointments) {
    try {
      if (!apt.member?.phone) continue

      const message = generateClientReminderMessage(apt)
      await sendWhatsAppMessage(apt.member.phone, message)

      // Marcar como enviado
      await prisma.appointment.update({
        where: { id: apt.id },
        data: {
          reminderSent: true,
          reminderAt: new Date()
        }
      })

      console.log(`✅ Lembrete enviado para ${apt.member.name}`)
    } catch (error) {
      console.error(`❌ Erro ao enviar lembrete para ${apt.id}:`, error)
    }
  }
}

function generateClientReminderMessage(apt: any): string {
  const dateStr = formatDate(apt.date)
  const serviceName = apt.service?.name || 'atendimento'
  const professionalName = apt.professional?.name
  
  return `⏰ *Lembrete de Agendamento*

Olá, ${apt.member?.name || 'cliente'}! 

Seu horário é HOJE às ${apt.startTime}! 🕐

📋 *Detalhes:*
• Serviço: ${serviceName}
• Data: ${dateStr}
• Horário: ${apt.startTime}${professionalName ? `\n• Profissional: ${professionalName}` : ''}

Confirmar presença? Responda:
• ✅ SIM - confirmar
• ❌ NÃO - cancelar`
}

// ===========================================
// RESUMO DIÁRIO PARA O DONO
// ===========================================
export async function sendDailySummaryToOwner() {
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Buscar todos os clientes ativos
  const clients = await prisma.client.findMany({
    where: { isActive: true },
    include: {
      settings: true
    }
  })

  for (const client of clients) {
    try {
      // Buscar agendamentos de amanhã
      const appointments = await prisma.appointment.findMany({
        where: {
          clientId: client.id,
          date: {
            gte: tomorrow,
            lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
          },
          status: { in: ['confirmed', 'pending'] }
        },
        include: {
          member: true,
          service: true,
          professional: true
        },
        orderBy: { startTime: 'asc' }
      })

      // Buscar cancelamentos de hoje
      const cancellations = await prisma.appointment.findMany({
        where: {
          clientId: client.id,
          cancelledAt: {
            gte: today,
            lt: tomorrow
          }
        },
        include: {
          member: true,
          service: true
        }
      })

      // Não enviar se não tem agendamentos
      if (appointments.length === 0 && cancellations.length === 0) continue

      const message = generateDailySummaryMessage(appointments, cancellations, tomorrow)
      
      // Enviar para o telefone do dono
      const ownerPhone = client.phone || client.settings?.find((s: any) => s.key === 'ownerPhone')?.value
      
      if (ownerPhone) {
        await sendWhatsAppMessage(ownerPhone, message)
        console.log(`📊 Resumo diário enviado para ${client.name}`)
      }

      // Registrar envio
      await prisma.dailyReminder.create({
        data: {
          clientId: client.id,
          date: tomorrow,
          type: 'evening',
          appointmentCount: appointments.length,
          cancellations: cancellations.length,
          message,
          sentAt: new Date()
        }
      })

    } catch (error) {
      console.error(`❌ Erro ao enviar resumo para ${client.name}:`, error)
    }
  }
}

function generateDailySummaryMessage(appointments: any[], cancellations: any[], date: Date): string {
  const dateStr = formatDate(date)
  
  let message = `📊 *RESUMO DE AMANHÃ - ${dateStr}*\n\n`
  message += `✅ Total: ${appointments.length} agendamentos\n`
  
  if (cancellations.length > 0) {
    message += `❌ Cancelamentos hoje: ${cancellations.length}\n`
  }
  
  if (appointments.length > 0) {
    message += `\n📅 *AGENDAMENTOS:*\n`
    
    for (const apt of appointments.slice(0, 10)) {
      const memberName = apt.member?.name || 'Cliente'
      const serviceName = apt.service?.name || ''
      message += `\n• ${apt.startTime} - ${memberName}`
      if (serviceName) message += ` (${serviceName})`
    }
    
    if (appointments.length > 10) {
      message += `\n\n... e mais ${appointments.length - 10} agendamentos`
    }
  }

  if (cancellations.length > 0) {
    message += `\n\n⚠️ *CANCELAMENTOS HOJE:*\n`
    for (const apt of cancellations) {
      const memberName = apt.member?.name || 'Cliente'
      message += `• ${apt.startTime} - ${memberName}\n`
    }
  }
  
  return message
}

// ===========================================
// RESUMO SEMANAL PARA O DONO
// ===========================================
export async function sendWeeklySummaryToOwner() {
  const now = new Date()
  
  // Início da semana passada (domingo)
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() - 7)
  weekStart.setHours(0, 0, 0, 0)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  weekEnd.setHours(23, 59, 59, 999)

  const clients = await prisma.client.findMany({
    where: { isActive: true }
  })

  for (const client of clients) {
    try {
      const report = await generateWeeklyReport(client.id, weekStart, weekEnd)
      
      const message = generateWeeklySummaryMessage(report, client.name)
      
      const ownerPhone = client.phone
      if (ownerPhone) {
        await sendWhatsAppMessage(ownerPhone, message)
        console.log(`📈 Resumo semanal enviado para ${client.name}`)
      }

      // Salvar relatório
      await prisma.weeklyReport.create({
        data: {
          clientId: client.id,
          weekStart,
          weekEnd,
          totalAppointments: report.totalAppointments,
          completedAppointments: report.completedAppointments,
          cancelledAppointments: report.cancelledAppointments,
          noShowAppointments: report.noShowAppointments,
          totalRevenue: report.totalRevenue,
          lostRevenue: report.lostRevenue,
          newClients: report.newClients,
          returningClients: report.returningClients,
          topServices: JSON.stringify(report.topServices),
          topProfessionals: JSON.stringify(report.topProfessionals),
          sentAt: new Date()
        }
      })

    } catch (error) {
      console.error(`❌ Erro ao enviar relatório semanal para ${client.name}:`, error)
    }
  }
}

async function generateWeeklyReport(clientId: string, weekStart: Date, weekEnd: Date) {
  const appointments = await prisma.appointment.findMany({
    where: {
      clientId,
      date: {
        gte: weekStart,
        lte: weekEnd
      }
    },
    include: {
      member: true,
      service: true,
      professional: true
    }
  })

  // Estatísticas básicas
  const totalAppointments = appointments.length
  const completedAppointments = appointments.filter(a => a.status === 'completed').length
  const cancelledAppointments = appointments.filter(a => a.status === 'cancelled').length
  const noShowAppointments = appointments.filter(a => a.status === 'no_show').length
  
  const totalRevenue = appointments
    .filter(a => a.status === 'completed')
    .reduce((sum, a) => sum + (a.price || 0), 0)
  
  const lostRevenue = appointments
    .filter(a => a.status === 'cancelled' || a.status === 'no_show')
    .reduce((sum, a) => sum + (a.price || 0), 0)

  // Top serviços
  const serviceCount: Record<string, number> = {}
  appointments.forEach(a => {
    if (a.service?.name) {
      serviceCount[a.service.name] = (serviceCount[a.service.name] || 0) + 1
    }
  })
  const topServices = Object.entries(serviceCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Top profissionais
  const professionalCount: Record<string, number> = {}
  appointments.forEach(a => {
    if (a.professional?.name) {
      professionalCount[a.professional.name] = (professionalCount[a.professional.name] || 0) + 1
    }
  })
  const topProfessionals = Object.entries(professionalCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Novos clientes vs recorrentes
  const memberIds = [...new Set(appointments.map(a => a.memberId).filter(Boolean))]
  const newMembers = await prisma.member.count({
    where: {
      clientId,
      createdAt: {
        gte: weekStart,
        lte: weekEnd
      }
    }
  })

  return {
    totalAppointments,
    completedAppointments,
    cancelledAppointments,
    noShowAppointments,
    totalRevenue,
    lostRevenue,
    newClients: newMembers,
    returningClients: memberIds.length - newMembers,
    topServices,
    topProfessionals
  }
}

function generateWeeklySummaryMessage(report: any, clientName: string): string {
  let message = `📈 *RESUMO DA SEMANA - ${clientName}*\n\n`
  
  message += `📊 *ATENDIMENTOS:*\n`
  message += `• Total: ${report.totalAppointments}\n`
  message += `• Realizados: ${report.completedAppointments}\n`
  message += `• Cancelados: ${report.cancelledAppointments}\n`
  message += `• No-show: ${report.noShowAppointments}\n\n`
  
  message += `💰 *FINANCEIRO:*\n`
  message += `• Faturamento: R$ ${report.totalRevenue.toFixed(2)}\n`
  message += `• Perdido (cancelamentos): R$ ${report.lostRevenue.toFixed(2)}\n\n`
  
  message += `👥 *CLIENTES:*\n`
  message += `• Novos: ${report.newClients}\n`
  message += `• Recorrentes: ${report.returningClients}\n\n`
  
  if (report.topServices.length > 0) {
    message += `🏆 *TOP SERVIÇOS:*\n`
    report.topServices.forEach((s: any, i: number) => {
      message += `${i + 1}. ${s.name} (${s.count}x)\n`
    })
    message += `\n`
  }
  
  if (report.topProfessionals.length > 0) {
    message += `⭐ *TOP PROFISSIONAIS:*\n`
    report.topProfessionals.forEach((p: any, i: number) => {
      message += `${i + 1}. ${p.name} (${p.count} atendimentos)\n`
    })
  }
  
  return message
}

// ===========================================
// NOTIFICAÇÃO DE CANCELAMENTO
// ===========================================
export async function notifyCancellation(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      member: true,
      service: true,
      client: true
    }
  })

  if (!appointment || !appointment.client.phone) return

  const message = `❌ *CANCELAMENTO*

${appointment.member?.name || 'Um cliente'} cancelou o agendamento:
• Data: ${formatDate(appointment.date)}
• Horário: ${appointment.startTime}
• Serviço: ${appointment.service?.name || 'N/A'}

O horário ficou disponível!`

  await sendWhatsAppMessage(appointment.client.phone, message)
}

// ===========================================
// FUNÇÕES AUXILIARES
// ===========================================
function formatDate(date: Date): string {
  const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  
  return `${days[date.getDay()]}, ${date.getDate()}/${months[date.getMonth()]}`
}
