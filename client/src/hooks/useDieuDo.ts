import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { useDispatchStore } from "@/store/dispatch.store";
import { dispatchService } from "@/services/dispatch.service";
import { vehicleService } from "@/services/vehicle.service";
import { useUIStore } from "@/store/ui.store";
import type { DispatchRecord, DispatchStatus, Vehicle } from "@/types";
import type { DisplayStatus } from "@/components/dispatch/common";

export type DialogType =
  | "entry"
  | "edit"
  | "return"
  | "permit"
  | "payment"
  | "depart"
  | "departure-order"
  | "monthly-payment"
  | "depart-multiple";

export function useDieuDo() {
  const { records, setRecords } = useDispatchStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<DispatchRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<DialogType>("entry");
  const [isReadOnly, setIsReadOnly] = useState(false);
  const setTitle = useUIStore((state) => state.setTitle);

  useEffect(() => {
    setTitle("Điều độ xe");
    loadVehicles();
    loadRecords();
    const interval = setInterval(loadRecords, 30000);
    return () => clearInterval(interval);
  }, [setTitle]);

  const loadVehicles = async () => {
    try {
      const data = await vehicleService.getAll();
      setVehicles(data);
    } catch (error) {
      console.error("Failed to load vehicles:", error);
    }
  };

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const data = await dispatchService.getAll();
      setRecords(data);
    } catch (error) {
      console.error("Failed to load records:", error);
      toast.error("Không thể tải danh sách điều độ");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (record: DispatchRecord) => {
    if (!window.confirm(`Xóa xe ${record.vehiclePlateNumber} khỏi danh sách?`)) return;
    try {
      await dispatchService.delete(record.id);
      toast.success("Đã xóa xe khỏi danh sách");
      loadRecords();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Không thể xóa");
    }
  };

  const handleEdit = (record: DispatchRecord) => {
    setSelectedRecord(record);
    setDialogType("edit");
    setIsReadOnly(false);
    setDialogOpen(true);
  };

  const handleAction = (record: DispatchRecord, type: DialogType) => {
    setSelectedRecord(record);
    setDialogType(type);
    setDialogOpen(true);
    setIsReadOnly(false);
  };

  const handleOpenPermitReadOnly = (record: DispatchRecord) => {
    setSelectedRecord(record);
    setDialogType("permit");
    setIsReadOnly(true);
    setDialogOpen(true);
  };

  const handleRecordExit = async (record: DispatchRecord) => {
    if (window.confirm("Cho xe ra bến?")) {
      try {
        await dispatchService.recordExit(record.id);
        toast.success("Cho xe ra bến thành công!");
        loadRecords();
      } catch {
        toast.error("Không thể cho xe ra bến");
      }
    }
  };

  const getDisplayStatus = useCallback((currentStatus: DispatchStatus): DisplayStatus => {
    const statusMap: Record<DispatchStatus, DisplayStatus> = {
      entered: "in-station",
      passengers_dropped: "in-station",
      permit_issued: "permit-issued",
      permit_rejected: "in-station",
      paid: "paid",
      departure_ordered: "departed",
      departed: "departed",
    };
    return statusMap[currentStatus] || "in-station";
  }, []);

  const getRecordsByStatus = useCallback((status: DisplayStatus) => {
    return records
      .filter((record) => {
        if (record.currentStatus === "departed") return false;
        const displayStatus = getDisplayStatus(record.currentStatus);
        if (status === "in-station") return displayStatus === "in-station";
        if (status === "permit-issued") return displayStatus === "permit-issued";
        if (status === "paid") return displayStatus === "paid";
        if (status === "departed") return record.currentStatus === "departure_ordered";
        return false;
      })
      .filter((record) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          record.vehiclePlateNumber.toLowerCase().includes(query) ||
          (record.routeName || "").toLowerCase().includes(query) ||
          record.driverName.toLowerCase().includes(query)
        );
      });
  }, [records, searchQuery, getDisplayStatus]);

  const stats = useMemo(() => ({
    "in-station": getRecordsByStatus("in-station").length,
    "permit-issued": getRecordsByStatus("permit-issued").length,
    paid: getRecordsByStatus("paid").length,
    departed: getRecordsByStatus("departed").length,
  }), [getRecordsByStatus]);

  const totalActive = stats["in-station"] + stats["permit-issued"] + stats.paid + stats.departed;

  const activeVehicleIds = useMemo(() => {
    const ids = new Set<string>();
    const seen = new Set<string>();
    for (const record of records) {
      if (!seen.has(record.vehicleId)) {
        seen.add(record.vehicleId);
        if (record.currentStatus !== "departed" && record.currentStatus !== "departure_ordered") {
          ids.add(record.vehicleId);
        }
      }
    }
    return ids;
  }, [records]);

  const vehicleOptions = vehicles
    .filter((v) => {
      const isEditingThisVehicle = dialogType === "edit" && selectedRecord?.vehicleId === v.id;
      return !activeVehicleIds.has(v.id) || isEditingThisVehicle;
    })
    .map((v) => ({ id: v.id, plateNumber: v.plateNumber }));

  const isMonthlyPaymentVehicle = useCallback((record: DispatchRecord): boolean => {
    if (record.metadata?.paymentType === "monthly") return true;
    const displayStatus = getDisplayStatus(record.currentStatus);
    if (record.transportOrderCode && displayStatus === "in-station") return true;
    return false;
  }, [getDisplayStatus]);

  const getVehicleStatus = useCallback((record: DispatchRecord, status: DisplayStatus): 'eligible' | 'ineligible' | 'returned' | 'irregular' | null => {
    if (record.metadata?.type === "irregular") return 'irregular';
    if (record.currentStatus === "passengers_dropped") return 'returned';
    if (record.permitStatus === "rejected" || (status === "paid" && !record.permitStatus)) return 'ineligible';
    if (record.permitStatus === "approved") return 'eligible';
    return null;
  }, []);

  return {
    records,
    searchQuery,
    setSearchQuery,
    isLoading,
    vehicles,
    selectedRecord,
    setSelectedRecord,
    dialogOpen,
    setDialogOpen,
    dialogType,
    setDialogType,
    isReadOnly,
    setIsReadOnly,
    vehicleOptions,
    stats,
    totalActive,
    loadRecords,
    handleDelete,
    handleEdit,
    handleAction,
    handleOpenPermitReadOnly,
    handleRecordExit,
    getDisplayStatus,
    getRecordsByStatus,
    isMonthlyPaymentVehicle,
    getVehicleStatus,
  };
}
