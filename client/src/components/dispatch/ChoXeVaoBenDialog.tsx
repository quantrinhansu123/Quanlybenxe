import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Search, RefreshCw, ChevronDown } from "lucide-react"
import { toast } from "react-toastify"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DateTimePicker } from "@/components/DatePicker"
import { vehicleService } from "@/services/vehicle.service"
import { routeService } from "@/services/route.service"
import { scheduleService } from "@/services/schedule.service"
import { dispatchService } from "@/services/dispatch.service"
import { driverService } from "@/services/driver.service"
import { CapPhepDialog } from "./CapPhepDialog"
import type { Route, Schedule, Driver, DispatchInput, DispatchRecord } from "@/types"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/store/ui.store"
import type { Shift } from "@/services/shift.service"

interface ChoXeVaoBenDialogProps {
  vehicleOptions: Array<{ id: string; plateNumber: string }>
  onClose: () => void
  onSuccess?: () => void
  open?: boolean
}

export function ChoXeVaoBenDialog({ 
  vehicleOptions, 
  onClose,
  onSuccess,
  open = true
}: ChoXeVaoBenDialogProps) {
  const [vehicleId, setVehicleId] = useState("")
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState("")
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)
  const vehicleDropdownRef = useRef<HTMLDivElement>(null)
  const [entryDateTime, setEntryDateTime] = useState<Date | undefined>(new Date())
  
  const [performPermitAfterEntry, setPerformPermitAfterEntry] = useState(false)
  const [confirmPassengerDrop, setConfirmPassengerDrop] = useState(false)
  const [scheduleId, setScheduleId] = useState("")
  const [passengersArrived, setPassengersArrived] = useState("")
  const [routeId, setRouteId] = useState("")
  const [transportOrderCode, setTransportOrderCode] = useState("")
  const [signAndTransmit, setSignAndTransmit] = useState(true)
  const [printDisplay, setPrintDisplay] = useState(false)
  
  const [routes, setRoutes] = useState<Route[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [transportOrderDisplay] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showPermitDialog, setShowPermitDialog] = useState(false)
  const [permitDispatchRecord, setPermitDispatchRecord] = useState<DispatchRecord | null>(null)
  const { currentShift } = useUIStore()

  // Helper function to get shift ID from currentShift string
  const getShiftIdFromCurrentShift = (): string | undefined => {
    if (!currentShift || currentShift === '<Trống>') {
      return undefined
    }

    const currentShifts = useUIStore.getState().shifts
    if (currentShifts.length === 0) {
      return undefined
    }

    // Parse shift name from currentShift string (format: "Ca 1 (06:00 - 14:00)")
    const match = currentShift.match(/^(.+?)\s*\(/)
    if (!match) {
      return undefined
    }

    const shiftName = match[1].trim()
    const foundShift = currentShifts.find((shift: Shift) => shift.name === shiftName)
    return foundShift?.id
  }

  useEffect(() => {
    if (open) {
      setIsAnimating(true)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [open])

  useEffect(() => {
    loadRoutes()
    // Load shifts if not already loaded
    const { shifts: currentShifts, loadShifts } = useUIStore.getState()
    if (currentShifts.length === 0) {
      loadShifts()
    }
  }, [])

  useEffect(() => {
    if (vehicleId) {
      loadVehicleDetails(vehicleId)
      // Set search query to selected vehicle's plate number
      const selectedVehicle = vehicleOptions.find(v => v.id === vehicleId)
      if (selectedVehicle) {
        setVehicleSearchQuery(selectedVehicle.plateNumber)
      }
    } else {
      setSelectedDriver(null)
    }
  }, [vehicleId])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vehicleDropdownRef.current && !vehicleDropdownRef.current.contains(event.target as Node)) {
        setShowVehicleDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (routeId) {
      loadSchedules(routeId)
    } else {
      setSchedules([])
    }
  }, [routeId])

  const loadRoutes = async () => {
    try {
      const data = await routeService.getAll(undefined, undefined, true)
      setRoutes(data)
    } catch (error) {
      console.error("Failed to load routes:", error)
    }
  }

  const loadVehicleDetails = async (id: string) => {
    try {
      const vehicle = await vehicleService.getById(id)
      
      // Try to get driver for this vehicle's operator
      if (vehicle.operatorId) {
        try {
          const drivers = await driverService.getAll(vehicle.operatorId, true)
          if (drivers.length > 0) {
            setSelectedDriver(drivers[0]) // Use first active driver, or implement selection logic
          } else {
            console.warn("No active drivers found for this operator")
            setSelectedDriver(null)
          }
        } catch (error) {
          console.error("Failed to load driver:", error)
          setSelectedDriver(null)
        }
      } else {
        console.warn("Vehicle does not have an operator")
        setSelectedDriver(null)
      }
    } catch (error) {
      console.error("Failed to load vehicle details:", error)
      setSelectedDriver(null)
    }
  }

  const loadSchedules = async (routeId: string) => {
    try {
      const data = await scheduleService.getAll(routeId, undefined, true)
      setSchedules(data)
    } catch (error) {
      console.error("Failed to load schedules:", error)
    }
  }

  // Filter vehicles based on search query
  const filteredVehicles = vehicleOptions.filter((vehicle) =>
    vehicle.plateNumber.toLowerCase().includes(vehicleSearchQuery.toLowerCase())
  )

  const handleVehicleSelect = (vehicleId: string, plateNumber: string) => {
    setVehicleId(vehicleId)
    setVehicleSearchQuery(plateNumber)
    setShowVehicleDropdown(false)
  }

  const handleVehicleSearchChange = (value: string) => {
    setVehicleSearchQuery(value)
    setShowVehicleDropdown(true)
    // Clear selection if input is cleared
    if (!value) {
      setVehicleId("")
    }
  }

  const handleRefreshTransportOrder = () => {
    // TODO: Implement refresh transport order logic
    toast.info("Chức năng làm mới lệnh vận chuyển đang được phát triển")
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // Kiểm tra các trường bắt buộc cơ bản
    if (!vehicleId) {
      toast.warning("Vui lòng chọn biển kiểm soát")
      return
    }

    if (!entryDateTime) {
      toast.warning("Vui lòng nhập thời gian vào")
      return
    }
    
    if (!selectedDriver) {
      toast.error("Không tìm thấy thông tin lái xe cho xe này")
      return
    }

    // Nếu xác nhận trả khách, các trường này là bắt buộc
    if (confirmPassengerDrop) {
      if (!routeId) {
        toast.warning("Vui lòng chọn tuyến vận chuyển khi xác nhận trả khách")
        return
      }
      if (!passengersArrived || passengersArrived.trim() === "") {
        toast.warning("Vui lòng nhập số khách đến bến")
        return
      }
      if (!transportOrderCode || transportOrderCode.trim() === "") {
        toast.warning("Vui lòng chọn lệnh vận chuyển")
        return
      }
    }

    // Parse entry time from "HH:mm dd/MM/yyyy" format and convert to Vietnam timezone ISO string
    const entryTimeISO = entryDateTime.toISOString()

    setIsLoading(true)
    try {
      const entryShiftId = getShiftIdFromCurrentShift()

      const dispatchData: DispatchInput = {
        vehicleId,
        driverId: selectedDriver.id,
        routeId: routeId || undefined,
        scheduleId: confirmPassengerDrop ? (scheduleId || undefined) : undefined,
        entryTime: entryTimeISO,
        entryShiftId,
      }

      const result = await dispatchService.create(dispatchData)
      
      // If passenger drop is confirmed, record it with routeId if provided
      let updatedRecord = result
      if (confirmPassengerDrop && passengersArrived) {
        updatedRecord = await dispatchService.recordPassengerDrop(
          result.id,
          parseInt(passengersArrived),
          routeId || undefined
        )
      }

      toast.success("Cho xe vào bến thành công!")

      // If perform permit after entry is checked, automatically open permit dialog
      if (performPermitAfterEntry) {
        // Fetch full dispatch record with all related data
        try {
          const fullRecord = await dispatchService.getById(updatedRecord.id)
          setPermitDispatchRecord(fullRecord)
          setShowPermitDialog(true)
          // Don't close this dialog yet, let user complete the permit process
          // The permit dialog will handle closing both dialogs
        } catch (error) {
          console.error("Failed to load dispatch record for permit:", error)
          toast.error("Không thể tải dữ liệu để cấp phép. Vui lòng thử lại sau.")
          // Close dialog normally if we can't load permit data
          if (onSuccess) {
            onSuccess()
          }
          onClose()
        }
      } else {
        // Normal flow: close dialog and call onSuccess
        if (onSuccess) {
          onSuccess()
        }
        onClose()
      }
    } catch (error) {
      console.error("Failed to create dispatch record:", error)
      toast.error("Không thể tạo bản ghi điều độ. Vui lòng thử lại sau.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    // Don't close if permit dialog is open
    if (showPermitDialog) {
      return
    }
    setIsAnimating(false)
    setTimeout(() => {
      onClose()
    }, 300)
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      onClick={handleClose}
    >
      <div
        className={`bg-white w-full h-full overflow-y-auto overflow-x-hidden transition-all duration-300 ${
          isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-[1920px] mx-auto p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header Section - Checkboxes on left, Buttons on right */}
            <div className="flex items-center justify-between pb-5 border-b">
              <div className="flex items-center gap-8">
                <h1 className="text-2xl font-bold text-gray-900">
                  Cho xe vào bến
                </h1>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="performPermitAfterEntry"
                    checked={performPermitAfterEntry}
                    onChange={(e) => setPerformPermitAfterEntry(e.target.checked)}
                  />
                  <Label htmlFor="performPermitAfterEntry" className="cursor-pointer text-sm font-medium">
                    Thực hiện Cấp phép lên nốt sau khi Cho xe vào bến
                  </Label>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClose}
                  disabled={isLoading}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50 px-6"
                >
                  HỦY
                </Button>
                <Button 
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 px-6"
                >
                  {isLoading ? "Đang xử lý..." : "XÁC NHẬN"}
                </Button>
              </div>
            </div>

            {/* Main Content - Two Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Input Fields */}
              <div className="space-y-8">
                {/* Thông tin xe vào bến */}
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">
                    Thông tin xe vào bến
                  </h3>
                  
                  <div>
                    <Label htmlFor="vehicle" className="text-sm font-medium mb-2 block">
                      Biển kiểm soát <span className="text-red-500">(*)</span>
                    </Label>
                    <div className="relative mt-1" ref={vehicleDropdownRef}>
                      <div className="relative">
                        <Input
                          id="vehicle"
                          type="text"
                          value={vehicleSearchQuery}
                          onChange={(e) => handleVehicleSearchChange(e.target.value)}
                          onFocus={() => setShowVehicleDropdown(true)}
                          placeholder="Nhập biển kiểm soát để tìm kiếm"
                          className="pr-10 h-11"
                          required
                        />
                        <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                      
                      {showVehicleDropdown && filteredVehicles.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                          {filteredVehicles.map((vehicle) => (
                            <div
                              key={vehicle.id}
                              onClick={() => handleVehicleSelect(vehicle.id, vehicle.plateNumber)}
                              className={cn(
                                "px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors",
                                vehicleId === vehicle.id && "bg-blue-100"
                              )}
                            >
                              {vehicle.plateNumber}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {showVehicleDropdown && vehicleSearchQuery && filteredVehicles.length === 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg px-3 py-2 text-gray-500 text-sm">
                          Không tìm thấy kết quả
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="entryTime" className="text-sm font-medium mb-2 block">
                      Thời gian vào <span className="text-red-500">(*)</span>
                    </Label>
                    <div className="relative mt-1">
                      <DateTimePicker 
                        date={entryDateTime || null}
                        onDateChange={setEntryDateTime}
                      />
                    </div>
                  </div>
                </div>

                {/* Thông tin xe trả khách */}
                <div className="space-y-5 pt-6 border-t">
                  <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">
                    Thông tin xe trả khách
                  </h3>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="confirmPassengerDrop"
                      checked={confirmPassengerDrop}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setConfirmPassengerDrop(checked)
                        if (!checked) {
                          // Reset các giá trị khi bỏ chọn
                          setScheduleId("")
                          setPassengersArrived("")
                          setRouteId("")
                          setTransportOrderCode("")
                        }
                      }}
                    />
                    <Label htmlFor="confirmPassengerDrop" className="cursor-pointer">
                      Xác nhận trả khách
                    </Label>
                  </div>

                  {confirmPassengerDrop && (
                    <>
                      <div>
                        <Label htmlFor="route" className="text-sm font-medium mb-2 block">
                          Tuyến vận chuyển <span className="text-red-500">(*)</span>
                        </Label>
                        <Select
                          id="route"
                          value={routeId}
                          onChange={(e) => setRouteId(e.target.value)}
                          className="mt-1 h-11"
                          required
                        >
                          <option value="">Chọn tuyến vận chuyển</option>
                          {routes.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.routeName} ({r.routeCode})
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="schedule" className="text-sm font-medium mb-2 block">
                          Biểu đồ giờ
                        </Label>
                        <Select
                          id="schedule"
                          value={scheduleId}
                          onChange={(e) => setScheduleId(e.target.value)}
                          className="mt-1 h-11"
                        >
                          <option value="">Chọn biểu đồ giờ</option>
                          {schedules.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.scheduleCode} - {s.departureTime}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="passengersArrived" className="text-sm font-medium mb-2 block">
                          Số khách đến bến <span className="text-red-500">(*)</span>
                        </Label>
                        <div className="flex gap-2 mt-1">                   
                          <Input
                            id="passengersArrived"
                            type="number"
                            value={passengersArrived}
                            onChange={(e) => setPassengersArrived(e.target.value)}
                            className="flex-1 h-11"
                            min="0"
                            required
                          />                    
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="transportOrderCode" className="text-sm font-medium mb-2 block">
                          Lệnh vận chuyển <span className="text-red-500">(*)</span>
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            id="transportOrderCode"
                            value={transportOrderCode}
                            onChange={(e) => setTransportOrderCode(e.target.value)}
                            className="pr-10 h-11"
                            placeholder="Nhập mã lệnh vận chuyển"
                            required
                          />
                          <button
                            type="button"
                            onClick={handleRefreshTransportOrder}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded transition-colors"
                            title="Làm mới"
                          >
                            <RefreshCw className="h-4 w-4 text-gray-400" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column - Transportation Order Display */}
              <div className="space-y-5">
                <div className="flex items-center gap-6 pb-3 border-b">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="signAndTransmit"
                      checked={signAndTransmit}
                      onChange={(e) => setSignAndTransmit(e.target.checked)}
                    />
                    <Label htmlFor="signAndTransmit" className="cursor-pointer text-sm font-medium">
                      Ký lệnh và truyền tải
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="printDisplay"
                      checked={printDisplay}
                      onChange={(e) => setPrintDisplay(e.target.checked)}
                    />
                    <Label htmlFor="printDisplay" className="cursor-pointer text-sm font-medium">
                      In bản thể hiện
                    </Label>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg bg-gray-50 min-h-[500px] flex items-center justify-center relative">
                  {transportOrderDisplay ? (
                    <div className="p-6 text-sm text-gray-700 w-full h-full">
                      {transportOrderDisplay}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      <p className="text-base">Không có bản thể hiện</p>
                    </div>
                  )}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                    <Search className="h-6 w-6 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Cap Phep Dialog - opened automatically after successful entry */}
      {showPermitDialog && permitDispatchRecord && (
        <CapPhepDialog
          record={permitDispatchRecord}
          open={showPermitDialog}
          onClose={() => {
            setShowPermitDialog(false)
            setPermitDispatchRecord(null)
            // Close the entry dialog after permit dialog closes
            if (onSuccess) {
              onSuccess()
            }
            onClose()
          }}
          onSuccess={() => {
            setShowPermitDialog(false)
            setPermitDispatchRecord(null)
            // Close the entry dialog after permit is issued
            if (onSuccess) {
              onSuccess()
            }
            onClose()
          }}
        />
      )}
    </div>,
    document.body
  )
}

