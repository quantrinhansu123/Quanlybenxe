import { firebaseClient } from '@/lib/firebase'
import type { Schedule, ScheduleInput } from '@/types'

interface FirebaseSchedule {
  id: string
  schedule_code: string
  route_id: string
  operator_id: string
  departure_time: string
  frequency_type: string
  days_of_week?: number[]
  effective_from: string
  effective_to?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const scheduleService = {
  getAll: async (routeId?: string, operatorId?: string, isActive?: boolean): Promise<Schedule[]> => {
    try {
      const data = await firebaseClient.getAsArray<FirebaseSchedule>('schedules')
      const routes = await firebaseClient.get<Record<string, any>>('routes') || {}
      const operators = await firebaseClient.get<Record<string, any>>('operators') || {}
      
      let filtered = data
      if (routeId) {
        filtered = filtered.filter(s => s.route_id === routeId)
      }
      if (operatorId) {
        filtered = filtered.filter(s => s.operator_id === operatorId)
      }
      if (isActive !== undefined) {
        filtered = filtered.filter(s => s.is_active === isActive)
      }

      return filtered.map(s => {
        const route = routes[s.route_id]
        const operator = operators[s.operator_id]
        
        return {
          id: s.id,
          scheduleCode: s.schedule_code,
          routeId: s.route_id,
          route: route ? {
            id: s.route_id,
            routeCode: route.route_code,
            routeName: route.route_name,
            routeType: route.route_type,
            isActive: route.is_active,
          } : undefined,
          operatorId: s.operator_id,
          operator: operator ? {
            id: s.operator_id,
            name: operator.name,
            code: operator.code,
            isTicketDelegated: operator.is_ticket_delegated,
            isActive: operator.is_active,
          } : undefined,
          departureTime: s.departure_time,
          frequencyType: s.frequency_type as 'daily' | 'weekly' | 'specific_days',
          daysOfWeek: s.days_of_week,
          effectiveFrom: s.effective_from,
          effectiveTo: s.effective_to,
          isActive: s.is_active,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        }
      }).sort((a, b) => a.departureTime.localeCompare(b.departureTime))
    } catch (error) {
      console.error('Error fetching schedules from Firebase:', error)
      return []
    }
  },

  getById: async (id: string): Promise<Schedule> => {
    try {
      const data = await firebaseClient.get<FirebaseSchedule>(`schedules/${id}`)
      if (!data) throw new Error('Schedule not found')
      
      const routes = await firebaseClient.get<Record<string, any>>('routes') || {}
      const operators = await firebaseClient.get<Record<string, any>>('operators') || {}
      const route = routes[data.route_id]
      const operator = operators[data.operator_id]
      
      return {
        id,
        scheduleCode: data.schedule_code,
        routeId: data.route_id,
        route: route ? {
          id: data.route_id,
          routeCode: route.route_code,
          routeName: route.route_name,
          routeType: route.route_type,
          isActive: route.is_active,
        } : undefined,
        operatorId: data.operator_id,
        operator: operator ? {
          id: data.operator_id,
          name: operator.name,
          code: operator.code,
          isTicketDelegated: operator.is_ticket_delegated,
          isActive: operator.is_active,
        } : undefined,
        departureTime: data.departure_time,
        frequencyType: data.frequency_type as 'daily' | 'weekly' | 'specific_days',
        daysOfWeek: data.days_of_week,
        effectiveFrom: data.effective_from,
        effectiveTo: data.effective_to,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    } catch (error) {
      console.error('Error fetching schedule by id from Firebase:', error)
      throw error
    }
  },

  create: async (input: ScheduleInput): Promise<Schedule> => {
    const id = firebaseClient.generateId()
    const now = new Date().toISOString()
    
    // Generate schedule code if not provided
    const scheduleCode = input.scheduleCode || `SCHED-${Date.now()}`
    
    const data: FirebaseSchedule = {
      id,
      schedule_code: scheduleCode,
      route_id: input.routeId,
      operator_id: input.operatorId,
      departure_time: input.departureTime,
      frequency_type: input.frequencyType,
      days_of_week: input.daysOfWeek,
      effective_from: input.effectiveFrom,
      effective_to: input.effectiveTo,
      is_active: true,
      created_at: now,
      updated_at: now,
    }
    
    await firebaseClient.set(`schedules/${id}`, data)
    return scheduleService.getById(id)
  },

  update: async (id: string, input: Partial<ScheduleInput>): Promise<Schedule> => {
    const updateData: any = { updated_at: new Date().toISOString() }
    
    if (input.scheduleCode !== undefined) updateData.schedule_code = input.scheduleCode
    if (input.routeId !== undefined) updateData.route_id = input.routeId
    if (input.operatorId !== undefined) updateData.operator_id = input.operatorId
    if (input.departureTime !== undefined) updateData.departure_time = input.departureTime
    if (input.frequencyType !== undefined) updateData.frequency_type = input.frequencyType
    if (input.daysOfWeek !== undefined) updateData.days_of_week = input.daysOfWeek
    if (input.effectiveFrom !== undefined) updateData.effective_from = input.effectiveFrom
    if (input.effectiveTo !== undefined) updateData.effective_to = input.effectiveTo

    await firebaseClient.update(`schedules/${id}`, updateData)
    return scheduleService.getById(id)
  },

  delete: async (id: string): Promise<void> => {
    await firebaseClient.delete(`schedules/${id}`)
  },
}
