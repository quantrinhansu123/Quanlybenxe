import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import {
  Plus,
  Pencil,
  Home,
  Globe,
  AlertTriangle,
  MapPin,
  ChevronRight,
  CheckCircle,
  X as XIcon,
  AlertCircle,
  Clock,
  FileX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { routeService } from "@/services/route.service";
import { scheduleService } from "@/services/schedule.service";
import { dispatchService } from "@/services/dispatch.service";
import { vehicleService } from "@/services/vehicle.service";
import { vehicleBadgeService, type VehicleBadge } from "@/services/vehicle-badge.service";
import { serviceChargeService } from "@/services/service-charge.service";
import { KiemTraGiayToDialog } from "./KiemTraGiayToDialog";
import { LyDoKhongDuDieuKienDialog } from "./LyDoKhongDuDieuKienDialog";
import { ThemDichVuDialog } from "./ThemDichVuDialog";
import { DatePicker } from "@/components/DatePicker";
import { ThemTaiXeDialog } from "./ThemTaiXeDialog";
import type {
  DispatchRecord,
  Route,
  Schedule,
  Vehicle,
  Driver,
  ServiceCharge,
} from "@/types";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useUIStore } from "@/store/ui.store";
import type { Shift } from "@/services/shift.service";

interface CapPhepDialogProps {
  record: DispatchRecord;
  onClose: () => void;
  onSuccess?: () => void;
  open?: boolean;
  readOnly?: boolean;
}

export function CapPhepDialog({
  record,
  onClose,
  onSuccess,
  open = true,
  readOnly = false,
}: CapPhepDialogProps) {
  const [permitType, setPermitType] = useState("fixed"); // "fixed" | "temporary"
  const [transportOrderCode, setTransportOrderCode] = useState(
    record.transportOrderCode || ""
  );
  const [replacementVehicleId, setReplacementVehicleId] = useState("");
  const [seatCount, setSeatCount] = useState(() => {
    // Ưu tiên lấy từ record nếu có, nếu không thì đợi vehicle load
    return record.seatCount?.toString() || "";
  });
  const [bedCount, setBedCount] = useState("0");
  const [hhTicketCount, setHhTicketCount] = useState("0");
  const [hhPercentage, setHhPercentage] = useState("0");
  // const [useHhPercentage, setUseHhPercentage] = useState(true);
  const [entryPlateNumber, setEntryPlateNumber] = useState(
    record.vehiclePlateNumber
  );
  // const [useEntryPlateNumber, setUseEntryPlateNumber] = useState(false);
  const [routeId, setRouteId] = useState(record.routeId || "");
  const [scheduleId, setScheduleId] = useState(record.scheduleId || "");
  const [departureTime, setDepartureTime] = useState("");
  // const [useOtherDepartureTime, setUseOtherDepartureTime] = useState(false);
  const [departureDate, setDepartureDate] = useState(
    record.plannedDepartureTime
      ? format(new Date(record.plannedDepartureTime), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd")
  );

  const [routes, setRoutes] = useState<Route[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [vehicleBadges, setVehicleBadges] = useState<VehicleBadge[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [serviceCharges, setServiceCharges] = useState<ServiceCharge[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [notEligibleDialogOpen, setNotEligibleDialogOpen] = useState(false);
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false);
  const [addDriverDialogOpen, setAddDriverDialogOpen] = useState(false);
  const [serviceDetailsExpanded, setServiceDetailsExpanded] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showZeroAmountConfirm, setShowZeroAmountConfirm] = useState(false);
  const [dailyTripCounts, setDailyTripCounts] = useState<Record<number, number>>({});
  const { currentShift } = useUIStore();

  useEffect(() => {
    if (open) {
      setIsAnimating(true);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  useEffect(() => {
    loadInitialData();
    // Load shifts if not already loaded
    const { shifts: currentShifts, loadShifts } = useUIStore.getState();
    if (currentShifts.length === 0) {
      loadShifts();
    }
  }, []);

  useEffect(() => {
    if (routeId) {
      loadSchedules(routeId);
    }
  }, [routeId]);

  useEffect(() => {
    calculateTotal();
  }, [serviceCharges]);

  // Load daily trip counts for the month (total vehicles per day)
  useEffect(() => {
    if (departureDate) {
      loadDailyTripCounts();
    }
  }, [departureDate]);

  // Tự động điền seatCount và bedCount từ dữ liệu xe khi selectedVehicle thay đổi
  useEffect(() => {
    if (selectedVehicle) {
      // Ưu tiên lấy từ vehicle.seatCapacity nếu có, nếu record chưa có giá trị hoặc bằng 0
      if ((!record.seatCount || record.seatCount === 0) && selectedVehicle.seatCapacity) {
        setSeatCount(selectedVehicle.seatCapacity.toString());
      } else if (record.seatCount && record.seatCount > 0) {
        // Nếu record đã có giá trị hợp lệ, giữ nguyên
        setSeatCount(record.seatCount.toString());
      }
      // Tự động điền bedCount từ vehicle.bedCapacity
      if (selectedVehicle.bedCapacity !== undefined && selectedVehicle.bedCapacity !== null) {
        setBedCount(selectedVehicle.bedCapacity.toString());
      }
    }
  }, [selectedVehicle, record.seatCount]);

  const loadInitialData = async () => {
    try {
      const [routesData, badgesData] = await Promise.all([
        routeService.getAll(undefined, undefined, true),
        vehicleBadgeService.getAll(),
      ]);
      setRoutes(routesData);
      setVehicleBadges(badgesData);

      if (record.vehicleId) {
        const vehicle = await vehicleService.getById(record.vehicleId);
        setSelectedVehicle(vehicle);

        // Tự động điền seatCount và bedCount từ dữ liệu xe
        // Ưu tiên dùng giá trị từ vehicle.seatCapacity nếu record chưa có giá trị hoặc bằng 0
        if ((!record.seatCount || record.seatCount === 0) && vehicle.seatCapacity) {
          setSeatCount(vehicle.seatCapacity.toString());
        } else if (record.seatCount && record.seatCount > 0) {
          // Nếu record đã có giá trị hợp lệ, giữ nguyên
          setSeatCount(record.seatCount.toString());
        }
        // Tự động điền bedCount từ vehicle.bedCapacity
        if (vehicle.bedCapacity !== undefined && vehicle.bedCapacity !== null) {
          setBedCount(vehicle.bedCapacity.toString());
        }

        if (vehicle.operatorId) {
          // Only load the assigned driver initially, not all drivers
          if (record.driver) {
            setDrivers([record.driver]);
          } else {
            setDrivers([]);
          }
        }
      }

      if (record.id) {
        const charges = await serviceChargeService.getAll(record.id);
        setServiceCharges(charges);
      }

      if (record.routeId) {
        setRouteId(record.routeId);
        const schedulesData = await scheduleService.getAll(
          record.routeId,
          undefined,
          true
        );
        setSchedules(schedulesData);
        if (record.scheduleId) {
          setScheduleId(record.scheduleId);
        }
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  };

  const loadSchedules = async (routeId: string) => {
    try {
      const data = await scheduleService.getAll(routeId, undefined, true);
      setSchedules(data);
    } catch (error) {
      console.error("Failed to load schedules:", error);
    }
  };

  const calculateTotal = () => {
    const total = serviceCharges.reduce(
      (sum, charge) => sum + charge.totalAmount,
      0
    );
    setTotalAmount(total);
  };

  // Helper function to get shift ID from currentShift string
  const getShiftIdFromCurrentShift = (): string | undefined => {
    if (!currentShift || currentShift === '<Trống>') {
      return undefined;
    }

    // Format: "Ca 1 (06:00 - 14:00)"
    // Try to find matching shift in shifts array
    const currentShifts = useUIStore.getState().shifts;
    if (currentShifts.length === 0) {
      return undefined;
    }

    // Parse shift name from currentShift string
    const match = currentShift.match(/^(.+?)\s*\(/);
    if (!match) {
      return undefined;
    }

    const shiftName = match[1].trim();
    const foundShift = currentShifts.find((shift: Shift) => shift.name === shiftName);
    return foundShift?.id;
  };

  const loadDailyTripCounts = async () => {
    try {
      if (!departureDate) {
        setDailyTripCounts({});
        return;
      }

      // Get start and end of the month from departureDate
      const monthDate = new Date(departureDate);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      // Load ALL dispatch records (not just for this vehicle) to get total vehicles per day
      const dispatchRecords = await dispatchService.getAll();

      // Count unique vehicles per day
      const counts: Record<number, number> = {};
      const vehiclesByDay: Record<number, Set<string>> = {};

      dispatchRecords.forEach((dispatchRecord) => {
        // Use plannedDepartureTime if available, otherwise use entryTime
        const recordDate = dispatchRecord.plannedDepartureTime
          ? new Date(dispatchRecord.plannedDepartureTime)
          : dispatchRecord.entryTime
          ? new Date(dispatchRecord.entryTime)
          : null;

        if (recordDate && recordDate >= monthStart && recordDate <= monthEnd) {
          const day = recordDate.getDate();
          
          // Initialize Set for this day if not exists
          if (!vehiclesByDay[day]) {
            vehiclesByDay[day] = new Set();
          }
          
          // Add vehicle ID to the set for this day (Set automatically handles duplicates)
          if (dispatchRecord.vehicleId) {
            vehiclesByDay[day].add(dispatchRecord.vehicleId);
          }
        }
      });

      // Convert Set sizes to counts
      Object.keys(vehiclesByDay).forEach((dayStr) => {
        const day = parseInt(dayStr, 10);
        counts[day] = vehiclesByDay[day].size;
      });

      setDailyTripCounts(counts);
    } catch (error) {
      console.error("Failed to load daily trip counts:", error);
      setDailyTripCounts({});
    }
  };

  const submitPermit = async () => {
    setIsLoading(true);
    try {
      const plannedDepartureTime =
        departureTime
          ? new Date(`${departureDate}T${departureTime}`).toISOString()
          : record.plannedDepartureTime || new Date().toISOString();

      const permitShiftId = getShiftIdFromCurrentShift();

      await dispatchService.issuePermit(record.id, {
        transportOrderCode,
        plannedDepartureTime,
        seatCount: parseInt(seatCount),
        permitStatus: "approved",
        routeId,
        scheduleId,
        replacementVehicleId: replacementVehicleId || undefined,
        permitShiftId,
      });

      toast.success("Cấp phép lên nốt thành công!");

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: any) {
      console.error("Failed to issue permit:", error);
      if (error.response?.data?.code === '23505' || error.message?.includes('duplicate key') || error.response?.data?.message?.includes('duplicate key')) {
        toast.error(`Mã lệnh vận chuyển ${transportOrderCode} đã tồn tại. Vui lòng chọn mã khác.`);
      } else {
        toast.error("Không thể cấp phép. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEligible = async () => {
    if (!transportOrderCode || !routeId || !scheduleId || !departureDate) {
      toast.warning("Vui lòng điền đầy đủ các trường bắt buộc");
      return;
    }

    if (totalAmount === 0) {
      setShowZeroAmountConfirm(true);
      return;
    }

    await submitPermit();
  };

  const handleNotEligible = () => {
    setNotEligibleDialogOpen(true);
  };

  const handleNotEligibleConfirm = async (
    selectedReasons: string[],
    options: {
      createOrder: boolean;
      signAndTransmit: boolean;
      printDisplay: boolean;
    }
  ) => {
    // Options can be used for future processing: createOrder, signAndTransmit, printDisplay
    void options; // Suppress unused variable warning until implemented
    setIsLoading(true);
    try {
      // Danh sách các lý do từ LyDoKhongDuDieuKienDialog
      const reasonDescriptions: Record<string, string> = {
        driver_license_insufficient:
          "Không có hoặc có nhưng không đủ số lượng giấy phép lái xe so với số lái xe ghi trên lệnh vận chuyển",
        driver_license_expired:
          "Giấy phép lái xe đã hết hạn hoặc sử dụng giấy phép lái xe giả",
        driver_license_class_mismatch:
          "Hạng giấy phép lái xe không phù hợp với các loại xe được phép điều khiển",
        driver_info_mismatch:
          "Thông tin của lái xe không đúng với thông tin được ghi trên lệnh vận chuyển",
        driver_alcohol: "Lái xe sử dụng rượu bia",
        driver_drugs: "Lái xe sử dụng chất ma tuý",
      };

      // Tạo rejection reason từ các lý do đã chọn
      const rejectionReason = selectedReasons
        .map((id) => reasonDescriptions[id] || id)
        .join("; ");

      // Tính toán plannedDepartureTime
      const plannedDepartureTime =
        departureTime && departureDate
          ? new Date(`${departureDate}T${departureTime}`).toISOString()
          : record.plannedDepartureTime || new Date().toISOString();

      // Cập nhật trạng thái từ chối cấp phép
      const permitShiftId = getShiftIdFromCurrentShift();

      await dispatchService.issuePermit(record.id, {
        transportOrderCode: transportOrderCode || undefined,
        plannedDepartureTime,
        seatCount: parseInt(seatCount) || 0,
        permitStatus: "rejected",
        rejectionReason: rejectionReason,
        routeId: routeId || undefined,
        scheduleId: scheduleId || undefined,
        replacementVehicleId: replacementVehicleId || undefined,
        permitShiftId,
      });

      toast.success("Cấp phép thành công!");

      if (onSuccess) {
        onSuccess();
      }
      setNotEligibleDialogOpen(false);
      onClose();
    } catch (error: any) {
      console.error("Failed to issue permit:", error);
      if (error.response?.data?.code === '23505' || error.message?.includes('duplicate key') || error.response?.data?.message?.includes('duplicate key')) {
        toast.error(`Mã lệnh vận chuyển ${transportOrderCode} đã tồn tại. Vui lòng chọn mã khác.`);
      } else {
        toast.error("Không thể cấp phép. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Document status types for better UX
  type DocumentStatus = 'valid' | 'expired' | 'expiring_soon' | 'missing';

  interface DocumentCheckResult {
    name: string;
    status: DocumentStatus;
    expiryDate?: string;
    daysRemaining?: number;
  }

  const getDocumentStatus = (expiryDate?: string): { status: DocumentStatus; daysRemaining?: number } => {
    if (!expiryDate) return { status: 'missing' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) return { status: 'expired', daysRemaining };
    if (daysRemaining <= 30) return { status: 'expiring_soon', daysRemaining };
    return { status: 'valid', daysRemaining };
  };

  const getDocumentsCheckResults = (): DocumentCheckResult[] => {
    const docs = selectedVehicle?.documents;

    const documentTypes = [
      { key: 'registration', name: 'Đăng ký xe', data: docs?.registration },
      { key: 'operation_permit', name: 'Giấy phép KD vận tải', data: docs?.operation_permit },
      { key: 'inspection', name: 'Đăng kiểm xe', data: docs?.inspection },
      { key: 'insurance', name: 'Bảo hiểm xe', data: docs?.insurance },
    ];

    return documentTypes.map(({ name, data }) => {
      const { status, daysRemaining } = getDocumentStatus(data?.expiryDate);
      return {
        name,
        status,
        expiryDate: data?.expiryDate,
        daysRemaining,
      };
    });
  };

  const checkAllDocumentsValid = (): boolean => {
    const results = getDocumentsCheckResults();
    return results.every(r => r.status === 'valid' || r.status === 'expiring_soon');
  };

  const getOverallStatus = (): { isValid: boolean; validCount: number; totalCount: number } => {
    const results = getDocumentsCheckResults();
    const validCount = results.filter(r => r.status === 'valid' || r.status === 'expiring_soon').length;
    return {
      isValid: validCount === results.length,
      validCount,
      totalCount: results.length,
    };
  };

  const handleDocumentDialogSuccess = () => {
    // Reload vehicle data after document update
    if (record.vehicleId) {
      loadInitialData();
    }
  };

  const handleAddServiceSuccess = () => {
    if (record.id) {
      // Reload service charges
      serviceChargeService.getAll(record.id).then((charges) => {
        setServiceCharges(charges);
      });
      // Reload daily trip counts to reflect the new service
      loadDailyTripCounts();
    }
  };

  const handleAddDriverSuccess = (driver: Driver) => {
    // Add the selected driver to the list if not already present
    if (!drivers.find((d) => d.id === driver.id)) {
      setDrivers([...drivers, driver]);
    }
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!open) return null;

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
          {/* Header with action buttons */}
          <div className="flex justify-between items-center pb-4 border-b mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {readOnly ? "Xem Cấp phép lên nốt" : "Cấp phép lên nốt"}
            </h1>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                {readOnly ? "Đóng" : "HỦY"}
              </Button>
              {!readOnly && (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleNotEligible}
                    disabled={isLoading}
                  >
                    KHÔNG ĐỦ ĐIỀU KIỆN
                  </Button>
                  <Button
                    type="button"
                    onClick={handleEligible}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    ĐỦ ĐIỀU KIỆN
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Thông tin chuyến đi & Loại cấp phép */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Thông tin chuyến đi
                </h2>
                <Select
                  id="permitType"
                  value={permitType}
                  onChange={(e) => setPermitType(e.target.value)}
                  className="w-40"
                  disabled={readOnly}
                >
                  <option value="fixed">Cố định</option>
                  <option value="temporary">Tạm thời</option>
                </Select>
              </div>

              {/* Biển số đăng ký & Chọn xe được đi thay */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plateNumber">Biển số đăng ký</Label>
                  <Input
                    id="plateNumber"
                    value={record.vehiclePlateNumber}
                    className="mt-1 bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="replacementVehicle">
                    Chọn xe được đi thay
                  </Label>
                  <Select
                    id="replacementVehicle"
                    value={replacementVehicleId}
                    onChange={(e) => setReplacementVehicleId(e.target.value)}
                    className="mt-1"
                    disabled={readOnly}
                  >
                    <option value="">--</option>
                    {vehicleBadges
                      .filter(badge => badge.license_plate_sheet && badge.status === 'active')
                      .map((badge) => (
                        <option
                          key={badge.id}
                          value={badge.id}
                          className={badge.operational_status === 'dang_chay' ? 'text-orange-600' : 'text-green-600'}
                        >
                          {badge.license_plate_sheet} {badge.operational_status === 'dang_chay' ? '(Đang chạy)' : '(Sẵn sàng)'}
                        </option>
                      ))}
                  </Select>
                  {/* Warning indicator for selected vehicle */}
                  {replacementVehicleId && (() => {
                    const selectedBadge = vehicleBadges.find(b => b.id === replacementVehicleId);
                    if (selectedBadge?.operational_status === 'dang_chay') {
                      return (
                        <div className="flex items-center gap-1.5 mt-1.5 text-orange-600 text-xs">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Xe đang chạy - Không sẵn sàng để đi thay</span>
                        </div>
                      );
                    }
                    if (selectedBadge?.operational_status === 'trong_ben') {
                      return (
                        <div className="flex items-center gap-1.5 mt-1.5 text-green-600 text-xs">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Xe đang trong bến - Sẵn sàng đi thay</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Biển số khi vào & Đơn vị vận tải */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="entryPlateNumber">Biển số khi vào</Label>
                  <Input
                    id="entryPlateNumber"
                    value={entryPlateNumber}
                    onChange={(e) => setEntryPlateNumber(e.target.value)}
                    className="mt-1"
                    readOnly={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="operator">Đơn vị vận tải</Label>
                  <Input
                    id="operator"
                    value={selectedVehicle?.operator?.name || ""}
                    className="mt-1 bg-gray-50"
                    readOnly
                  />
                </div>
              </div>

              {/* Giờ vào bến & Biểu đồ giờ */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="entryTime">Giờ vào bến</Label>
                  <Input
                    id="entryTime"
                    value={format(
                      new Date(record.entryTime),
                      "HH:mm dd/MM/yyyy"
                    )}
                    className="mt-1 bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="schedule">
                    Biểu đồ giờ <span className="text-red-500">(*)</span>
                  </Label>
                  <Select
                    id="schedule"
                    value={scheduleId}
                    onChange={(e) => setScheduleId(e.target.value)}
                    className="mt-1"
                    required
                    disabled={!routeId || readOnly}
                  >
                    <option value="">Chọn giờ</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {format(
                          new Date(`2000-01-01T${s.departureTime}`),
                          "HH:mm:ss"
                        )}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Lái xe table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Lái xe</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddDriverDialogOpen(true)}
                    disabled={!selectedVehicle?.operatorId || readOnly}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Thêm
                  </Button>
                </div>
                <div className="border border-gray-200 rounded-lg p-4 min-h-[100px] bg-white">
                  {drivers.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">
                      Không có dữ liệu!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {drivers.map((driver) => (
                        <div
                          key={driver.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <span className="text-sm font-medium">
                            {driver.fullName}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{driver.phone || "Chưa có SĐT"}</span>
                            <span className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-medium">
                              {driver.licenseClass}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ngày trong tháng */}
              <div>
                <Label className="mb-2 block">
                  Ngày trong tháng (Tổng số xe chạy/ngày)
                </Label>
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <div
                        key={day}
                        className="flex items-center gap-1 text-sm"
                      >
                        <span className="font-medium">{day}</span>
                        <span className="text-blue-600">
                          ({dailyTripCounts[day] || 0})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Column */}
            <div className="space-y-4">
              {/* Lệnh vận chuyển */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Label htmlFor="transportOrderCode">
                    Lệnh vận chuyển <span className="text-red-500">(*)</span>
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    id="transportOrderCode"
                    value={transportOrderCode}
                    onChange={(e) => setTransportOrderCode(e.target.value)}
                    className="mt-1"
                    required
                    placeholder="Nhập mã lệnh vận chuyển"
                    autoComplete="off"
                    readOnly={readOnly}
                  />
                </div>
              </div>

              {/* Số ghế, Số giường, Số vé HH, % HH */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="seatCount">Số ghế</Label>
                  <Input
                    id="seatCount"
                    type="number"
                    value={seatCount}
                    onChange={(e) => setSeatCount(e.target.value)}
                    className="mt-1"
                    min="0"
                    readOnly={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="bedCount">Số giường</Label>
                  <Input
                    id="bedCount"
                    type="number"
                    value={bedCount}
                    onChange={(e) => setBedCount(e.target.value)}
                    className="mt-1"
                    min="0"
                    readOnly={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="hhTicketCount">Số vé HH</Label>
                  <Input
                    id="hhTicketCount"
                    type="number"
                    value={hhTicketCount}
                    onChange={(e) => setHhTicketCount(e.target.value)}
                    className="mt-1"
                    min="0"
                    readOnly={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="hhPercentage">% HH</Label>
                  <Input
                    id="hhPercentage"
                    type="number"
                    value={hhPercentage}
                    onChange={(e) => setHhPercentage(e.target.value)}
                    className="mt-1"
                    min="0"
                    max="100"
                    readOnly={readOnly}
                  />
                </div>
              </div>

              {/* Tuyến vận chuyển */}
              <div>
                <Label htmlFor="route">
                  Tuyến vận chuyển <span className="text-red-500">(*)</span>
                </Label>
                <Select
                  id="route"
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                  className="mt-1"
                  required
                  disabled={readOnly}
                >
                  <option value="">Chọn tuyến</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeName} ({r.routeCode})
                      {r.distanceKm ? ` (${r.distanceKm} Km)` : ""}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Giờ xuất bến khác & Ngày xuất bến */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="otherDepartureTime">Giờ xuất bến khác</Label>
                  <Input
                    id="otherDepartureTime"
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="mt-1"
                    readOnly={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="departureDate">
                    Ngày xuất bến <span className="text-red-500">(*)</span>
                  </Label>
                  <div className="relative mt-1">
                    <DatePicker
                      date={departureDate ? new Date(departureDate) : null}
                      onDateChange={(date) => setDepartureDate(date ? format(date, "yyyy-MM-dd") : "")}
                      placeholder="Chọn ngày xuất bến"
                      disabled={readOnly}
                    />
                  </div>
                </div>
              </div>

              {/* Giá dịch vụ table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Giá dịch vụ</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddServiceDialogOpen(true)}
                    disabled={readOnly}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Thêm
                  </Button>
                </div>
                <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                  {/* Header Row */}
                  <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center px-4 py-2 bg-gray-50 border-b">
                    <Checkbox checked={true} onChange={() => {}} disabled={readOnly} />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Mã đơn hàng</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setAddServiceDialogOpen(true)}
                        disabled={readOnly}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-sm font-medium">
                      Thành tiền (VNĐ)
                    </span>
                  </div>

                  {/* Expandable Service Row */}
                  <div className="border-b">
                    <div
                      className="grid grid-cols-[auto_1fr_auto] gap-4 items-center px-4 py-3 cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setServiceDetailsExpanded(!serviceDetailsExpanded)
                      }
                    >
                      <Checkbox
                        checked={true}
                        onChange={() => {}}
                        onClick={(e) => e.stopPropagation()}
                        disabled={readOnly}
                      />
                      <div className="flex items-center gap-2">
                        <ChevronRight
                          className={`h-4 w-4 text-gray-400 transition-transform ${
                            serviceDetailsExpanded ? "rotate-90" : ""
                          }`}
                        />
                        <span className="text-sm">
                          Dịch vụ của chuyến đi hiện tại
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {totalAmount.toLocaleString("vi-VN")}
                      </span>
                    </div>

                    {/* Service Details */}
                    {serviceDetailsExpanded && (
                      <div className="bg-gray-50">
                        <table className="w-full">
                          <thead className="border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                                Tên dịch vụ
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">
                                Tổng tiền (VNĐ)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {serviceCharges.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={2}
                                  className="px-4 py-8 text-center text-gray-400 text-sm"
                                >
                                  Không có dữ liệu!
                                </td>
                              </tr>
                            ) : (
                              serviceCharges.map((charge) => (
                                <tr
                                  key={charge.id}
                                  className="border-b border-gray-200 last:border-b-0"
                                >
                                  <td className="px-4 py-2 text-sm">
                                    {charge.serviceType?.name || "Dịch vụ"}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-right">
                                    {charge.totalAmount.toLocaleString("vi-VN")}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Total Row */}
                  <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center px-4 py-3 bg-white">
                    <div></div>
                    <span className="text-sm font-semibold">Tổng tiền</span>
                    <span className="text-sm font-semibold">
                      {totalAmount.toLocaleString("vi-VN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Ảnh xe vào bến */}
              <div>
                <Label className="mb-2 block">Ảnh xe vào bến</Label>
                <div className="border border-gray-200 rounded-lg bg-white min-h-[250px] flex items-center justify-center relative">
                  <p className="text-gray-400 text-sm">Chưa có ảnh</p>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Điều kiện thông tin xe - Detailed View */}
              <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                {/* Header with overall status */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                  <div className="flex items-center gap-2">
                    <Label className="font-semibold text-gray-900">
                      Điều kiện thông tin xe
                    </Label>
                    {(() => {
                      const { isValid, validCount, totalCount } = getOverallStatus();
                      return (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isValid
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {validCount}/{totalCount}
                        </span>
                      );
                    })()}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDocumentDialogOpen(true)}
                    className="h-8 w-8 p-0"
                    title="Cập nhật giấy tờ"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>

                {/* Document list with individual status */}
                <div className="divide-y divide-gray-100">
                  {getDocumentsCheckResults().map((doc, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between px-4 py-2.5 ${
                        doc.status === 'expired' ? 'bg-red-50' :
                        doc.status === 'missing' ? 'bg-gray-50' :
                        doc.status === 'expiring_soon' ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Status Icon */}
                        {doc.status === 'valid' && (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                        {doc.status === 'expiring_soon' && (
                          <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        )}
                        {doc.status === 'expired' && (
                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        {doc.status === 'missing' && (
                          <FileX className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        )}

                        {/* Document name */}
                        <span className={`text-sm ${
                          doc.status === 'missing' ? 'text-gray-500' : 'text-gray-700'
                        }`}>
                          {doc.name}
                        </span>
                      </div>

                      {/* Status text */}
                      <div className="text-right">
                        {doc.status === 'valid' && doc.daysRemaining && (
                          <span className="text-xs text-green-600">
                            Còn {doc.daysRemaining} ngày
                          </span>
                        )}
                        {doc.status === 'expiring_soon' && doc.daysRemaining !== undefined && (
                          <span className="text-xs text-yellow-600 font-medium">
                            {doc.daysRemaining === 0
                              ? 'Hết hạn hôm nay!'
                              : `Còn ${doc.daysRemaining} ngày`}
                          </span>
                        )}
                        {doc.status === 'expired' && doc.daysRemaining && (
                          <span className="text-xs text-red-600 font-medium">
                            Hết hạn {Math.abs(doc.daysRemaining)} ngày
                          </span>
                        )}
                        {doc.status === 'missing' && (
                          <span className="text-xs text-gray-400">
                            Chưa có
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary footer */}
                <div className={`px-4 py-2.5 border-t ${
                  checkAllDocumentsValid()
                    ? 'bg-green-50 border-green-100'
                    : 'bg-red-50 border-red-100'
                }`}>
                  {checkAllDocumentsValid() ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Đủ điều kiện cấp phép
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-700">
                      <XIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Không đủ điều kiện - Cần bổ sung giấy tờ
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Kiểm tra GSHT */}
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <Label className="font-semibold mb-3 block">
                  Kiểm tra GSHT
                </Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Home className="h-4 w-4" />
                    <span>(Chưa đăng nhập)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Globe className="h-4 w-4" />
                    <span>(Chưa đăng nhập)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>(Chưa đăng nhập)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>(Chưa đăng nhập)</span>
                  </div>
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <Label htmlFor="notes">Ghi chú</Label>
                <textarea
                  id="notes"
                  rows={4}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Nhập ghi chú..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Document Validity Dialog */}
        {record.vehicleId && (
          <KiemTraGiayToDialog
            vehicleId={record.vehicleId}
            open={documentDialogOpen}
            onClose={() => setDocumentDialogOpen(false)}
            onSuccess={handleDocumentDialogSuccess}
          />
        )}

        {/* Not Eligible Reason Dialog */}
        <LyDoKhongDuDieuKienDialog
          open={notEligibleDialogOpen}
          onClose={() => setNotEligibleDialogOpen(false)}
          onConfirm={handleNotEligibleConfirm}
        />

        {/* Add Service Dialog */}
        {record.id && (
          <ThemDichVuDialog
            dispatchRecordId={record.id}
            open={addServiceDialogOpen}
            onClose={() => setAddServiceDialogOpen(false)}
            onSuccess={handleAddServiceSuccess}
          />
        )}

        {/* Add Driver Dialog */}
        {selectedVehicle?.operatorId && (
          <ThemTaiXeDialog
            operatorId={selectedVehicle.operatorId}
            open={addDriverDialogOpen}
            onClose={() => setAddDriverDialogOpen(false)}
            onSuccess={handleAddDriverSuccess}
          />
        )}

        {/* Zero Amount Confirmation Dialog */}
        {showZeroAmountConfirm && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 mb-4 text-yellow-600">
                <AlertTriangle className="h-6 w-6" />
                <h3 className="text-lg font-bold text-gray-900">Cảnh báo</h3>
              </div>
              <p className="text-gray-600 mb-6">
                <strong>Tổng đơn hàng 0 đồng.</strong> <br />
                Bạn có muốn tiếp tục?
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowZeroAmountConfirm(false)}
                >
                  Hủy
                </Button>
                <Button
                  onClick={() => {
                    setShowZeroAmountConfirm(false);
                    submitPermit();
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Tiếp tục
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
