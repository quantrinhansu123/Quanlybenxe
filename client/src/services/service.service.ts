import { firebaseClient } from '@/lib/firebase'
import type { Service, ServiceInput } from '@/types'

interface FirebaseService {
  id: string
  code: string
  name: string
  unit: string
  base_price?: number
  tax_percentage: number
  material_type: string
  use_quantity_formula: boolean
  use_price_formula: boolean
  display_order: number
  is_default: boolean
  auto_calculate_quantity: boolean
  is_active: boolean
  quantity_formula_expression?: string
  price_formula_expression?: string
  created_at: string
  updated_at: string
}

const mapService = (s: FirebaseService): Service => ({
  id: s.id,
  code: s.code,
  name: s.name,
  unit: s.unit,
  taxPercentage: s.tax_percentage,
  materialType: s.material_type,
  useQuantityFormula: s.use_quantity_formula,
  usePriceFormula: s.use_price_formula,
  displayOrder: s.display_order,
  isDefault: s.is_default,
  autoCalculateQuantity: s.auto_calculate_quantity,
  isActive: s.is_active,
  quantityFormulaExpression: s.quantity_formula_expression,
  priceFormulaExpression: s.price_formula_expression,
  createdAt: s.created_at,
  updatedAt: s.updated_at,
})

export const serviceService = {
  getAll: async (isActive?: boolean): Promise<Service[]> => {
    try {
      const data = await firebaseClient.getAsArray<FirebaseService>('services')

      if (!data || data.length === 0) {
        console.log('No services found in Firebase')
        return []
      }

      let filtered = data
      if (isActive !== undefined) {
        filtered = filtered.filter(s => s.is_active === isActive)
      }

      const mapped = filtered.map(mapService).sort((a, b) => a.displayOrder - b.displayOrder)
      console.log(`Loaded ${mapped.length} services from Firebase`)
      return mapped
    } catch (error) {
      console.error('Error fetching services from Firebase:', error)
      return []
    }
  },

  getById: async (id: string): Promise<Service> => {
    try {
      const data = await firebaseClient.get<FirebaseService>(`services/${id}`)
      if (!data) throw new Error('Service not found')
      return mapService({ ...data, id })
    } catch (error) {
      console.error('Error fetching service by id from Firebase:', error)
      throw error
    }
  },

  create: async (input: ServiceInput): Promise<Service> => {
    const id = firebaseClient.generateId()
    const now = new Date().toISOString()

    const data: FirebaseService = {
      id,
      code: input.code,
      name: input.name,
      unit: input.unit,
      base_price: 0,
      tax_percentage: input.taxPercentage,
      material_type: input.materialType,
      use_quantity_formula: input.useQuantityFormula,
      use_price_formula: input.usePriceFormula,
      display_order: input.displayOrder,
      is_default: input.isDefault,
      auto_calculate_quantity: input.autoCalculateQuantity,
      is_active: true,
      quantity_formula_expression: undefined,
      price_formula_expression: undefined,
      created_at: now,
      updated_at: now,
    }

    await firebaseClient.set(`services/${id}`, data)
    return mapService(data)
  },

  update: async (id: string, input: Partial<ServiceInput>): Promise<Service> => {
    const updateData: any = { updated_at: new Date().toISOString() }

    if (input.code !== undefined) updateData.code = input.code
    if (input.name !== undefined) updateData.name = input.name
    if (input.unit !== undefined) updateData.unit = input.unit
    if (input.taxPercentage !== undefined) updateData.tax_percentage = input.taxPercentage
    if (input.materialType !== undefined) updateData.material_type = input.materialType
    if (input.useQuantityFormula !== undefined) updateData.use_quantity_formula = input.useQuantityFormula
    if (input.usePriceFormula !== undefined) updateData.use_price_formula = input.usePriceFormula
    if (input.displayOrder !== undefined) updateData.display_order = input.displayOrder
    if (input.isDefault !== undefined) updateData.is_default = input.isDefault
    if (input.autoCalculateQuantity !== undefined) updateData.auto_calculate_quantity = input.autoCalculateQuantity
    if (input.isActive !== undefined) updateData.is_active = input.isActive

    await firebaseClient.update(`services/${id}`, updateData)
    return serviceService.getById(id)
  },

  delete: async (id: string): Promise<void> => {
    await firebaseClient.delete(`services/${id}`)
  },
}
