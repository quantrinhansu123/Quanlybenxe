import { firebaseClient } from '@/lib/firebase'
import type { ServiceFormula, ServiceFormulaInput } from '@/types'

interface FirebaseServiceFormula {
  id: string
  code: string
  name: string
  description: string
  formula_type: string
  formula_expression: string
  is_active: boolean
  created_at: string
  updated_at: string
}

const mapServiceFormula = (f: FirebaseServiceFormula): ServiceFormula => ({
  id: f.id,
  code: f.code,
  name: f.name,
  description: f.description,
  formulaType: f.formula_type as 'quantity' | 'price',
  formulaExpression: f.formula_expression,
  isActive: f.is_active,
  createdAt: f.created_at,
  updatedAt: f.updated_at,
})

export const serviceFormulaService = {
  getAll: async (formulaType?: 'quantity' | 'price', isActive?: boolean): Promise<ServiceFormula[]> => {
    try {
      const data = await firebaseClient.getAsArray<FirebaseServiceFormula>('service_formulas')
      
      let filtered = data
      if (formulaType) {
        filtered = filtered.filter(f => f.formula_type === formulaType)
      }
      if (isActive !== undefined) {
        filtered = filtered.filter(f => f.is_active === isActive)
      }

      return filtered.map(mapServiceFormula).sort((a, b) => a.name.localeCompare(b.name))
    } catch (error) {
      console.error('Error fetching service formulas from Firebase:', error)
      return []
    }
  },

  getById: async (id: string): Promise<ServiceFormula> => {
    try {
      const data = await firebaseClient.get<FirebaseServiceFormula>(`service_formulas/${id}`)
      if (!data) throw new Error('Service formula not found')
      return mapServiceFormula({ id, ...data })
    } catch (error) {
      console.error('Error fetching service formula by id from Firebase:', error)
      throw error
    }
  },

  create: async (input: ServiceFormulaInput): Promise<ServiceFormula> => {
    const id = firebaseClient.generateId()
    const now = new Date().toISOString()
    
    const data: FirebaseServiceFormula = {
      id,
      code: input.code,
      name: input.name,
      description: input.description || '',
      formula_type: input.formulaType,
      formula_expression: input.formulaExpression || '',
      is_active: input.isActive !== false,
      created_at: now,
      updated_at: now,
    }
    
    await firebaseClient.set(`service_formulas/${id}`, data)
    return mapServiceFormula(data)
  },

  update: async (id: string, input: Partial<ServiceFormulaInput>): Promise<ServiceFormula> => {
    const updateData: any = { updated_at: new Date().toISOString() }
    
    if (input.code !== undefined) updateData.code = input.code
    if (input.name !== undefined) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description
    if (input.formulaType !== undefined) updateData.formula_type = input.formulaType
    if (input.formulaExpression !== undefined) updateData.formula_expression = input.formulaExpression
    if (input.isActive !== undefined) updateData.is_active = input.isActive

    await firebaseClient.update(`service_formulas/${id}`, updateData)
    return serviceFormulaService.getById(id)
  },

  delete: async (id: string): Promise<void> => {
    await firebaseClient.delete(`service_formulas/${id}`)
  },
}
