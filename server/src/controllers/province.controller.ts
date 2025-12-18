import { Request, Response } from 'express'

const API_BASE_V1 = 'https://provinces.open-api.vn/api/v1'
const API_BASE_V2 = 'https://provinces.open-api.vn/api/v2'

// Proxy endpoint for provinces V2 API
export const getProvincesV2 = async (_req: Request, res: Response): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_V2}/p/`)
    
    if (!response.ok) {
      throw new Error(`Provinces API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Error fetching provinces V2:', error)
    res.status(500).json({ 
      error: 'Failed to fetch provinces',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Proxy endpoint for provinces V1 API
export const getProvincesV1 = async (_req: Request, res: Response): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_V1}/p/`)
    
    if (!response.ok) {
      throw new Error(`Provinces API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Error fetching provinces V1:', error)
    res.status(500).json({ 
      error: 'Failed to fetch provinces',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Proxy endpoint for districts by province V1
export const getDistrictsByProvinceV1 = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params
    
    if (!code) {
      res.status(400).json({ error: 'Province code is required' })
      return
    }
    
    const response = await fetch(`${API_BASE_V1}/p/${code}?depth=2`)
    
    if (!response.ok) {
      throw new Error(`Districts API error: ${response.status} ${response.statusText}`)
    }
    
    const data: any = await response.json()
    res.json(data.districts || [])
  } catch (error) {
    console.error('Error fetching districts:', error)
    res.status(500).json({ 
      error: 'Failed to fetch districts',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Proxy endpoint for wards by province V2
export const getWardsByProvinceV2 = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params
    
    if (!code) {
      res.status(400).json({ error: 'Province code is required' })
      return
    }
    
    const response = await fetch(`${API_BASE_V2}/p/${code}?depth=2`)
    
    if (!response.ok) {
      throw new Error(`Wards API error: ${response.status} ${response.statusText}`)
    }
    
    const data: any = await response.json()
    res.json(data.wards || [])
  } catch (error) {
    console.error('Error fetching wards:', error)
    res.status(500).json({ 
      error: 'Failed to fetch wards',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

