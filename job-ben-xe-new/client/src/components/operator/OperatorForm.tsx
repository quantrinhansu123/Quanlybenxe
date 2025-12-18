import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "react-toastify"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select } from "@/components/ui/select"
import { operatorService } from "@/services/operator.service"
import { Operator, OperatorInput } from "@/types"
import { provinceService, type Province, type District } from "@/services/province.service"

const operatorSchema = z.object({
  name: z.string().min(1, "Tên đơn vị là bắt buộc"),
  code: z.string().min(1, "Mã đơn vị là bắt buộc"),
  taxCode: z.string().min(1, "Mã số thuế là bắt buộc"),
  isTicketDelegated: z.boolean().optional(),
  province: z.string().min(1, "Tỉnh/Thành phố là bắt buộc"),
  district: z.string().min(1, "Quận/Huyện là bắt buộc"),
  address: z.string().min(1, "Địa chỉ là bắt buộc"),
  phone: z.string().min(1, "Số điện thoại là bắt buộc"),
  email: z.string().email("Email không hợp lệ").min(1, "Email là bắt buộc"),
  representativeName: z.string().min(1, "Người đại diện là bắt buộc"),
  representativePosition: z.string().min(1, "Chức vụ là bắt buộc"),
})

type OperatorFormData = z.infer<typeof operatorSchema>

interface OperatorFormProps {
  operator: Operator | null
  mode: "create" | "edit"
  onClose: () => void
}

export function OperatorForm({ operator, mode, onClose }: OperatorFormProps) {
  const [useApiV2, setUseApiV2] = useState(false) // false = v1 (trước sáp nhập), true = v2 (sau sáp nhập)
  const [provinces, setProvinces] = useState<Province[]>([])
  const [districts, setDistricts] = useState<District[]>([])
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false)
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false)
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | null>(null)
  const isInitialMount = useRef(true)
  const isLoadingDistrictsRef = useRef(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OperatorFormData>({
    resolver: zodResolver(operatorSchema),
    defaultValues: operator
      ? {
          name: operator.name,
          code: operator.code,
          taxCode: operator.taxCode || "",
          isTicketDelegated: operator.isTicketDelegated,
          province: operator.province || "",
          district: operator.district || "",
          address: operator.address || "",
          phone: operator.phone || "",
          email: operator.email || "",
          representativeName: operator.representativeName || "",
          representativePosition: operator.representativePosition || "",
        }
      : {
          isTicketDelegated: false,
        },
  })

  const isTicketDelegated = watch("isTicketDelegated")
  const watchProvince = watch("province")
  const watchDistrict = watch("district")

  // Hàm normalize tên tỉnh để tìm kiếm gần đúng
  const normalizeProvinceName = (name: string): string => {
    if (!name) return ""
    // Loại bỏ các ký tự đặc biệt và chuẩn hóa
    return name
      .replace(/^Thành phố\s+/i, "")
      .replace(/^TP\.?\s*/i, "")
      .replace(/^Tỉnh\s+/i, "")
      .trim()
  }

  // Tìm province theo tên (có thể không khớp chính xác)
  const findProvinceByName = (name: string): Province | undefined => {
    if (!name || provinces.length === 0) return undefined
    
    // Tìm chính xác trước
    let province = provinces.find(p => p.name === name)
    if (province) return province
    
    // Tìm gần đúng
    const normalizedName = normalizeProvinceName(name)
    province = provinces.find(p => {
      const normalizedP = normalizeProvinceName(p.name)
      return normalizedP === normalizedName || 
             p.name.includes(name) || 
             name.includes(p.name) ||
             normalizedP.includes(normalizedName) ||
             normalizedName.includes(normalizedP)
    })
    
    return province
  }

  // Load provinces từ API
  const loadProvinces = async (apiVersion: boolean) => {
    setIsLoadingProvinces(true)
    try {
      const data = apiVersion
        ? await provinceService.getProvincesV2()
        : await provinceService.getProvincesV1()
      setProvinces(data)
    } catch (error) {
      console.error("Failed to load provinces:", error)
      toast.error("Không thể tải danh sách tỉnh thành. Vui lòng thử lại sau.")
    } finally {
      setIsLoadingProvinces(false)
    }
  }

  // Load districts khi chọn province
  const loadDistricts = async (provinceCode: number, apiVersion: boolean): Promise<District[]> => {
    if (!provinceCode) {
      setDistricts([])
      return []
    }

    // Tránh gọi lại nếu đang load
    if (isLoadingDistrictsRef.current) {
      return []
    }

    isLoadingDistrictsRef.current = true
    setIsLoadingDistricts(true)
    try {
      let result: District[] = []
      if (apiVersion) {
        // V2: depth=2 trả về wards (phường/xã) trực tiếp từ province
        const wards = await provinceService.getWardsByProvinceV2(provinceCode)
        // Convert wards to districts format for display
        result = wards.map(w => ({ code: w.code, name: w.name }))
        setDistricts(result)
      } else {
        // V1: depth=2 trả về districts (quận/huyện)
        result = await provinceService.getDistrictsByProvinceV1(provinceCode)
        setDistricts(result)
      }
      return result
    } catch (error) {
      console.error("Failed to load districts:", error)
      toast.error("Không thể tải danh sách quận/huyện. Vui lòng thử lại sau.")
      setDistricts([])
      return []
    } finally {
      setIsLoadingDistricts(false)
      isLoadingDistrictsRef.current = false
    }
  }

  // Load provinces khi component mount
  useEffect(() => {
    loadProvinces(useApiV2)
  }, [])

  // Reload provinces khi đổi API version
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    loadProvinces(useApiV2)
    setDistricts([])
    setValue("province", "")
    setValue("district", "")
    setSelectedProvinceCode(null)
    isLoadingDistrictsRef.current = false
  }, [useApiV2, setValue])

  // Reset form khi operator thay đổi
  useEffect(() => {
    if (operator && mode === "edit") {
      reset({
        name: operator.name,
        code: operator.code,
        taxCode: operator.taxCode || "",
        isTicketDelegated: operator.isTicketDelegated,
        province: operator.province || "",
        district: operator.district || "",
        address: operator.address || "",
        phone: operator.phone || "",
        email: operator.email || "",
        representativeName: operator.representativeName || "",
        representativePosition: operator.representativePosition || "",
      })
    } else if (!operator && mode === "create") {
      reset({
        isTicketDelegated: false,
        province: "",
        district: "",
        address: "",
        phone: "",
        email: "",
        name: "",
        code: "",
        taxCode: "",
        representativeName: "",
        representativePosition: "",
      })
      setDistricts([])
      setSelectedProvinceCode(null)
    }
  }, [operator, mode, reset])

  // Load districts khi operator có province và provinces đã được load (edit mode)
  useEffect(() => {
    if (operator && operator.province && provinces.length > 0 && mode === "edit") {
      const province = findProvinceByName(operator.province)
      if (province && province.code !== selectedProvinceCode) {
        setSelectedProvinceCode(province.code)
        // Cập nhật lại giá trị province trong form nếu tên không khớp chính xác
        if (province.name !== operator.province) {
          setValue("province", province.name)
        }
        loadDistricts(province.code, useApiV2).then((loadedDistricts) => {
          // Tìm district tương ứng sau khi districts đã được load
          if (operator.district && loadedDistricts.length > 0) {
            const districtName = operator.district
            const district = loadedDistricts.find(d => {
              const normalizedD = normalizeProvinceName(d.name)
              const normalizedOpD = normalizeProvinceName(districtName)
              return d.name === districtName ||
                     normalizedD === normalizedOpD ||
                     d.name.includes(districtName) ||
                     districtName.includes(d.name)
            })
            if (district && district.name !== operator.district) {
              setValue("district", district.name)
            }
          }
        })
      }
    }
  }, [operator, provinces, selectedProvinceCode, mode, useApiV2, setValue])

  // Load districts khi province thay đổi (từ dropdown hoặc khi provinces load xong)
  useEffect(() => {
    if (watchProvince && provinces.length > 0) {
      const province = findProvinceByName(watchProvince)
      if (province && province.code !== selectedProvinceCode) {
        setSelectedProvinceCode(province.code)
        loadDistricts(province.code, useApiV2)
        // Reset district when province changes (chỉ trong create mode)
        if (mode === "create") {
          setValue("district", "")
        }
      }
    } else if (!watchProvince) {
      setDistricts([])
      setSelectedProvinceCode(null)
    }
  }, [watchProvince, provinces, selectedProvinceCode, mode, setValue, useApiV2])

  const onSubmit = async (data: OperatorFormData) => {
    try {
      const operatorData: OperatorInput = {
        name: data.name,
        code: data.code,
        taxCode: data.taxCode || undefined,
        isTicketDelegated: data.isTicketDelegated,
        province: data.province && data.province.trim() !== '' ? data.province.trim() : undefined,
        district: data.district && data.district.trim() !== '' ? data.district.trim() : undefined,
        address: data.address || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        representativeName: data.representativeName || undefined,
        representativePosition: data.representativePosition || undefined,
      }

      if (mode === "create") {
        await operatorService.create(operatorData)
        toast.success("Thêm đơn vị vận tải thành công")
      } else if (operator && mode === "edit") {
        await operatorService.update(operator.id, operatorData)
        toast.success("Cập nhật đơn vị vận tải thành công")
      }
      onClose()
    } catch (error: any) {
      console.error("Failed to save operator:", error)
      
      // Handle specific error messages from backend
      const errorMessage = error.response?.data?.error || error.message
      
      if (errorMessage?.includes("already exists") || errorMessage?.includes("duplicate key")) {
        toast.error("Mã đơn vị đã tồn tại. Vui lòng sử dụng mã khác.")
      } else {
        toast.error(errorMessage || "Có lỗi xảy ra. Vui lòng thử lại.")
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full">
      <div className="space-y-6 w-full">
        {/* Section 1: Thông tin đơn vị vận tải */}
        <div className="space-y-4 w-full">
          <h3 className="text-xl font-semibold text-center">Thông tin đơn vị vận tải</h3>
          
          <div className="flex items-center space-x-2">
             <Checkbox 
              id="isTicketDelegated" 
              checked={isTicketDelegated}
              onChange={(e) => {
                setValue("isTicketDelegated", e.target.checked)
              }}
            />
            <Label htmlFor="isTicketDelegated" className="font-normal">Doanh nghiệp ủy thác bến xe bán vé</Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label htmlFor="code">Mã đơn vị <span className="text-red-500">*</span></Label>
              <Input id="code" {...register("code")} placeholder="DV001" />
              {errors.code && <p className="text-sm text-red-500">{errors.code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxCode">Mã số thuế <span className="text-red-500">*</span></Label>
              <Input id="taxCode" {...register("taxCode")} />
              {errors.taxCode && <p className="text-sm text-red-500">{errors.taxCode.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Tên đơn vị <span className="text-red-500">*</span></Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại <span className="text-red-500">*</span></Label>
              <Input id="phone" {...register("phone")} />
              {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <Label className="text-base font-semibold">Địa chỉ</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useApiV2"
                  checked={useApiV2}
                  onChange={(e) => setUseApiV2(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="useApiV2" className="cursor-pointer text-sm font-normal">
                  Sử dụng dữ liệu sau sáp nhập
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="province">
                  Tỉnh/Thành phố <span className="text-red-500">*</span>
                </Label>
                <Select
                  id="province"
                  {...register("province")}
                  value={watchProvince || ""}
                  disabled={isLoadingProvinces}
                  className={errors.province ? "border-red-500" : ""}
                >
                  <option value="">
                    {isLoadingProvinces ? "Đang tải..." : "Tỉnh/Thành phố"}
                  </option>
                  {provinces.map((province) => (
                    <option key={province.code} value={province.name}>
                      {province.name}
                    </option>
                  ))}
                </Select>
                {errors.province && (
                  <p className="text-sm text-red-500">{errors.province.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">
                  {useApiV2 ? "Phường/Xã" : "Quận/Huyện"} <span className="text-red-500">*</span>
                </Label>
                <Select
                  id="district"
                  {...register("district")}
                  value={watchDistrict || ""}
                  disabled={!watchProvince || isLoadingDistricts}
                  className={errors.district ? "border-red-500" : ""}
                >
                  <option value="">
                    {isLoadingDistricts ? "Đang tải..." : useApiV2 ? "Phường/Xã" : "Quận/Huyện"}
                  </option>
                  {districts.map((district) => (
                    <option key={district.code} value={district.name}>
                      {district.name}
                    </option>
                  ))}
                </Select>
                {errors.district && (
                  <p className="text-sm text-red-500">{errors.district.message}</p>
                )}
                {watchProvince && !isLoadingDistricts && districts.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Không có dữ liệu. Vui lòng thử lại hoặc nhập thủ công.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Địa chỉ cụ thể <span className="text-red-500">*</span></Label>
            <Input id="address" {...register("address")} />
            {errors.address && <p className="text-sm text-red-500">{errors.address.message}</p>}
          </div>
        </div>

        {/* Section 2: Thông tin người đại diện pháp luật */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Thông tin người đại diện pháp luật</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="representativeName">Đại diện <span className="text-red-500">*</span></Label>
              <Input id="representativeName" {...register("representativeName")} />
              {errors.representativeName && <p className="text-sm text-red-500">{errors.representativeName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="representativePosition">Chức vụ <span className="text-red-500">*</span></Label>
              <Input id="representativePosition" {...register("representativePosition")} />
              {errors.representativePosition && <p className="text-sm text-red-500">{errors.representativePosition.message}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Đang xử lý..." : (mode === "create" ? "Thêm mới" : "Lưu thay đổi")}
        </Button>
      </div>
    </form>
  )
}
