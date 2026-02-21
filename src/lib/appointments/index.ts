// ===========================================
// SISTEMA DE AGENDAMENTOS
// ===========================================
// Funções para gerenciar agendamentos com anti-sobreposição
// Cada agendamento é isolado por clientId (estabelecimento)

import { prisma } from '@/lib/db'

// ===========================================
// TIPOS
// ===========================================
interface CreateAppointmentData {
  clientId: string
  memberId?: string
  professionalId?: string
  serviceId?: string
  date: Date
  startTime: string  // "14:00"
  duration: number   // minutos
  notes?: string
  price?: number
}

interface AvailabilityResult {
  available: boolean
  conflictWith?: {
    id: string
    startTime: string
    endTime: string
    memberName?: string
  }
  message?: string
}

interface TimeSlot {
  time: string
  available: boolean
  professionalName?: string
}

// ===========================================
// FUNÇÕES AUXILIARES
// ===========================================

// Converter "14:00" para minutos (840)
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Converter minutos para "14:00"
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

// Gerar horários disponíveis no dia
function generateTimeSlots(startHour: number, endHour: number, interval: number = 30): string[] {
  const slots: string[] = []
  for (let minutes = startHour * 60; minutes < endHour * 60; minutes += interval) {
    slots.push(minutesToTime(minutes))
  }
  return slots
}

// ===========================================
// VERIFICAR DISPONIBILIDADE
// ===========================================
export async function checkAvailability(
  clientId: string,
  date: Date,
  startTime: string,
  duration: number,
  professionalId?: string,
  excludeAppointmentId?: string
): Promise<AvailabilityResult> {
  
  const requestedStart = timeToMinutes(startTime)
  const requestedEnd = requestedStart + duration
  
  // Buscar agendamentos do dia
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  
  const appointments = await prisma.appointment.findMany({
    where: {
      clientId,
      date: {
        gte: startOfDay,
        lte: endOfDay
      },
      status: { in: ['confirmed', 'pending'] },
      ...(professionalId && { professionalId }),
      ...(excludeAppointmentId && { id: { not: excludeAppointmentId } })
    },
    include: {
      member: true,
      service: true
    }
  })
  
  // Verificar conflito com cada agendamento
  for (const apt of appointments) {
    const aptStart = timeToMinutes(apt.startTime)
    const aptEnd = timeToMinutes(apt.endTime)
    
    // Há sobreposição?
    // Conflito se: início solicitado < fim existente E fim solicitado > início existente
    if (requestedStart < aptEnd && requestedEnd > aptStart) {
      return {
        available: false,
        conflictWith: {
          id: apt.id,
          startTime: apt.startTime,
          endTime: apt.endTime,
          memberName: apt.member?.name
        },
        message: `Horário indisponível. Já existe agendamento das ${apt.startTime} às ${apt.endTime}${apt.member?.name ? ` com ${apt.member.name}` : ''}.`
      }
    }
  }
  
  return { available: true }
}

// ===========================================
// OBTER HORÁRIOS DISPONÍVEIS
// ===========================================
export async function getAvailableSlots(
  clientId: string,
  date: Date,
  duration: number = 60,
  professionalId?: string
): Promise<TimeSlot[]> {
  
  // Horário de funcionamento padrão (pode vir das configurações)
  const workingHours = { start: 8, end: 20 }
  
  // Gerar todos os slots possíveis
  const allSlots = generateTimeSlots(workingHours.start, workingHours.end, 30)
  
  // Verificar disponibilidade de cada slot
  const slotsWithAvailability: TimeSlot[] = []
  
  for (const slot of allSlots) {
    const result = await checkAvailability(clientId, date, slot, duration, professionalId)
    
    slotsWithAvailability.push({
      time: slot,
      available: result.available
    })
  }
  
  return slotsWithAvailability
}

// ===========================================
// CRIAR AGENDAMENTO
// ===========================================
export async function createAppointment(data: CreateAppointmentData) {
  // Calcular horário de término
  const startMinutes = timeToMinutes(data.startTime)
  const endMinutes = startMinutes + data.duration
  const endTime = minutesToTime(endMinutes)
  
  // Verificar disponibilidade
  const availability = await checkAvailability(
    data.clientId,
    data.date,
    data.startTime,
    data.duration,
    data.professionalId
  )
  
  if (!availability.available) {
    return {
      success: false,
      error: availability.message || 'Horário indisponível',
      conflict: availability.conflictWith
    }
  }
  
  // Buscar preço do serviço se não informado
  let price = data.price
  if (!price && data.serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId }
    })
    price = service?.price || 0
  }
  
  // Criar agendamento
  const appointment = await prisma.appointment.create({
    data: {
      clientId: data.clientId,
      memberId: data.memberId,
      professionalId: data.professionalId,
      serviceId: data.serviceId,
      date: data.date,
      startTime: data.startTime,
      endTime: endTime,
      duration: data.duration,
      notes: data.notes,
      price: price,
      status: 'confirmed'
    },
    include: {
      member: true,
      service: true,
      professional: true
    }
  })
  
  return {
    success: true,
    appointment
  }
}

// ===========================================
// CANCELAR AGENDAMENTO
// ===========================================
export async function cancelAppointment(
  appointmentId: string,
  cancelledBy: 'client' | 'professional' | 'system',
  reason?: string
) {
  const appointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledBy,
      cancelReason: reason
    },
    include: {
      member: true,
      client: true,
      service: true
    }
  })
  
  return {
    success: true,
    appointment
  }
}

// ===========================================
// BUSCAR AGENDAMENTOS DO DIA
// ===========================================
export async function getAppointmentsForDay(clientId: string, date: Date) {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  
  return prisma.appointment.findMany({
    where: {
      clientId,
      date: {
        gte: startOfDay,
        lte: endOfDay
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
}

// ===========================================
// BUSCAR AGENDAMENTOS DA SEMANA
// ===========================================
export async function getAppointmentsForWeek(clientId: string, startDate: Date) {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  end.setHours(23, 59, 59, 999)
  
  return prisma.appointment.findMany({
    where: {
      clientId,
      date: {
        gte: start,
        lte: end
      },
      status: { in: ['confirmed', 'pending', 'completed', 'cancelled', 'no_show'] }
    },
    include: {
      member: true,
      service: true,
      professional: true
    },
    orderBy: [
      { date: 'asc' },
      { startTime: 'asc' }
    ]
  })
}

// ===========================================
// HISTÓRICO DO CLIENTE
// ===========================================
export async function getMemberHistory(memberId: string) {
  return prisma.appointment.findMany({
    where: {
      memberId,
      status: { in: ['completed', 'cancelled', 'no_show'] }
    },
    include: {
      service: true,
      professional: true
    },
    orderBy: { date: 'desc' },
    take: 20
  })
}

// ===========================================
// ESTATÍSTICAS SEMANAIS
// ===========================================
export async function getWeeklyStats(clientId: string, startDate: Date) {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  end.setHours(23, 59, 59, 999)
  
  const appointments = await prisma.appointment.findMany({
    where: {
      clientId,
      date: {
        gte: start,
        lte: end
      }
    },
    include: {
      service: true,
      member: true
    }
  })
  
  const stats = {
    total: appointments.length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    noShow: appointments.filter(a => a.status === 'no_show').length,
    totalRevenue: appointments
      .filter(a => a.status === 'completed')
      .reduce((sum, a) => sum + (a.price || 0), 0),
    lostRevenue: appointments
      .filter(a => a.status === 'cancelled' || a.status === 'no_show')
      .reduce((sum, a) => sum + (a.price || 0), 0),
    newClients: 0, // Calcular depois
    returningClients: 0
  }
  
  return stats
}
