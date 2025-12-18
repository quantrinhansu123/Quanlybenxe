import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "react-toastify"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { vehicleService } from "@/services/vehicle.service"
import { operatorService } from "@/services/operator.service"
import { provinceService, type Province } from "@/services/province.service"
import type { Vehicle, VehicleInput, Operator } from "@/types"
import { Eye, EyeOff, Upload } from "lucide-react"
import { useState, useEffect } from "react"
import api from "@/lib/api"

const vehicleSchema = z.object({
  plateNumber: z.string().min(1, "Biển số là bắt buộc"),
  operatorId: z.string().optional(),
  vehicleTypeId: z.string().optional(),
  seatCapacity: z.number().min(1, "Số ghế phải lớn hơn 0"),
  bedCapacity: z.number().min(0, "Số giường không hợp lệ"),
  chassisNumber: z.string().optional(),
  engineNumber: z.string().optional(),
  insuranceExpiryDate: z.string().optional(),
  inspectionExpiryDate: z.string().optional(),
  cargoLength: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined
      if (typeof val === 'number' && isNaN(val)) return undefined
      const num = Number(val)
      return isNaN(num) ? undefined : num
    },
    z.number().optional()
  ),
  cargoWidth: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined
      if (typeof val === 'number' && isNaN(val)) return undefined
      const num = Number(val)
      return isNaN(num) ? undefined : num
    },
    z.number().optional()
  ),
  cargoHeight: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined
      if (typeof val === 'number' && isNaN(val)) return undefined
      const num = Number(val)
      return isNaN(num) ? undefined : num
    },
    z.number().optional()
  ),
  gpsProvider: z.string().optional(),
  gpsUsername: z.string().optional(),
  gpsPassword: z.string().optional(),
  province: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
})

type VehicleFormData = z.infer<typeof vehicleSchema>

interface VehicleFormProps {
  vehicle: Vehicle | null
  mode: "create" | "edit"
  onClose: () => void
}

export function VehicleForm({
  vehicle,
  mode,
  onClose,
}: VehicleFormProps) {
  const [autoRegister, setAutoRegister] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [vehicleImage, setVehicleImage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [operators, setOperators] = useState<Operator[]>([])
  const [provinces, setProvinces] = useState<Province[]>([])

  useEffect(() => {
    loadOperators()
    loadProvinces()
  }, [])

  useEffect(() => {
    if (vehicle) {
      setVehicleImage(vehicle.imageUrl || null)
    }
  }, [vehicle])

  const loadOperators = async () => {
    try {
      const data = await operatorService.getAll(true)
      setOperators(data)
    } catch (error) {
      console.error("Failed to load operators:", error)
    }
  }

  const loadProvinces = async () => {
    try {
      const data = await provinceService.getProvincesV2()
      setProvinces(data)
    } catch (error) {
      console.error("Failed to load provinces:", error)
      toast.error("Không thể tải danh sách tỉnh/thành phố")
    }
  }

  // Helper function to format date for input type="date"
  const formatDateForInput = (dateString: string | undefined | null): string => {
    if (!dateString) return ""
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return ""
      return date.toISOString().split("T")[0]
    } catch {
      return ""
    }
  }

  const handleImageClick = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error('Vui lòng chọn file ảnh')
          return
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Kích thước ảnh không được vượt quá 5MB')
          return
        }

        setIsUploading(true)
        try {
          // Upload to Cloudinary via backend
          const formData = new FormData()
          formData.append('image', file) // Changed from 'file' to 'image'
          
          const response = await api.post<{ url: string }>('/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          })
          
          setVehicleImage(response.data.url)
          setValue("imageUrl", response.data.url)
          toast.success('Upload ảnh thành công')
        } catch (error) {
          console.error('Failed to upload image:', error)
          toast.error('Không thể tải ảnh lên. Vui lòng thử lại.')
        } finally {
          setIsUploading(false)
        }
      }
    }
    input.click()
  }

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: vehicle ? {
      plateNumber: vehicle.plateNumber || "",
      operatorId: vehicle.operatorId || "",
      vehicleTypeId: vehicle.vehicleTypeId || "",
      seatCapacity: vehicle.seatCapacity || 1,
      bedCapacity: vehicle.bedCapacity || 0,
      chassisNumber: vehicle.chassisNumber || "",
      engineNumber: vehicle.engineNumber || "",
      insuranceExpiryDate: formatDateForInput(vehicle.insuranceExpiryDate),
      inspectionExpiryDate: formatDateForInput(vehicle.inspectionExpiryDate),
      cargoLength: vehicle.cargoLength || undefined,
      cargoWidth: vehicle.cargoWidth || undefined,
      cargoHeight: vehicle.cargoHeight || undefined,
      gpsProvider: vehicle.gpsProvider || "",
      gpsUsername: vehicle.gpsUsername || "",
      gpsPassword: vehicle.gpsPassword || "",
      province: vehicle.province || "",
      imageUrl: vehicle.imageUrl || "",
    } : {
      operatorId: "",
      seatCapacity: 1,
      bedCapacity: 0,
      imageUrl: "",
    },
  })

  // Reset form values when vehicle prop changes (for edit mode)
  useEffect(() => {
    if (vehicle) {
      const operatorId = vehicle.operatorId ? String(vehicle.operatorId) : ""
      const vehicleTypeId = vehicle.vehicleTypeId ? String(vehicle.vehicleTypeId) : ""
      
      const formValues = {
        plateNumber: vehicle.plateNumber || "",
        operatorId: operatorId,
        vehicleTypeId: vehicleTypeId,
        seatCapacity: vehicle.seatCapacity || 1,
        bedCapacity: vehicle.bedCapacity ?? 0,
        chassisNumber: vehicle.chassisNumber || "",
        engineNumber: vehicle.engineNumber || "",
        insuranceExpiryDate: formatDateForInput(vehicle.insuranceExpiryDate),
        inspectionExpiryDate: formatDateForInput(vehicle.inspectionExpiryDate),
        cargoLength: vehicle.cargoLength || undefined,
        cargoWidth: vehicle.cargoWidth || undefined,
        cargoHeight: vehicle.cargoHeight || undefined,
        gpsProvider: vehicle.gpsProvider || "",
        gpsUsername: vehicle.gpsUsername || "",
        gpsPassword: vehicle.gpsPassword || "",
        province: vehicle.province || "",
        imageUrl: vehicle.imageUrl || "",
      }
      
      console.log("Resetting form with vehicle data:", { 
        vehicle, 
        formValues,
        operatorId,
        operatorsLoaded: operators.length > 0 
      })
      
      // Reset form values
      reset(formValues)
      setVehicleImage(vehicle.imageUrl || null)
      
    } else {
      // Reset to default for create mode
      reset({
        operatorId: "",
        seatCapacity: 1,
        bedCapacity: 0,
        imageUrl: "",
      })
      setVehicleImage(null)
    }
  }, [vehicle, reset, setValue, operators.length])

  const onSubmit = async (data: VehicleFormData) => {
    console.log("Form submitted with data:", data)
    try {
      // Clean up data: remove undefined values for optional fields
      const submitData: any = {
        ...data,
        imageUrl: vehicleImage || "",
      }
      
      // Remove undefined cargo dimensions
      if (submitData.cargoLength === undefined) delete submitData.cargoLength
      if (submitData.cargoWidth === undefined) delete submitData.cargoWidth
      if (submitData.cargoHeight === undefined) delete submitData.cargoHeight
      
      // Note: operatorId và vehicleTypeId cần được gửi đi kể cả khi rỗng để backend có thể cập nhật/xóa
      // Không xóa các field này như các optional fields khác
      
      // Remove empty strings for optional fields
      if (submitData.chassisNumber === "") delete submitData.chassisNumber
      if (submitData.engineNumber === "") delete submitData.engineNumber
      if (submitData.insuranceExpiryDate === "") delete submitData.insuranceExpiryDate
      if (submitData.inspectionExpiryDate === "") delete submitData.inspectionExpiryDate
      if (submitData.gpsProvider === "") delete submitData.gpsProvider
      if (submitData.gpsUsername === "") delete submitData.gpsUsername
      if (submitData.gpsPassword === "") delete submitData.gpsPassword
      if (submitData.province === "") delete submitData.province
      
      console.log("Submitting data:", submitData)
      
      if (mode === "create") {
        console.log("Creating vehicle...")
        await vehicleService.create(submitData as VehicleInput)
        toast.success("Thêm xe thành công!")
      } else if (vehicle) {
        console.log("Updating vehicle...")
        await vehicleService.update(vehicle.id, submitData)
        toast.success("Cập nhật xe thành công!")
      }
      onClose()
    } catch (error: any) {
      console.error("Failed to save vehicle:", error)
      console.error("Error response:", error.response?.data)
      const errorMsg = error.response?.data?.message || error.response?.data?.error || "Có lỗi xảy ra khi lưu thông tin xe"
      toast.error(errorMsg)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Cột trái - Form thông tin */}
        <div className="col-span-8 space-y-6">
          {/* Thông tin xe đăng ký */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-base font-semibold">Thông tin xe đăng ký</h3>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRegister}
                  onChange={(e) => setAutoRegister(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                Tiếp tục đăng ký hoạt động cho xe
              </label>
            </div>

            <div className="space-y-4">
              {/* Hàng 0: Nhà xe */}
              <div className="grid grid-cols-12 gap-4">
                <div className="space-y-2 col-span-12">
                  <Label htmlFor="operatorId" className="text-sm">
                    Nhà xe
                  </Label>
                  <Controller
                    name="operatorId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        id="operatorId"
                        className="h-11"
                        {...field}
                        value={field.value || ""}
                      >
                        <option value="">Chọn nhà xe</option>
                        {operators.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  />
                  {errors.operatorId && (
                    <p className="text-sm text-red-600">{errors.operatorId.message}</p>
                  )}
                </div>
              </div>

              {/* Hàng 1: Biển kiểm soát, Số ghế, Số giường */}
              <div className="grid grid-cols-12 gap-4">
                {/* Biển kiểm soát - bằng với số khung */}
                <div className="space-y-2 col-span-6">
                  <Label htmlFor="plateNumber" className="text-sm">
                    Biển kiểm soát (*)
                  </Label>
                  <Input
                    id="plateNumber"
                    className="h-11"
                    placeholder="Biển kiểm soát (*)"
                    {...register("plateNumber")}
                  />
                  {errors.plateNumber && (
                    <p className="text-sm text-red-600">{errors.plateNumber.message}</p>
                  )}
                </div>

                {/* Số ghế - nhỏ */}
                <div className="space-y-2 col-span-3">
                  <Label htmlFor="seatCapacity" className="text-sm">
                    Số ghế (*)
                  </Label>
                  <Input
                    id="seatCapacity"
                    type="number"
                    className="h-11"
                    placeholder="1"
                    {...register("seatCapacity", { valueAsNumber: true })}
                  />
                  {errors.seatCapacity && (
                    <p className="text-sm text-red-600">{errors.seatCapacity.message}</p>
                  )}
                </div>

                {/* Số giường - nhỏ */}
                <div className="space-y-2 col-span-3">
                  <Label htmlFor="bedCapacity" className="text-sm">
                    Số giường (*)
                  </Label>
                  <Input
                    id="bedCapacity"
                    type="number"
                    className="h-11"
                    placeholder="0"
                    {...register("bedCapacity", { valueAsNumber: true })}
                  />
                </div>
              </div>

              {/* Hàng 2: Số khung và Số máy */}
              <div className="grid grid-cols-2 gap-4">
                {/* Số khung */}
                <div className="space-y-2">
                  <Label htmlFor="chassisNumber" className="text-sm">
                    Số khung
                  </Label>
                  <Input
                    id="chassisNumber"
                    className="h-11"
                    placeholder="Số khung"
                    {...register("chassisNumber")}
                  />
                </div>

                {/* Số máy */}
                <div className="space-y-2">
                  <Label htmlFor="engineNumber" className="text-sm">
                    Số máy
                  </Label>
                  <Input
                    id="engineNumber"
                    className="h-11"
                    placeholder="Số máy"
                    {...register("engineNumber")}
                  />
                </div>
              </div>

              {/* Hàng 3: Tỉnh */}
              <div className="grid grid-cols-12 gap-4">
                <div className="space-y-2 col-span-6">
                  <Label htmlFor="province" className="text-sm">
                    Tỉnh/Thành phố
                  </Label>
                  <Select
                    id="province"
                    className="h-11"
                    {...register("province")}
                  >
                    <option value="">Chọn tỉnh/thành phố</option>
                    {provinces.map((province) => (
                      <option key={province.code} value={province.name}>
                        {province.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Thông tin hạn hiệu lực */}
          <div>
            <h3 className="text-base font-semibold mb-4">Thông tin hạn hiệu lực</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Hạn bảo hiểm xe */}
              <div className="space-y-2">
                <Label htmlFor="insuranceExpiryDate" className="text-sm">
                  Hạn bảo hiểm xe (*)
                </Label>
                <Input
                  id="insuranceExpiryDate"
                  type="date"
                  className="h-11"
                  placeholder="Hạn bảo hiểm xe (*)"
                  {...register("insuranceExpiryDate")}
                />
              </div>

              {/* Hạn đăng kiểm xe */}
              <div className="space-y-2">
                <Label htmlFor="inspectionExpiryDate" className="text-sm">
                  Hạn đăng kiểm xe (*)
                </Label>
                <Input
                  id="inspectionExpiryDate"
                  type="date"
                  className="h-11"
                  placeholder="Hạn đăng kiểm xe (*)"
                  {...register("inspectionExpiryDate")}
                />
              </div>
            </div>
          </div>

          {/* Khoang chứa hàng */}
          <div>
            <h3 className="text-base font-semibold mb-4">Khoang chứa hàng</h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Chiều dài */}
              <div className="space-y-2">
                <Label htmlFor="cargoLength" className="text-sm">
                  Chiều dài (m)
                </Label>
                <Input
                  id="cargoLength"
                  type="number"
                  step="0.1"
                  className="h-11"
                  placeholder="Chiều dài (m)"
                  {...register("cargoLength", { setValueAs: (v) => {
                    if (v === "" || v === null || v === undefined) return undefined
                    const num = Number(v)
                    return isNaN(num) ? undefined : num
                  }})}
                />
              </div>

              {/* Chiều rộng */}
              <div className="space-y-2">
                <Label htmlFor="cargoWidth" className="text-sm">
                  Chiều rộng (m)
                </Label>
                <Input
                  id="cargoWidth"
                  type="number"
                  step="0.1"
                  className="h-11"
                  placeholder="Chiều rộng (m)"
                  {...register("cargoWidth", { setValueAs: (v) => {
                    if (v === "" || v === null || v === undefined) return undefined
                    const num = Number(v)
                    return isNaN(num) ? undefined : num
                  }})}
                />
              </div>

              {/* Chiều cao */}
              <div className="space-y-2">
                <Label htmlFor="cargoHeight" className="text-sm">
                  Chiều cao (m)
                </Label>
                <Input
                  id="cargoHeight"
                  type="number"
                  step="0.1"
                  className="h-11"
                  placeholder="Chiều cao (m)"
                  {...register("cargoHeight", { setValueAs: (v) => {
                    if (v === "" || v === null || v === undefined) return undefined
                    const num = Number(v)
                    return isNaN(num) ? undefined : num
                  }})}
                />
              </div>
            </div>
          </div>

          {/* Thông tin giám sát hành trình */}
          <div>
            <h3 className="text-base font-semibold mb-4">Thông tin giám sát hành trình</h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Hãng GSHT */}
              <div className="space-y-2">
                <Label htmlFor="gpsProvider" className="text-sm">
                  Hãng GSHT
                </Label>
                <Select
                  id="gpsProvider"
                  className="h-11"
                  {...register("gpsProvider")}
                >
                  <option value="">Hãng GSHT</option>
                  <option value="VietMap">VietMap</option>
                  <option value="NaviGo">NaviGo</option>
                  <option value="VIETTEL">VIETTEL</option>
                </Select>
              </div>

              {/* Tài khoản */}
              <div className="space-y-2">
                <Label htmlFor="gpsUsername" className="text-sm">
                  Tài khoản
                </Label>
                <Input
                  id="gpsUsername"
                  className="h-11"
                  placeholder="Tài khoản"
                  {...register("gpsUsername")}
                />
              </div>

              {/* Mật khẩu */}
              <div className="space-y-2">
                <Label htmlFor="gpsPassword" className="text-sm">
                  Mật khẩu
                </Label>
                <div className="relative">
                  <Input
                    id="gpsPassword"
                    type={showPassword ? "text" : "password"}
                    className="h-11 pr-10"
                    placeholder="Mật khẩu"
                    {...register("gpsPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cột phải - Ảnh chụp của xe */}
        <div className="col-span-4">
          <div>
            <h3 className="text-base font-semibold mb-4">Ảnh chụp của xe</h3>
            <div 
              className="w-full h-[300px] bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 relative overflow-hidden cursor-pointer hover:bg-gray-200 transition-colors"
              onClick={handleImageClick}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-sm">Đang tải ảnh...</p>
                </div>
              ) : vehicleImage ? (
                <img src={vehicleImage} alt="Vehicle" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={40} className="text-gray-400" />
                  <p>Click để chọn ảnh</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose} className="min-w-[100px]">
          Hủy
        </Button>
        <Button type="submit" className="min-w-[100px]">Lưu</Button>
      </div>
    </form>
  )
}
