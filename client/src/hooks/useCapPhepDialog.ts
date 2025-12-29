import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { scheduleService } from "@/services/schedule.service";
import { dispatchService } from "@/services/dispatch.service";
import { vehicleService } from "@/services/vehicle.service";
import { type VehicleBadge } from "@/services/vehicle-badge.service";
import { serviceChargeService } from "@/services/service-charge.service";
import { quanlyDataService, type QuanLyVehicle, type QuanLyRoute, type QuanLyOperator, type QuanLyBadge } from "@/services/quanly-data.service";
import { useUIStore } from "@/store/ui.store";
import type { Shift } from "@/services/shift.service";
import type { DispatchRecord, Route, Schedule, Vehicle, Driver, ServiceCharge, Operator } from "@/types";

type DocumentStatus = 'valid' | 'expired' | 'expiring_soon' | 'missing';

interface DocumentCheckResult {
  name: string;
  status: DocumentStatus;
  expiryDate?: string;
  daysRemaining?: number;
}

export function useCapPhepDialog(record: DispatchRecord, onClose: () => void, onSuccess?: () => void) {
  const [permitType, setPermitType] = useState("fixed");
  const [transportOrderCode, setTransportOrderCode] = useState(record.transportOrderCode || "");
  const [replacementVehicleId, setReplacementVehicleId] = useState("");
  const [seatCount, setSeatCount] = useState(() => record.seatCount?.toString() || "");
  const [bedCount, setBedCount] = useState("0");
  const [hhTicketCount, setHhTicketCount] = useState("0");
  const [hhPercentage, setHhPercentage] = useState("0");
  const [entryPlateNumber, setEntryPlateNumberInternal] = useState(record.vehiclePlateNumber || "");
  const [registeredPlateNumber, setRegisteredPlateNumberInternal] = useState(record.vehiclePlateNumber || "");
  // Flags to track when user explicitly clears the plate fields (prevents auto-reset)
  const [hasUserClearedRegisteredPlate, setHasUserClearedRegisteredPlate] = useState(false);
  const [hasUserClearedEntryPlate, setHasUserClearedEntryPlate] = useState(false);
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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [serviceDetailsExpanded, setServiceDetailsExpanded] = useState(true);
  const [showZeroAmountConfirm, setShowZeroAmountConfirm] = useState(false);
  const [dailyTripCounts, setDailyTripCounts] = useState<Record<number, number>>({});
  const [tripCountsLoaded, setTripCountsLoaded] = useState(false);
  const [schedulesCache, setSchedulesCache] = useState<Record<string, Schedule[]>>({});
  const [cachedDispatchRecords, setCachedDispatchRecords] = useState<DispatchRecord[] | null>(null);

  const { currentShift } = useUIStore();

  // Wrapper setters that track when user explicitly clears the field
  const setRegisteredPlateNumber = useCallback((value: string) => {
    if (value === '') {
      setHasUserClearedRegisteredPlate(true);
    } else {
      setHasUserClearedRegisteredPlate(false);
    }
    setRegisteredPlateNumberInternal(value);
  }, []);

  const setEntryPlateNumber = useCallback((value: string) => {
    if (value === '') {
      setHasUserClearedEntryPlate(true);
    } else {
      setHasUserClearedEntryPlate(false);
    }
    setEntryPlateNumberInternal(value);
  }, []);

  const loadSchedules = useCallback(async (rid: string) => {
    try {
      if (schedulesCache[rid]) {
        setSchedules(schedulesCache[rid]);
        return;
      }
      const data = await scheduleService.getAll(rid, undefined, true);
      setSchedules(data);
      setSchedulesCache(prev => ({ ...prev, [rid]: data }));
    } catch (error) {
      console.error("Failed to load schedules:", error);
    }
  }, [schedulesCache]);

  const calculateTotal = useCallback(() => {
    const total = serviceCharges.reduce((sum, charge) => sum + charge.totalAmount, 0);
    setTotalAmount(total);
  }, [serviceCharges]);

  const getShiftIdFromCurrentShift = useCallback((): string | undefined => {
    if (!currentShift || currentShift === '<Trống>') return undefined;
    const currentShifts = useUIStore.getState().shifts;
    if (currentShifts.length === 0) return undefined;
    const match = currentShift.match(/^(.+?)\s*\(/);
    if (!match) return undefined;
    const shiftName = match[1].trim();
    const foundShift = currentShifts.find((shift: Shift) => shift.name === shiftName);
    return foundShift?.id;
  }, [currentShift]);

  const loadDailyTripCounts = useCallback(async () => {
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
          if (!vehiclesByDay[day]) vehiclesByDay[day] = new Set();
          if (dispatchRecord.vehicleId) vehiclesByDay[day].add(dispatchRecord.vehicleId);
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
  }, [departureDate, cachedDispatchRecords]);

  const loadInitialData = useCallback(async () => {
    try {
      // Use unified endpoint - 1 request instead of 4, with frontend caching
      const [quanlyData, schedulesData, chargesData] = await Promise.all([
        quanlyDataService.getAll(), // Gets routes, operators, vehicles, badges in 1 call
        record.routeId ? scheduleService.getAll(record.routeId, undefined, true) : Promise.resolve([]),
        record.id ? serviceChargeService.getAll(record.id) : Promise.resolve([]),
      ]);

      // Map routes from quanly-data format to dropdown format
      const routesForDropdown = (quanlyData.routes || []).map((r: QuanLyRoute) => ({
        id: r.id,
        routeName: r.name || `${r.startPoint} - ${r.endPoint}`,
        routeCode: r.code,
        routeType: '',
        distanceKm: r.distance ? parseFloat(r.distance) : undefined,
        destinationId: null,
        destination: { id: null, name: r.endPoint, code: '' },
      }));

      // Map vehicles from quanly-data format
      const vehiclesData = (quanlyData.vehicles || []).map((v: QuanLyVehicle) => ({
        id: v.id,
        plateNumber: v.plateNumber,
        seatCapacity: v.seatCapacity,
        operatorName: v.operatorName,
        vehicleType: v.vehicleType,
        isActive: v.isActive,
        source: v.source,
        operatorId: null,
        operator: { id: null, name: v.operatorName, code: '' },
      })) as unknown as Vehicle[];

      // Map operators from quanly-data format
      const operatorsData = (quanlyData.operators || []).map((o: QuanLyOperator) => ({
        id: o.id,
        name: o.name,
        province: o.province,
        phone: o.phone,
        email: o.email,
        address: o.address,
        representativeName: o.representativeName,
        isActive: o.isActive,
      })) as Operator[];

      // Map badges from quanly-data format
      const badgesData = (quanlyData.badges || []).map((b: QuanLyBadge) => ({
        id: b.id,
        badge_number: b.badge_number,
        license_plate_sheet: b.license_plate_sheet,
        badge_type: b.badge_type,
        badge_color: b.badge_color,
        issue_date: b.issue_date,
        expiry_date: b.expiry_date,
        status: b.status,
        vehicle_id: b.id,
      })) as VehicleBadge[];

      setRoutes(routesForDropdown as unknown as Route[]);
      setOperators(operatorsData);
      setVehicles(vehiclesData);
      setVehicleBadges(badgesData);

      if (record.routeId) {
        setRouteId(record.routeId);
        setSchedules(schedulesData);
        if (record.scheduleId) setScheduleId(record.scheduleId);
      }

      if (record.id && chargesData) setServiceCharges(chargesData);

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
          if (!registeredPlateNumber && vehicle.plateNumber) setRegisteredPlateNumberInternal(vehicle.plateNumber);
          if (!entryPlateNumber && vehicle.plateNumber) setEntryPlateNumberInternal(vehicle.plateNumber);
          if (vehicle.operatorId) {
            setSelectedOperatorId(vehicle.operatorId);
            if (record.driver) setDrivers([record.driver]);
          } else {
            // For legacy vehicles, try to match operator by name
            const opName = vehicle.operatorName || vehicle.operator?.name;
            if (opName && operatorsData.length > 0) {
              const normalizedOpName = opName.trim().toLowerCase();
              const matchedOp = operatorsData.find((op: Operator) => 
                op.name?.trim().toLowerCase() === normalizedOpName ||
                op.id?.includes(normalizedOpName.substring(0, 10))
              );
              if (matchedOp) {
                setSelectedOperatorId(matchedOp.id);
              }
            }
          }
          if (vehicle.operatorName) setOperatorNameFromVehicle(vehicle.operatorName);
          else if (vehicle.operator?.name) setOperatorNameFromVehicle(vehicle.operator.name);
        }
      }

      if (!vehicleFound && record.vehicleId) {
        try {
          const matchingBadge = badgesData.find((b: VehicleBadge) => b.vehicle_id === record.vehicleId);
          if (matchingBadge?.license_plate_sheet) {
            if (!registeredPlateNumber) setRegisteredPlateNumberInternal(matchingBadge.license_plate_sheet);
            if (!entryPlateNumber) setEntryPlateNumberInternal(matchingBadge.license_plate_sheet);
          }
        } catch (badgeError) {
          console.warn("Could not load vehicle badges:", badgeError);
        }
      }

      // Fallback: Try to get seatCapacity from RTDB lookup if not found from Supabase
      const plateToCheck = record.vehiclePlateNumber;
      const foundVehicleSeatCapacity = vehiclesData.find((v: Vehicle) => v.id === record.vehicleId)?.seatCapacity;
      const needSeatCapacity = !vehicleFound || !foundVehicleSeatCapacity;
      
      if (plateToCheck && needSeatCapacity && (!record.seatCount || record.seatCount === 0)) {
        try {
          // Use direct RTDB lookup - works for ALL vehicles, not just those with badges
          const lookupResult = await vehicleService.lookupByPlate(plateToCheck);
          if (lookupResult?.seatCapacity && lookupResult.seatCapacity > 0) {
            setSeatCount(lookupResult.seatCapacity.toString());
          }
        } catch (lookupError) {
          console.warn("Could not lookup vehicle seat capacity:", lookupError);
        }
      }

      if (record.seatCount && record.seatCount > 0) setSeatCount(record.seatCount.toString());
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  // Note: Removed registeredPlateNumber and entryPlateNumber from deps
  // to prevent re-running when user clears these fields
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  const normalizePlate = (plate: string): string => plate.replace(/[.\-\s]/g, '').toUpperCase();

  const getMatchingBadge = useCallback((): VehicleBadge | undefined => {
    const plateNumber = registeredPlateNumber || entryPlateNumber || selectedVehicle?.plateNumber;
    if (!plateNumber || !vehicleBadges.length) return undefined;
    const normalizedPlate = normalizePlate(plateNumber);
    return vehicleBadges.find(badge =>
      badge.license_plate_sheet && normalizePlate(badge.license_plate_sheet) === normalizedPlate
    );
  }, [registeredPlateNumber, entryPlateNumber, selectedVehicle, vehicleBadges]);

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

  const getDocumentsCheckResults = useCallback((): DocumentCheckResult[] => {
    const matchingBadge = getMatchingBadge();
    const results: DocumentCheckResult[] = [];

    if (matchingBadge) {
      const { status, daysRemaining } = getDocumentStatus(matchingBadge.expiry_date);
      results.push({ name: 'Phù hiệu xe', status, expiryDate: matchingBadge.expiry_date, daysRemaining });
    } else {
      results.push({ name: 'Phù hiệu xe', status: 'valid', expiryDate: undefined, daysRemaining: 999 });
    }

    results.push({ name: 'Đăng ký xe', status: 'valid', expiryDate: undefined, daysRemaining: 999 });
    results.push({ name: 'Đăng kiểm xe', status: 'valid', expiryDate: undefined, daysRemaining: 999 });
    results.push({ name: 'Bảo hiểm xe', status: 'valid', expiryDate: undefined, daysRemaining: 999 });

    return results;
  }, [getMatchingBadge]);

  const checkAllDocumentsValid = useCallback((): boolean => {
    const results = getDocumentsCheckResults();
    return results.every(r => r.status === 'valid' || r.status === 'expiring_soon');
  }, [getDocumentsCheckResults]);

  const getOverallStatus = useCallback((): { isValid: boolean; validCount: number; totalCount: number } => {
    const results = getDocumentsCheckResults();
    const validCount = results.filter(r => r.status === 'valid' || r.status === 'expiring_soon').length;
    return { isValid: validCount === results.length, validCount, totalCount: results.length };
  }, [getDocumentsCheckResults]);

  const submitPermit = useCallback(async () => {
    setIsLoading(true);
    try {
      const plannedDepartureTime = departureTime
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
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      console.error("Failed to issue permit:", error);
      const axiosError = error as { response?: { data?: { code?: string; error?: string } } };
      const errorData = axiosError.response?.data;
      if (errorData?.code === '23505' || errorData?.error?.includes('đã tồn tại') || errorData?.error?.includes('duplicate key')) {
        toast.error(`Mã lệnh vận chuyển "${transportOrderCode}" đã tồn tại. Vui lòng chọn mã khác.`);
      } else {
        toast.error(errorData?.error || "Không thể cấp phép. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [departureTime, departureDate, record, transportOrderCode, seatCount, routeId, scheduleId, replacementVehicleId, getShiftIdFromCurrentShift, onSuccess, onClose]);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const validatePermitFields = useCallback((): { isValid: boolean; errors: string[]; fieldErrors: Record<string, string> } => {
    const errors: string[] = [];
    const fieldErrors: Record<string, string> = {};
    
    if (!transportOrderCode?.trim()) {
      errors.push("Mã lệnh vận chuyển");
      fieldErrors.transportOrderCode = "Vui lòng nhập mã lệnh vận chuyển";
    }
    if (!routeId) {
      errors.push("Tuyến đường");
      fieldErrors.routeId = "Vui lòng chọn tuyến đường";
    }
    if (!departureDate) {
      errors.push("Ngày xuất bến");
      fieldErrors.departureDate = "Vui lòng chọn ngày xuất bến";
    }
    if (!scheduleId && !departureTime) {
      errors.push("Biểu đồ giờ hoặc Giờ xuất bến");
      fieldErrors.departureTime = "Vui lòng chọn biểu đồ giờ hoặc nhập giờ xuất bến";
    }
    if (!seatCount || parseInt(seatCount) <= 0) {
      errors.push("Số ghế (phải lớn hơn 0)");
      fieldErrors.seatCount = "Số ghế phải lớn hơn 0";
    }
    
    return { isValid: errors.length === 0, errors, fieldErrors };
  }, [transportOrderCode, routeId, departureDate, scheduleId, departureTime, seatCount]);

  const handleEligible = useCallback(async () => {
    setHasAttemptedSubmit(true);
    const { isValid, errors, fieldErrors } = validatePermitFields();
    setValidationErrors(fieldErrors);
    
    if (!isValid) {
      const errorMessage = errors.length === 1
        ? `Vui lòng điền: ${errors[0]}`
        : `Vui lòng điền các trường sau:\n• ${errors.join("\n• ")}`;
      toast.error(errorMessage, {
        autoClose: 5000,
        style: { whiteSpace: 'pre-line' }
      });
      return;
    }
    
    if (totalAmount === 0) {
      setShowZeroAmountConfirm(true);
      return;
    }
    await submitPermit();
  }, [validatePermitFields, totalAmount, submitPermit]);

  // Clear validation error when field value changes
  useEffect(() => {
    if (hasAttemptedSubmit) {
      const { fieldErrors } = validatePermitFields();
      setValidationErrors(fieldErrors);
    }
  }, [transportOrderCode, routeId, departureDate, scheduleId, departureTime, seatCount, hasAttemptedSubmit, validatePermitFields]);

  const handleNotEligibleConfirm = useCallback(async (
    selectedReasons: string[],
    _options: { createOrder: boolean; signAndTransmit: boolean; printDisplay: boolean }
  ) => {
    setIsLoading(true);
    try {
      const reasonDescriptions: Record<string, string> = {
        driver_license_insufficient: "Không có hoặc có nhưng không đủ số lượng giấy phép lái xe so với số lái xe ghi trên lệnh vận chuyển",
        driver_license_expired: "Giấy phép lái xe đã hết hạn hoặc sử dụng giấy phép lái xe giả",
        driver_license_class_mismatch: "Hạng giấy phép lái xe không phù hợp với các loại xe được phép điều khiển",
        driver_info_mismatch: "Thông tin của lái xe không đúng với thông tin được ghi trên lệnh vận chuyển",
        driver_alcohol: "Lái xe sử dụng rượu bia",
        driver_drugs: "Lái xe sử dụng chất ma tuý",
      };

      const rejectionReason = selectedReasons.map((id) => reasonDescriptions[id] || id).join("; ");
      const plannedDepartureTime = departureTime && departureDate
        ? new Date(`${departureDate}T${departureTime}`).toISOString()
        : record.plannedDepartureTime || new Date().toISOString();

      const permitShiftId = getShiftIdFromCurrentShift();

      await dispatchService.issuePermit(record.id, {
        transportOrderCode: transportOrderCode || undefined,
        plannedDepartureTime,
        seatCount: parseInt(seatCount) || 0,
        permitStatus: "rejected",
        rejectionReason,
        routeId: routeId || undefined,
        scheduleId: scheduleId || undefined,
        replacementVehicleId: replacementVehicleId || undefined,
        permitShiftId,
      });

      toast.success("Cấp phép thành công!");
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      console.error("Failed to issue permit:", error);
      const axiosError = error as { response?: { data?: { code?: string; error?: string } } };
      const errorData = axiosError.response?.data;
      if (errorData?.code === '23505' || errorData?.error?.includes('đã tồn tại') || errorData?.error?.includes('duplicate key')) {
        toast.error(`Mã lệnh vận chuyển "${transportOrderCode}" đã tồn tại. Vui lòng chọn mã khác.`);
      } else {
        toast.error(errorData?.error || "Không thể cấp phép. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [departureTime, departureDate, record, transportOrderCode, seatCount, routeId, scheduleId, replacementVehicleId, getShiftIdFromCurrentShift, onSuccess, onClose]);

  const handleDocumentDialogSuccess = useCallback(() => {
    if (record.vehicleId) loadInitialData();
  }, [record.vehicleId, loadInitialData]);

  const handleAddServiceSuccess = useCallback(() => {
    if (record.id) {
      serviceChargeService.getAll(record.id).then(setServiceCharges);
      loadDailyTripCounts();
    }
  }, [record.id, loadDailyTripCounts]);

  const handleAddDriverSuccess = useCallback((driver: Driver) => {
    if (!drivers.find((d) => d.id === driver.id)) {
      setDrivers([...drivers, driver]);
    }
  }, [drivers]);

  // Effects
  useEffect(() => {
    const init = async () => {
      setIsInitialLoading(true);
      await loadInitialData();
      setIsInitialLoading(false);
    };
    init();
    const { shifts: currentShifts, loadShifts } = useUIStore.getState();
    if (currentShifts.length === 0) loadShifts();
  }, [loadInitialData]);

  useEffect(() => {
    if (routeId) loadSchedules(routeId);
  }, [routeId, loadSchedules]);

  useEffect(() => {
    calculateTotal();
  }, [calculateTotal]);

  useEffect(() => {
    if (departureDate && !tripCountsLoaded) {
      loadDailyTripCounts();
      setTripCountsLoaded(true);
    }
  }, [departureDate, tripCountsLoaded, loadDailyTripCounts]);

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
      // Only auto-fill plate numbers if not explicitly cleared by user
      if (!registeredPlateNumber && !hasUserClearedRegisteredPlate && selectedVehicle.plateNumber) {
        setRegisteredPlateNumberInternal(selectedVehicle.plateNumber);
      }
      if (!entryPlateNumber && !hasUserClearedEntryPlate && selectedVehicle.plateNumber) {
        setEntryPlateNumberInternal(selectedVehicle.plateNumber);
      }
    }
  }, [selectedVehicle, record.seatCount, entryPlateNumber, registeredPlateNumber, hasUserClearedRegisteredPlate, hasUserClearedEntryPlate]);

  useEffect(() => {
    const plateNumber = registeredPlateNumber || entryPlateNumber;
    if (!plateNumber || vehicles.length === 0) return;
    const normalizedPlate = plateNumber.replace(/[.\-\s]/g, '').toUpperCase();
    const matchedVehicle = vehicles.find(v => v.plateNumber && v.plateNumber.replace(/[.\-\s]/g, '').toUpperCase() === normalizedPlate);
    if (matchedVehicle && matchedVehicle.id !== selectedVehicle?.id) {
      setSelectedVehicle(matchedVehicle);
      if (matchedVehicle.operatorId && !selectedOperatorId) setSelectedOperatorId(matchedVehicle.operatorId);
      if (matchedVehicle.operatorName) setOperatorNameFromVehicle(matchedVehicle.operatorName);
      else if (matchedVehicle.operator?.name) setOperatorNameFromVehicle(matchedVehicle.operator.name);
    }
  }, [registeredPlateNumber, entryPlateNumber, vehicles, selectedVehicle, selectedOperatorId]);

  // Compute busy vehicle plates from active dispatch records
  const busyVehiclePlates = useMemo(() => {
    if (!cachedDispatchRecords) return new Set<string>();
    const normalizeplate = (p: string) => p.replace(/[.\-\s]/g, '').toUpperCase();
    const busy = new Set<string>();
    for (const dr of cachedDispatchRecords) {
      // Xe đang bận = chưa xuất bến (departed) và chưa bị hủy (cancelled)
      if (dr.currentStatus !== 'departed' && dr.currentStatus !== 'cancelled' && dr.vehiclePlateNumber) {
        busy.add(normalizeplate(dr.vehiclePlateNumber));
      }
    }
    return busy;
  }, [cachedDispatchRecords]);

  // Vehicles with availability status for replacement vehicle dropdown
  const vehiclesWithStatus = useMemo(() => {
    const normalizeplate = (p: string) => p.replace(/[.\-\s]/g, '').toUpperCase();
    return vehicles.map(v => ({
      ...v,
      isBusy: v.plateNumber ? busyVehiclePlates.has(normalizeplate(v.plateNumber)) : false
    }));
  }, [vehicles, busyVehiclePlates]);

  return {
    // State
    permitType, setPermitType,
    transportOrderCode, setTransportOrderCode,
    replacementVehicleId, setReplacementVehicleId,
    seatCount, setSeatCount,
    bedCount, setBedCount,
    hhTicketCount, setHhTicketCount,
    hhPercentage, setHhPercentage,
    entryPlateNumber, setEntryPlateNumber,
    registeredPlateNumber, setRegisteredPlateNumber,
    routeId, setRouteId,
    scheduleId, setScheduleId,
    departureTime, setDepartureTime,
    departureDate, setDepartureDate,
    routes, schedules, vehicleBadges, vehicles, vehiclesWithStatus, drivers, serviceCharges,
    selectedVehicle, operators, selectedOperatorId, setSelectedOperatorId,
    operatorNameFromVehicle, totalAmount, isLoading, isInitialLoading,
    serviceDetailsExpanded, setServiceDetailsExpanded,
    showZeroAmountConfirm, setShowZeroAmountConfirm,
    dailyTripCounts,
    validationErrors,
    // Methods
    submitPermit, handleEligible, handleNotEligibleConfirm,
    handleDocumentDialogSuccess, handleAddServiceSuccess, handleAddDriverSuccess,
    getDocumentsCheckResults, checkAllDocumentsValid, getOverallStatus,
  };
}
