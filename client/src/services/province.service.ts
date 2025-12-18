// Province Service - Using static data to avoid CORS issues
// Original API: https://provinces.open-api.vn/ (often blocked by CORS)

import { PROVINCES, getDistrictsByProvince } from '@/constants/vietnam-locations'

export interface Province {
  code: number
  name: string
  districts?: District[]
}

export interface District {
  code: number
  name: string
  wards?: Ward[]
}

export interface Ward {
  code: number
  name: string
}

export const provinceService = {
  // Lấy danh sách tỉnh/thành phố
  getProvincesV1: async (): Promise<Province[]> => {
    return PROVINCES.map((name, index) => ({
      code: index + 1,
      name,
    }))
  },

  // Lấy danh sách tỉnh/thành phố (V2 - same as V1 for static data)
  getProvincesV2: async (): Promise<Province[]> => {
    return PROVINCES.map((name, index) => ({
      code: index + 1,
      name,
    }))
  },

  // Lấy districts của tỉnh
  getDistrictsByProvinceV1: async (provinceCode: number): Promise<District[]> => {
    const provinceName = PROVINCES[provinceCode - 1]
    if (!provinceName) return []
    
    const districts = getDistrictsByProvince(provinceName)
    return districts.map((name, index) => ({
      code: (provinceCode * 100) + index + 1,
      name,
    }))
  },

  // Lấy wards của district (returns empty for static data)
  getWardsByDistrictV1: async (_districtCode: number): Promise<Ward[]> => {
    // Ward data not available in static constants
    return []
  },

  // Lấy wards trực tiếp từ tỉnh (V2)
  getWardsByProvinceV2: async (provinceCode: number): Promise<Ward[]> => {
    // For V2, wards are direct children of provinces
    // Using districts as wards equivalent for static data
    const provinceName = PROVINCES[provinceCode - 1]
    if (!provinceName) return []
    
    const districts = getDistrictsByProvince(provinceName)
    return districts.map((name, index) => ({
      code: (provinceCode * 100) + index + 1,
      name,
    }))
  },

  // Tìm kiếm tỉnh
  searchProvincesV1: async (query: string): Promise<Province[]> => {
    const normalizedQuery = query.toLowerCase()
    return PROVINCES
      .filter(name => name.toLowerCase().includes(normalizedQuery))
      .map((name) => ({
        code: PROVINCES.indexOf(name) + 1,
        name,
      }))
  },

  // Tìm kiếm district
  searchDistrictsV1: async (query: string, provinceCode: number): Promise<District[]> => {
    const provinceName = PROVINCES[provinceCode - 1]
    if (!provinceName) return []
    
    const districts = getDistrictsByProvince(provinceName)
    const normalizedQuery = query.toLowerCase()
    
    return districts
      .filter(name => name.toLowerCase().includes(normalizedQuery))
      .map((name, index) => ({
        code: (provinceCode * 100) + index + 1,
        name,
      }))
  },
}
