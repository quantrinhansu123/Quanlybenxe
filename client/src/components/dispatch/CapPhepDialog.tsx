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
  Truck,
  Users,
  FileText,
  CreditCard,
  Shield,
  Camera,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Autocomplete } from "@/components/ui/autocomplete";
import { routeService } from "@/services/route.service";
import { scheduleService } from "@/services/schedule.service";
import { dispatchService } from "@/services/dispatch.service";
import { vehicleService } from "@/services/vehicle.service";
import { vehicleBadgeService, type VehicleBadge } from "@/services/vehicle-badge.service";
import { serviceChargeService } from "@/services/service-charge.service";
import { operatorService } from "@/services/operator.service";
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
  Operator,
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

// Reusable styled components - Light Theme
const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`
    relative overflow-hidden rounded-2xl 
    bg-white border border-gray-200/80
    shadow-sm hover:shadow-md transition-shadow duration-300
    ${className}
  `}>
    {children}
  </div>
);

const SectionHeader = ({ icon: Icon, title, badge, action }: { 
  icon: React.ElementType; 
  title: string; 
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-sm shadow-blue-500/20">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="font-semibold text-gray-800 tracking-tight">{title}</h3>
      {badge}
    </div>
    {action}
  </div>
);

const FormField = ({ label, required, children, className = "" }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-600 mb-2">
      {label}
      {required && <span className="text-rose-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const StyledInput = ({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={`
      w-full px-4 py-2.5 rounded-xl
      bg-gray-50 border border-gray-200
      text-gray-800 placeholder-gray-400
      focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white
      transition-all duration-200
      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100
      ${className}
    `}
    {...props}
  />
);

const StyledSelect = ({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={`
      w-full px-4 py-2.5 rounded-xl
      bg-gray-50 border border-gray-200
      text-gray-800
      focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white
      transition-all duration-200
      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100
      ${className}
    `}
    {...props}
  >
    {children}
  </select>
);

export function CapPhepDialog({
  record,
  onClose,
  onSuccess,
  open = true,
  readOnly = false,
}: CapPhepDialogProps) {
  const [permitType, setPermitType] = useState("fixed");
  const [transportOrderCode, setTransportOrderCode] = useState(record.transportOrderCode || "");
  const [replacementVehicleId, setReplacementVehicleId] = useState("");
  const [seatCount, setSeatCount] = useState(() => record.seatCount?.toString() || "");
  const [bedCount, setBedCount] = useState("0");
  const [hhTicketCount, setHhTicketCount] = useState("0");
  const [hhPercentage, setHhPercentage] = useState("0");
  const [entryPlateNumber, setEntryPlateNumber] = useState(record.vehiclePlateNumber || "");
  const [registeredPlateNumber, setRegisteredPlateNumber] = useState(record.vehiclePlateNumber || "");
  const [routeId, setRouteId] = useState(record.routeId || "");
  const [scheduleId, setScheduleId] = useState(record.scheduleId || "");
  const [departureTime, setDepartureTime] = useState("");
  const [departureDate, setDepartureDate] = useState(
    record.plannedDepartureTime
      ? format(new Date(record.plannedDepartureTime), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd")
  );

  const [routes, setRoutes] = useState<Route[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [vehicleBadges, setVehicleBadges] = useState<VehicleBadge[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [serviceCharges, setServiceCharges] = useState<ServiceCharge[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("");
  const [operatorNameFromVehicle, setOperatorNameFromVehicle] = useState<string>("");
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

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  useEffect(() => {
    const init = async () => {
      setIsInitialLoading(true);
      await loadInitialData();
      setIsInitialLoading(false);
    };
    init();
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

  const [tripCountsLoaded, setTripCountsLoaded] = useState(false);
  useEffect(() => {
    if (departureDate && !tripCountsLoaded) {
      loadDailyTripCounts();
      setTripCountsLoaded(true);
    }
  }, [departureDate, tripCountsLoaded]);

  useEffect(() => {
    if (selectedVehicle) {
      if ((!record.seatCount || record.seatCount === 0) && selectedVehicle.seatCapacity) {
        setSeatCount(selectedVehicle.seatCapacity.toString());
      } else if (record.seatCount && record.seatCount > 0) {
        setSeatCount(record.seatCount.toString());
      }
      if (selectedVehicle.bedCapacity !== undefined && selectedVehicle.bedCapacity !== null) {
        setBedCount(selectedVehicle.bedCapacity.toString());
      }
      if (!registeredPlateNumber && selectedVehicle.plateNumber) {
        setRegisteredPlateNumber(selectedVehicle.plateNumber);
      }
      if (!entryPlateNumber && selectedVehicle.plateNumber) {
        setEntryPlateNumber(selectedVehicle.plateNumber);
      }
    }
  }, [selectedVehicle, record.seatCount, entryPlateNumber, registeredPlateNumber]);

  useEffect(() => {
    const plateNumber = registeredPlateNumber || entryPlateNumber;
    if (!plateNumber || vehicles.length === 0) return;

    const normalizedPlate = plateNumber.replace(/[.\-\s]/g, '').toUpperCase();
    const matchedVehicle = vehicles.find(v =>
      v.plateNumber && v.plateNumber.replace(/[.\-\s]/g, '').toUpperCase() === normalizedPlate
    );

    if (matchedVehicle && matchedVehicle.id !== selectedVehicle?.id) {
      setSelectedVehicle(matchedVehicle);
      if (matchedVehicle.operatorId && !selectedOperatorId) {
        setSelectedOperatorId(matchedVehicle.operatorId);
      }
      if (matchedVehicle.operatorName) {
        setOperatorNameFromVehicle(matchedVehicle.operatorName);
      } else if (matchedVehicle.operator?.name) {
        setOperatorNameFromVehicle(matchedVehicle.operator.name);
      }
    }
  }, [registeredPlateNumber, entryPlateNumber, vehicles]);

  const loadInitialData = async () => {
    try {
      const promises: Promise<any>[] = [
        routeService.getLegacy(),
        operatorService.getLegacy(),
        vehicleService.getAll(undefined, true),
        vehicleBadgeService.getAll(),
      ];
      
      if (record.routeId) {
        promises.push(scheduleService.getAll(record.routeId, undefined, true));
      }
      
      if (record.id) {
        promises.push(serviceChargeService.getAll(record.id));
      }

      const results = await Promise.all(promises);
      
      const legacyRoutesData = results[0];
      const operatorsData = results[1];
      const vehiclesData = results[2];
      const badgesData = results[3];
      
      let nextIdx = 4;
      const schedulesData = record.routeId ? results[nextIdx++] : [];
      const chargesData = record.id ? results[nextIdx] : [];

      const routesForDropdown = legacyRoutesData.map((r: any) => ({
        id: r.id,
        routeName: r.routePath || `${r.departureProvince} - ${r.arrivalProvince}`,
        routeCode: r.routeCode,
        routeType: r.routeType,
        distanceKm: r.distanceKm,
        destinationId: null,
        destination: { id: null, name: r.arrivalProvince, code: r.arrivalProvinceOld },
      }));
      
      setRoutes(routesForDropdown);
      setOperators(operatorsData);
      setVehicles(vehiclesData);
      setVehicleBadges(badgesData || []);
      
      if (record.routeId) {
        setRouteId(record.routeId);
        setSchedules(schedulesData);
        if (record.scheduleId) {
          setScheduleId(record.scheduleId);
        }
      }
      
      if (record.id && chargesData) {
        setServiceCharges(chargesData);
      }

      let vehicleFound = false;
      if (record.vehicleId && vehiclesData.length > 0) {
        const vehicle = vehiclesData.find((v: Vehicle) => v.id === record.vehicleId);
        if (vehicle) {
          vehicleFound = true;
          setSelectedVehicle(vehicle);

          if ((!record.seatCount || record.seatCount === 0) && vehicle.seatCapacity) {
            setSeatCount(vehicle.seatCapacity.toString());
          }
          if (vehicle.bedCapacity !== undefined && vehicle.bedCapacity !== null) {
            setBedCount(vehicle.bedCapacity.toString());
          }

          if (!registeredPlateNumber && vehicle.plateNumber) {
            setRegisteredPlateNumber(vehicle.plateNumber);
          }
          if (!entryPlateNumber && vehicle.plateNumber) {
            setEntryPlateNumber(vehicle.plateNumber);
          }

          if (vehicle.operatorId) {
            setSelectedOperatorId(vehicle.operatorId);
            if (record.driver) {
              setDrivers([record.driver]);
            } else {
              setDrivers([]);
            }
          }
          
          if (vehicle.operatorName) {
            setOperatorNameFromVehicle(vehicle.operatorName);
          } else if (vehicle.operator?.name) {
            setOperatorNameFromVehicle(vehicle.operator.name);
          }
        }
      }

      if (!vehicleFound && record.vehicleId) {
        try {
          const badgesData = await vehicleBadgeService.getAll();
          setVehicleBadges(badgesData);
          const matchingBadge = badgesData.find((b: VehicleBadge) => b.vehicle_id === record.vehicleId);
          if (matchingBadge && matchingBadge.license_plate_sheet) {
            if (!registeredPlateNumber) {
              setRegisteredPlateNumber(matchingBadge.license_plate_sheet);
            }
            if (!entryPlateNumber) {
              setEntryPlateNumber(matchingBadge.license_plate_sheet);
            }
          }
        } catch (badgeError) {
          console.warn("Could not load vehicle badges:", badgeError);
        }
      }

      if (record.seatCount && record.seatCount > 0) {
        setSeatCount(record.seatCount.toString());
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  };

  const [schedulesCache, setSchedulesCache] = useState<Record<string, Schedule[]>>({});
  
  const loadSchedules = async (routeId: string) => {
    try {
      if (schedulesCache[routeId]) {
        setSchedules(schedulesCache[routeId]);
        return;
      }
      const data = await scheduleService.getAll(routeId, undefined, true);
      setSchedules(data);
      setSchedulesCache(prev => ({ ...prev, [routeId]: data }));
    } catch (error) {
      console.error("Failed to load schedules:", error);
    }
  };

  const calculateTotal = () => {
    const total = serviceCharges.reduce((sum, charge) => sum + charge.totalAmount, 0);
    setTotalAmount(total);
  };

  const getShiftIdFromCurrentShift = (): string | undefined => {
    if (!currentShift || currentShift === '<Trống>') {
      return undefined;
    }
    const currentShifts = useUIStore.getState().shifts;
    if (currentShifts.length === 0) {
      return undefined;
    }
    const match = currentShift.match(/^(.+?)\s*\(/);
    if (!match) {
      return undefined;
    }
    const shiftName = match[1].trim();
    const foundShift = currentShifts.find((shift: Shift) => shift.name === shiftName);
    return foundShift?.id;
  };

  const [cachedDispatchRecords, setCachedDispatchRecords] = useState<DispatchRecord[] | null>(null);
  
  const loadDailyTripCounts = async () => {
    try {
      if (!departureDate) {
        setDailyTripCounts({});
        return;
      }

      const monthDate = new Date(departureDate);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      let dispatchRecords = cachedDispatchRecords;
      if (!dispatchRecords) {
        dispatchRecords = await dispatchService.getAll();
        setCachedDispatchRecords(dispatchRecords);
      }

      const counts: Record<number, number> = {};
      const vehiclesByDay: Record<number, Set<string>> = {};

      dispatchRecords.forEach((dispatchRecord) => {
        const recordDate = dispatchRecord.plannedDepartureTime
          ? new Date(dispatchRecord.plannedDepartureTime)
          : dispatchRecord.entryTime
          ? new Date(dispatchRecord.entryTime)
          : null;

        if (recordDate && recordDate >= monthStart && recordDate <= monthEnd) {
          const day = recordDate.getDate();
          
          if (!vehiclesByDay[day]) {
            vehiclesByDay[day] = new Set();
          }
          
          if (dispatchRecord.vehicleId) {
            vehiclesByDay[day].add(dispatchRecord.vehicleId);
          }
        }
      });

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
        routeId: routeId || undefined,
        scheduleId: scheduleId || undefined,
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
      const errorData = error.response?.data;
      if (errorData?.code === '23505' ||
          errorData?.error?.includes('đã tồn tại') ||
          errorData?.error?.includes('duplicate key')) {
        toast.error(`Mã lệnh vận chuyển "${transportOrderCode}" đã tồn tại. Vui lòng chọn mã khác.`);
      } else {
        toast.error(errorData?.error || "Không thể cấp phép. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEligible = async () => {
    if (!transportOrderCode || !routeId || !departureDate) {
      toast.warning("Vui lòng điền đầy đủ các trường bắt buộc");
      return;
    }

    if (!scheduleId && !departureTime) {
      toast.warning("Vui lòng chọn biểu đồ giờ hoặc nhập giờ xuất bến khác");
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
    void options;
    setIsLoading(true);
    try {
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

      const rejectionReason = selectedReasons
        .map((id) => reasonDescriptions[id] || id)
        .join("; ");

      const plannedDepartureTime =
        departureTime && departureDate
          ? new Date(`${departureDate}T${departureTime}`).toISOString()
          : record.plannedDepartureTime || new Date().toISOString();

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
      const errorData = error.response?.data;
      if (errorData?.code === '23505' ||
          errorData?.error?.includes('đã tồn tại') ||
          errorData?.error?.includes('duplicate key')) {
        toast.error(`Mã lệnh vận chuyển "${transportOrderCode}" đã tồn tại. Vui lòng chọn mã khác.`);
      } else {
        toast.error(errorData?.error || "Không thể cấp phép. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  };

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

  const normalizePlate = (plate: string): string => {
    return plate.replace(/[.\-\s]/g, '').toUpperCase();
  };

  const getMatchingBadge = (): VehicleBadge | undefined => {
    const plateNumber = registeredPlateNumber || entryPlateNumber || selectedVehicle?.plateNumber;
    if (!plateNumber || !vehicleBadges.length) return undefined;

    const normalizedPlate = normalizePlate(plateNumber);
    return vehicleBadges.find(badge =>
      badge.license_plate_sheet && normalizePlate(badge.license_plate_sheet) === normalizedPlate
    );
  };

  const getDocumentsCheckResults = (): DocumentCheckResult[] => {
    const matchingBadge = getMatchingBadge();
    const results: DocumentCheckResult[] = [];

    if (matchingBadge) {
      const { status, daysRemaining } = getDocumentStatus(matchingBadge.expiry_date);
      results.push({
        name: 'Phù hiệu xe',
        status,
        expiryDate: matchingBadge.expiry_date,
        daysRemaining,
      });
    } else {
      results.push({
        name: 'Phù hiệu xe',
        status: 'valid',
        expiryDate: undefined,
        daysRemaining: 999,
      });
    }

    results.push({
      name: 'Đăng ký xe',
      status: 'valid',
      expiryDate: undefined,
      daysRemaining: 999,
    });

    results.push({
      name: 'Đăng kiểm xe',
      status: 'valid',
      expiryDate: undefined,
      daysRemaining: 999,
    });

    results.push({
      name: 'Bảo hiểm xe',
      status: 'valid',
      expiryDate: undefined,
      daysRemaining: 999,
    });

    return results;
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
    if (record.vehicleId) {
      loadInitialData();
    }
  };

  const handleAddServiceSuccess = () => {
    if (record.id) {
      serviceChargeService.getAll(record.id).then((charges) => {
        setServiceCharges(charges);
      });
      loadDailyTripCounts();
    }
  };

  const handleAddDriverSuccess = (driver: Driver) => {
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
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleClose}
    >
      {/* Light background with subtle pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-gray-50 to-blue-50">
        <div className="absolute inset-0 opacity-40" 
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
                              radial-gradient(circle at 75% 75%, rgba(16, 185, 129, 0.05) 0%, transparent 50%)`
          }}
        />
      </div>

      {/* Main content */}
      <div
        className={`relative w-full h-full overflow-y-auto overflow-x-hidden transition-all duration-500 ease-out ${
          isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-[1920px] mx-auto p-6 lg:p-8">
          {/* Loading state */}
          {isInitialLoading && (
            <div className="flex items-center justify-center h-[80vh]">
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
                </div>
                <p className="text-gray-500 font-medium">Đang tải dữ liệu...</p>
              </div>
            </div>
          )}
          
          {!isInitialLoading && (
            <>
              {/* Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 tracking-tight">
                      {readOnly ? "Xem Cấp phép lên nốt" : "Cấp phép lên nốt"}
                    </h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                      Biển số: <span className="text-gray-700 font-medium">{record.vehiclePlateNumber || "---"}</span>
                      {record.entryTime && (
                        <span className="ml-3">
                          Vào bến: <span className="text-gray-700">{format(new Date(record.entryTime), "HH:mm dd/MM")}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                {/* Action buttons */}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={handleClose}
                    disabled={isLoading}
                    className="px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                  >
                    {readOnly ? "Đóng" : "Hủy"}
                  </Button>
                  {!readOnly && (
                    <>
                      <Button
                        type="button"
                        onClick={handleNotEligible}
                        disabled={isLoading}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 text-white font-medium hover:from-rose-600 hover:to-red-600 shadow-lg shadow-rose-500/25 transition-all"
                      >
                        Không đủ điều kiện
                      </Button>
                      <Button
                        type="button"
                        onClick={handleEligible}
                        disabled={isLoading}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-medium hover:from-emerald-600 hover:to-green-600 shadow-lg shadow-emerald-500/25 transition-all"
                      >
                        Đủ điều kiện
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Main grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ===== LEFT COLUMN ===== */}
                <div className="space-y-6">
                  {/* Thông tin xe */}
                  <GlassCard>
                    <SectionHeader 
                      icon={Truck} 
                      title="Thông tin xe" 
                      badge={
                        <Select
                          value={permitType}
                          onChange={(e) => setPermitType(e.target.value)}
                          className="ml-auto w-28 text-xs py-1.5 px-3 rounded-lg bg-gray-100 border-gray-200 text-gray-700"
                          disabled={readOnly}
                        >
                          <option value="fixed">Cố định</option>
                          <option value="temporary">Tạm thời</option>
                        </Select>
                      }
                    />
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="Biển số đăng ký">
                          <Autocomplete
                            value={registeredPlateNumber || selectedVehicle?.plateNumber || ""}
                            onChange={(value) => setRegisteredPlateNumber(value)}
                            options={vehicleBadges
                              .filter(badge => badge.license_plate_sheet)
                              .map(badge => ({
                                value: badge.license_plate_sheet,
                                label: `${badge.license_plate_sheet} ${badge.operational_status === 'dang_chay' ? '(Đang chạy)' : '(Trong bến)'}`
                              }))}
                            placeholder="Chọn hoặc nhập biển số"
                            disabled={readOnly}
                            className="bg-gray-50 border-gray-200 rounded-xl"
                          />
                        </FormField>
                        <FormField label="Xe đi thay">
                          <StyledSelect
                            value={replacementVehicleId}
                            onChange={(e) => setReplacementVehicleId(e.target.value)}
                            disabled={readOnly}
                          >
                            <option value="">-- Chọn xe --</option>
                            {vehicleBadges
                              .filter(badge => badge.license_plate_sheet)
                              .slice(0, 200)
                              .map((badge) => (
                                <option key={badge.id} value={badge.id}>
                                  {badge.license_plate_sheet} {badge.operational_status === 'dang_chay' ? '(Đang chạy)' : '(Trong bến)'}
                                </option>
                              ))}
                          </StyledSelect>
                          {replacementVehicleId && (() => {
                            const selectedBadge = vehicleBadges.find(b => b.id === replacementVehicleId);
                            if (selectedBadge?.operational_status === 'dang_chay') {
                              return (
                                <div className="flex items-center gap-1.5 mt-2 text-amber-600 text-xs">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span>Xe đang chạy</span>
                                </div>
                              );
                            }
                            return (
                              <div className="flex items-center gap-1.5 mt-2 text-emerald-600 text-xs">
                                <CheckCircle className="h-3.5 w-3.5" />
                                <span>Xe trong bến</span>
                              </div>
                            );
                          })()}
                        </FormField>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="Biển số khi vào">
                          <Autocomplete
                            value={entryPlateNumber}
                            onChange={(value) => setEntryPlateNumber(value)}
                            options={vehicleBadges
                              .filter(badge => badge.license_plate_sheet)
                              .map(badge => ({
                                value: badge.license_plate_sheet,
                                label: `${badge.license_plate_sheet}`
                              }))}
                            placeholder="Nhập biển số"
                            disabled={readOnly}
                            className="bg-gray-50 border-gray-200 rounded-xl"
                          />
                        </FormField>
                        <FormField label="Đơn vị vận tải">
                          {operatorNameFromVehicle && !selectedOperatorId ? (
                            <StyledInput
                              value={operatorNameFromVehicle}
                              readOnly
                              className="bg-gray-100"
                            />
                          ) : (
                            <StyledSelect
                              value={selectedOperatorId}
                              onChange={(e) => setSelectedOperatorId(e.target.value)}
                              disabled={readOnly}
                            >
                              <option value="">{operatorNameFromVehicle || "-- Chọn đơn vị --"}</option>
                              {operators.map((op) => (
                                <option key={op.id} value={op.id}>
                                  {op.name} {op.code ? `(${op.code})` : ''}
                                </option>
                              ))}
                            </StyledSelect>
                          )}
                        </FormField>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="Giờ vào bến">
                          <StyledInput
                            value={format(new Date(record.entryTime), "HH:mm dd/MM/yyyy")}
                            readOnly
                            className="bg-gray-100"
                          />
                        </FormField>
                        <FormField label="Biểu đồ giờ" required={!departureTime}>
                          <StyledSelect
                            value={scheduleId}
                            onChange={(e) => setScheduleId(e.target.value)}
                            disabled={!routeId || readOnly}
                          >
                            <option value="">
                              {!routeId ? "Chọn tuyến trước" : schedules.length === 0 ? "Không có biểu đồ" : "Chọn giờ"}
                            </option>
                            {schedules.map((s) => (
                              <option key={s.id} value={s.id}>
                                {format(new Date(`2000-01-01T${s.departureTime}`), "HH:mm:ss")}
                              </option>
                            ))}
                          </StyledSelect>
                        </FormField>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Lái xe */}
                  <GlassCard>
                    <SectionHeader 
                      icon={Users} 
                      title="Lái xe"
                      action={
                        <Button
                          type="button"
                          onClick={() => setAddDriverDialogOpen(true)}
                          disabled={readOnly}
                          className="h-8 px-3 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border-0 text-xs font-medium transition-all"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Thêm
                        </Button>
                      }
                    />
                    <div className="p-5">
                      {drivers.length === 0 ? (
                        <div className="text-center py-8">
                          <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">Chưa có lái xe</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {drivers.map((driver) => (
                            <div
                              key={driver.id}
                              className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm">
                                  <span className="text-sm font-semibold text-white">
                                    {driver.fullName.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-800">{driver.fullName}</p>
                                  <p className="text-xs text-gray-500">{driver.phone || "Chưa có SĐT"}</p>
                                </div>
                              </div>
                              <span className="px-2 py-1 text-xs font-medium rounded-lg bg-gray-200 text-gray-600">
                                {driver.licenseClass}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </GlassCard>

                  {/* Ngày trong tháng - Calendar Heat Map - KEEP ORIGINAL LIGHT THEME */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-gray-700">
                        Lịch hoạt động tháng {departureDate ? new Date(departureDate).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }) : ''}
                      </Label>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200"></span>
                          0
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-sm bg-emerald-200"></span>
                          1-2
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-sm bg-emerald-400"></span>
                          3-5
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-sm bg-emerald-600"></span>
                          6+
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl p-4 border border-gray-200/60 shadow-sm">
                      {/* Week day headers */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d) => (
                          <div key={d} className="text-center text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                            {d}
                          </div>
                        ))}
                      </div>
                      
                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {(() => {
                          const today = new Date();
                          const currentDay = today.getDate();
                          const selectedDate = departureDate ? new Date(departureDate) : new Date();
                          const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                          const startDay = firstDayOfMonth.getDay();
                          const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
                          const isCurrentMonth = selectedDate.getMonth() === today.getMonth() && selectedDate.getFullYear() === today.getFullYear();
                          
                          const emptyCells = Array.from({ length: startDay }, (_, i) => (
                            <div key={`empty-${i}`} className="aspect-square" />
                          ));
                          
                          const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
                            const day = i + 1;
                            const count = dailyTripCounts[day] || 0;
                            const isToday = isCurrentMonth && day === currentDay;
                            const isSelected = departureDate && new Date(departureDate).getDate() === day;
                            
                            const getBgColor = (c: number) => {
                              if (c === 0) return 'bg-gray-100 border-gray-200';
                              if (c <= 2) return 'bg-emerald-200 border-emerald-300';
                              if (c <= 5) return 'bg-emerald-400 border-emerald-500 text-white';
                              return 'bg-emerald-600 border-emerald-700 text-white';
                            };
                            
                            return (
                              <div
                                key={day}
                                className={`
                                  relative aspect-square rounded-md border flex flex-col items-center justify-center
                                  transition-all duration-200 cursor-default group
                                  ${getBgColor(count)}
                                  ${isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                                  ${isSelected ? 'ring-2 ring-amber-500 ring-offset-1' : ''}
                                  hover:scale-110 hover:shadow-md hover:z-10
                                `}
                                title={`Ngày ${day}: ${count} xe`}
                              >
                                <span className={`text-xs font-semibold ${count > 2 ? '' : 'text-gray-700'}`}>
                                  {day}
                                </span>
                                {count > 0 && (
                                  <span className={`text-[9px] font-bold ${count > 2 ? '' : 'text-emerald-700'}`}>
                                    {count}
                                  </span>
                                )}
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 shadow-lg">
                                  {count} chuyến
                                </div>
                              </div>
                            );
                          });
                          
                          return [...emptyCells, ...dayCells];
                        })()}
                      </div>
                      
                      {/* Summary footer */}
                      <div className="mt-3 pt-3 border-t border-gray-200/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <span className="font-medium">Tổng tháng:</span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold">
                            {Object.values(dailyTripCounts).reduce((a, b) => a + b, 0)} chuyến
                          </span>
                        </div>
                        <div className="text-gray-400">
                          Ngày cao nhất: <span className="font-semibold text-gray-600">{Math.max(...Object.values(dailyTripCounts), 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ===== MIDDLE COLUMN ===== */}
                <div className="space-y-6">
                  {/* Lệnh vận chuyển */}
                  <GlassCard>
                    <SectionHeader icon={FileText} title="Lệnh vận chuyển" />
                    <div className="p-5 space-y-4">
                      <FormField label="Mã lệnh vận chuyển" required>
                        <StyledInput
                          value={transportOrderCode}
                          onChange={(e) => setTransportOrderCode(e.target.value)}
                          placeholder="Nhập mã lệnh vận chuyển"
                          autoComplete="off"
                          readOnly={readOnly}
                        />
                      </FormField>

                      <div className="grid grid-cols-4 gap-3">
                        <FormField label="Số ghế">
                          <StyledInput
                            type="number"
                            value={seatCount}
                            onChange={(e) => setSeatCount(e.target.value)}
                            min="0"
                            readOnly={readOnly}
                          />
                        </FormField>
                        <FormField label="Số giường">
                          <StyledInput
                            type="number"
                            value={bedCount}
                            onChange={(e) => setBedCount(e.target.value)}
                            min="0"
                            readOnly={readOnly}
                          />
                        </FormField>
                        <FormField label="Số vé HH">
                          <StyledInput
                            type="number"
                            value={hhTicketCount}
                            onChange={(e) => setHhTicketCount(e.target.value)}
                            min="0"
                            readOnly={readOnly}
                          />
                        </FormField>
                        <FormField label="% HH">
                          <StyledInput
                            type="number"
                            value={hhPercentage}
                            onChange={(e) => setHhPercentage(e.target.value)}
                            min="0"
                            max="100"
                            readOnly={readOnly}
                          />
                        </FormField>
                      </div>

                      <FormField label="Tuyến vận chuyển" required>
                        <Autocomplete
                          value={routeId}
                          onChange={(value) => setRouteId(value)}
                          options={routes.map((r) => ({
                            value: r.id,
                            label: `${r.routeName} (${r.routeCode})${r.distanceKm ? ` - ${r.distanceKm} Km` : ""}`,
                          }))}
                          placeholder="Gõ để tìm tuyến..."
                          disabled={readOnly}
                          className="w-full"
                        />
                      </FormField>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="Giờ xuất bến khác" required={!scheduleId}>
                          <StyledInput
                            type="time"
                            value={departureTime}
                            onChange={(e) => setDepartureTime(e.target.value)}
                            readOnly={readOnly}
                          />
                        </FormField>
                        <FormField label="Ngày xuất bến" required>
                          <div className="relative">
                            <DatePicker
                              date={departureDate ? new Date(departureDate) : null}
                              onDateChange={(date) => setDepartureDate(date ? format(date, "yyyy-MM-dd") : "")}
                              placeholder="Chọn ngày"
                              disabled={readOnly}
                            />
                          </div>
                        </FormField>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Giá dịch vụ */}
                  <GlassCard>
                    <SectionHeader 
                      icon={CreditCard} 
                      title="Giá dịch vụ"
                      action={
                        <Button
                          type="button"
                          onClick={() => setAddServiceDialogOpen(true)}
                          disabled={!record.id || readOnly}
                          className="h-8 px-3 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border-0 text-xs font-medium transition-all"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Thêm
                        </Button>
                      }
                    />
                    <div className="divide-y divide-gray-100">
                      {/* Service list header */}
                      <div
                        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setServiceDetailsExpanded(!serviceDetailsExpanded)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={true}
                            onChange={() => {}}
                            onClick={(e) => e.stopPropagation()}
                            disabled={readOnly}
                          />
                          <ChevronRight
                            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                              serviceDetailsExpanded ? "rotate-90" : ""
                            }`}
                          />
                          <span className="text-sm text-gray-600">Dịch vụ chuyến đi</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-800">
                          {totalAmount.toLocaleString("vi-VN")} ₫
                        </span>
                      </div>

                      {/* Service details */}
                      {serviceDetailsExpanded && (
                        <div className="bg-gray-50/50">
                          {serviceCharges.length === 0 ? (
                            <div className="px-5 py-8 text-center">
                              <CreditCard className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                              <p className="text-gray-400 text-sm">Chưa có dịch vụ</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {serviceCharges.map((charge) => (
                                <div key={charge.id} className="flex items-center justify-between px-5 py-3">
                                  <span className="text-sm text-gray-600">
                                    {charge.serviceType?.name || "Dịch vụ"}
                                  </span>
                                  <span className="text-sm text-gray-700">
                                    {charge.totalAmount.toLocaleString("vi-VN")} ₫
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Total */}
                      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-50 to-cyan-50">
                        <span className="text-sm font-semibold text-gray-700">Tổng tiền</span>
                        <span className="text-lg font-bold text-blue-600">
                          {totalAmount.toLocaleString("vi-VN")} ₫
                        </span>
                      </div>
                    </div>
                  </GlassCard>
                </div>

                {/* ===== RIGHT COLUMN ===== */}
                <div className="space-y-6">
                  {/* Ảnh xe vào bến */}
                  <GlassCard>
                    <SectionHeader icon={Camera} title="Ảnh xe vào bến" />
                    <div className="p-5">
                      <div className="aspect-video rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
                        <Camera className="h-10 w-10 text-gray-300 mb-2" />
                        <p className="text-gray-400 text-sm">Chưa có ảnh</p>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Điều kiện cấp phép - Flight Check Style */}
                  <GlassCard>
                    <SectionHeader 
                      icon={Shield} 
                      title="Pre-Flight Check"
                      badge={(() => {
                        const { isValid, validCount, totalCount } = getOverallStatus();
                        return (
                          <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${
                            isValid
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
                              : 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/30'
                          }`}>
                            {validCount}/{totalCount} OK
                          </span>
                        );
                      })()}
                      action={
                        <Button
                          type="button"
                          onClick={() => setDocumentDialogOpen(true)}
                          className="h-8 w-8 p-0 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 border-0 transition-all"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    
                    {/* Document Cards Grid */}
                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-3">
                        {getDocumentsCheckResults().map((doc, index) => {
                          const statusStyles = {
                            valid: {
                              bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
                              border: 'border-emerald-200',
                              iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
                              text: 'text-emerald-700',
                              badge: 'bg-emerald-100 text-emerald-700',
                              glow: 'shadow-emerald-100'
                            },
                            expiring_soon: {
                              bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
                              border: 'border-amber-200',
                              iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
                              text: 'text-amber-700',
                              badge: 'bg-amber-100 text-amber-700',
                              glow: 'shadow-amber-100'
                            },
                            expired: {
                              bg: 'bg-gradient-to-br from-rose-50 to-red-50',
                              border: 'border-rose-200',
                              iconBg: 'bg-gradient-to-br from-rose-500 to-red-500',
                              text: 'text-rose-700',
                              badge: 'bg-rose-100 text-rose-700',
                              glow: 'shadow-rose-100'
                            },
                            missing: {
                              bg: 'bg-gradient-to-br from-slate-50 to-gray-100',
                              border: 'border-gray-200',
                              iconBg: 'bg-gradient-to-br from-slate-400 to-gray-500',
                              text: 'text-gray-500',
                              badge: 'bg-gray-100 text-gray-500',
                              glow: 'shadow-gray-100'
                            }
                          };
                          const style = statusStyles[doc.status];
                          
                          return (
                            <div
                              key={index}
                              className={`
                                relative p-4 rounded-xl border-2 transition-all duration-300
                                hover:scale-[1.02] hover:shadow-lg
                                ${style.bg} ${style.border} ${style.glow}
                              `}
                            >
                              {/* Status Icon */}
                              <div className={`
                                w-10 h-10 rounded-xl flex items-center justify-center mb-3
                                ${style.iconBg} shadow-lg
                              `}>
                                {doc.status === 'valid' && <CheckCircle className="h-5 w-5 text-white" />}
                                {doc.status === 'expiring_soon' && <Clock className="h-5 w-5 text-white" />}
                                {doc.status === 'expired' && <AlertCircle className="h-5 w-5 text-white" />}
                                {doc.status === 'missing' && <FileX className="h-5 w-5 text-white" />}
                              </div>
                              
                              {/* Document Name */}
                              <p className={`text-sm font-semibold ${style.text} mb-2 line-clamp-2`}>
                                {doc.name}
                              </p>
                              
                              {/* Status Badge */}
                              <div className={`
                                inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold
                                ${style.badge}
                              `}>
                                {doc.status === 'valid' && (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    {doc.daysRemaining && doc.daysRemaining < 999 
                                      ? `${doc.daysRemaining}d` 
                                      : 'OK'}
                                  </>
                                )}
                                {doc.status === 'expiring_soon' && (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    {doc.daysRemaining === 0 ? 'HÔM NAY!' : `${doc.daysRemaining}d`}
                                  </>
                                )}
                                {doc.status === 'expired' && (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    HẾT HẠN
                                  </>
                                )}
                                {doc.status === 'missing' && (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                    THIẾU
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Status Footer - Enhanced */}
                    <div className={`
                      relative overflow-hidden px-5 py-4 border-t
                      ${checkAllDocumentsValid()
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400'
                        : 'bg-gradient-to-r from-rose-500 to-red-500 border-rose-400'
                      }
                    `}>
                      {/* Background pattern */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0" style={{
                          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                          backgroundSize: '16px 16px'
                        }} />
                      </div>
                      
                      <div className="relative flex items-center justify-between">
                        {checkAllDocumentsValid() ? (
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/20 backdrop-blur">
                              <CheckCircle className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="text-white font-bold">CLEARED FOR PERMIT</p>
                              <p className="text-white/80 text-xs">Đủ điều kiện cấp phép</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/20 backdrop-blur">
                              <XIcon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="text-white font-bold">DOCUMENTS REQUIRED</p>
                              <p className="text-white/80 text-xs">Cần bổ sung giấy tờ</p>
                            </div>
                          </div>
                        )}
                        <ChevronRight className="h-5 w-5 text-white/60" />
                      </div>
                    </div>
                  </GlassCard>

                  {/* Kiểm tra GSHT */}
                  <GlassCard>
                    <SectionHeader icon={Globe} title="Kiểm tra GSHT" />
                    <div className="p-5 space-y-3">
                      {[
                        { icon: Home, label: "(Chưa đăng nhập)" },
                        { icon: Globe, label: "(Chưa đăng nhập)" },
                        { icon: AlertTriangle, label: "(Chưa đăng nhập)" },
                        { icon: MapPin, label: "(Chưa đăng nhập)" },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm text-gray-500">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>

                  {/* Ghi chú */}
                  <GlassCard>
                    <SectionHeader icon={MessageSquare} title="Ghi chú" />
                    <div className="p-5">
                      <textarea
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none transition-all"
                        placeholder="Nhập ghi chú..."
                      />
                    </div>
                  </GlassCard>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dialogs */}
        {record.vehicleId && (
          <KiemTraGiayToDialog
            vehicleId={record.vehicleId}
            open={documentDialogOpen}
            onClose={() => setDocumentDialogOpen(false)}
            onSuccess={handleDocumentDialogSuccess}
          />
        )}

        <LyDoKhongDuDieuKienDialog
          open={notEligibleDialogOpen}
          onClose={() => setNotEligibleDialogOpen(false)}
          onConfirm={handleNotEligibleConfirm}
        />

        {record.id && (
          <ThemDichVuDialog
            dispatchRecordId={record.id}
            open={addServiceDialogOpen}
            onClose={() => setAddServiceDialogOpen(false)}
            onSuccess={handleAddServiceSuccess}
          />
        )}

        <ThemTaiXeDialog
          operatorId={selectedOperatorId || undefined}
          open={addDriverDialogOpen}
          onClose={() => setAddDriverDialogOpen(false)}
          onSuccess={handleAddDriverSuccess}
        />

        {/* Zero Amount Confirmation */}
        {showZeroAmountConfirm && (
          <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-amber-100">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Xác nhận</h3>
              </div>
              <p className="text-gray-600 mb-6">
                <span className="text-gray-800 font-medium">Tổng đơn hàng 0 đồng.</span>
                <br />Bạn có muốn tiếp tục?
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => setShowZeroAmountConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 transition-all"
                >
                  Hủy
                </Button>
                <Button
                  onClick={() => {
                    setShowZeroAmountConfirm(false);
                    submitPermit();
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-all flex items-center gap-2"
                >
                  Tiếp tục
                  <ArrowRight className="h-4 w-4" />
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
