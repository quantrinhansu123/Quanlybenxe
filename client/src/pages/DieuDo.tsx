import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Search,
  FileCheck,
  Plus,
  Bus,
  Clock,
  MapPin,
  FileText,
  Calendar,
  User,
  RefreshCw,
  ShieldCheck,
  XCircle,
  Banknote,
  ArrowRightLeft,
  CarFront,
  ArrowRight,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

import { useDispatchStore } from "@/store/dispatch.store";
import { dispatchService } from "@/services/dispatch.service";
import { vehicleService } from "@/services/vehicle.service";
import { ChoXeVaoBenDialog } from "@/components/dispatch/ChoXeVaoBenDialog";
import { XeTraKhachDialog } from "@/components/dispatch/XeTraKhachDialog";
import { CapPhepDialog } from "@/components/dispatch/CapPhepDialog";
import { ThanhToanTheoThangDialog } from "@/components/dispatch/ThanhToanTheoThangDialog";
import { ChoXeRaBenDialog } from "@/components/dispatch/ChoXeRaBenDialog";
import { CapLenhXuatBenDialog } from "@/components/dispatch/CapLenhXuatBenDialog";
import { ChoNhieuXeRaBenDialog } from "@/components/dispatch/ChoNhieuXeRaBenDialog";
import type { DispatchRecord, DispatchStatus, Vehicle } from "@/types";
import { formatVietnamDateTime } from "@/lib/vietnam-time";
import { useUIStore } from "@/store/ui.store";
import { iconStyles } from "@/lib/icon-theme";

// Display status type for UI tabs (different from backend status)
type DisplayStatus = "in-station" | "permit-issued" | "paid" | "departed";

export default function DieuDo() {
  const navigate = useNavigate();
  const { records, setRecords } = useDispatchStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<DispatchRecord | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<
    | "entry"
    | "return"
    | "permit"
    | "payment"
    | "depart"
    | "departure-order"
    | "monthly-payment"
    | "depart-multiple"
  >("entry");
  const [isReadOnly, setIsReadOnly] = useState(false);
  const setTitle = useUIStore((state) => state.setTitle);

  useEffect(() => {
    setTitle("Điều độ xe");
    loadVehicles();
    loadRecords();
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
      toast.error("Không thể tải danh sách điều độ. Vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to map backend status to frontend display status
  const getDisplayStatus = (currentStatus: DispatchStatus): DisplayStatus => {
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
  };

  // Get records for each column
  const getRecordsByStatus = (status: DisplayStatus) => {
    return records
      .filter((record) => {
        // Don't show vehicles that have actually departed
        if (record.currentStatus === "departed") {
          return false;
        }
        
        const displayStatus = getDisplayStatus(record.currentStatus);
        if (status === "in-station") {
          return displayStatus === "in-station";
        }
        if (status === "permit-issued") {
          return displayStatus === "permit-issued";
        }
        if (status === "paid") {
          return displayStatus === "paid";
        }
        if (status === "departed") {
          // Only show vehicles with "departure_ordered" status
          return record.currentStatus === "departure_ordered";
        }
        return false;
      })
      .filter((record) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            record.vehiclePlateNumber.toLowerCase().includes(query) ||
            (record.routeName || "").toLowerCase().includes(query) ||
            record.driverName.toLowerCase().includes(query)
          );
        }
        return true;
      });
  };

  // Calculate statistics from actual records
  const stats = {
    "in-station": getRecordsByStatus("in-station").length,
    "permit-issued": getRecordsByStatus("permit-issued").length,
    paid: getRecordsByStatus("paid").length,
    departed: getRecordsByStatus("departed").length,
  };

  // Calculate active vehicles (those currently in station/process)
  const activeVehicleIds = new Set<string>();
  const seenVehicleIds = new Set<string>();

  for (const record of records) {
    if (!seenVehicleIds.has(record.vehicleId)) {
      seenVehicleIds.add(record.vehicleId);
      // This is the latest record for this vehicle
      // Exclude vehicles that have departed (status = "departed")
      if (record.currentStatus !== "departed" && record.currentStatus !== "departure_ordered") {
        activeVehicleIds.add(record.vehicleId);
      }
    }
  }

  // Transform vehicles for select options
  const vehicleOptions = vehicles
    .filter((v) => !activeVehicleIds.has(v.id))
    .map((v) => ({
      id: v.id,
      plateNumber: v.plateNumber,
    }));

  const handleAction = (record: DispatchRecord, type: typeof dialogType) => {
    setSelectedRecord(record);
    setDialogType(type);
    setDialogOpen(true);
    setIsReadOnly(false);
  };

  // Helper function to check if vehicle has monthly payment
  const isMonthlyPaymentVehicle = (record: DispatchRecord): boolean => {
    // Check metadata for monthly payment flag
    if (record.metadata?.paymentType === "monthly") {
      return true;
    }
    // Alternative: check if vehicle has transport order code but is still in station
    // This indicates it might be a monthly payment vehicle that needs payment processing
    const displayStatus = getDisplayStatus(record.currentStatus);
    if (record.transportOrderCode && displayStatus === "in-station") {
      return true;
    }
    return false;
  };

  const getActionButtons = (record: DispatchRecord, status: DisplayStatus) => {
    const buttons = [];

    if (status === "in-station") {
      // Check if this is a monthly payment vehicle
      if (isMonthlyPaymentVehicle(record)) {
        buttons.push(
          <button
            key="monthly-payment"
            onClick={(e) => {
              e.stopPropagation();
              handleAction(record, "monthly-payment");
            }}
            className="p-1.5 lg:p-2 hover:bg-gray-100 rounded transition-colors"
            title="Thanh toán theo tháng"
          >
            <FileCheck className={`h-3.5 w-3.5 lg:h-4 lg:w-4 ${iconStyles.infoIcon}`} />
          </button>
        );
      }

      buttons.push(
        <button
          key="return"
          onClick={(e) => {
            e.stopPropagation();
            handleAction(record, "return");
          }}
          className="p-1.5 lg:p-2 hover:bg-gray-100 rounded transition-colors"
          title="Xác nhận trả khách"
        >
          <User className={`h-3.5 w-3.5 lg:h-4 lg:w-4 ${iconStyles.navigationIcon}`} />
        </button>
      );
      buttons.push(
        <button
          key="permit"
          onClick={(e) => {
            e.stopPropagation();
            handleAction(record, "permit");
          }}
          className="p-1.5 lg:p-2 hover:bg-gray-100 rounded transition-colors"
          title="Cấp phép"
        >
          <FileCheck className={`h-3.5 w-3.5 lg:h-4 lg:w-4 ${iconStyles.successIcon}`} />
        </button>
      );
    } else if (status === "permit-issued") {
      buttons.push(
        <button
          key="payment"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/thanh-toan/${record.id}`);
          }}
          className="p-1.5 lg:p-2 hover:bg-gray-100 rounded transition-colors"
          title="Thanh toán"
        >
          <Banknote className={`h-3.5 w-3.5 lg:h-4 lg:w-4 ${iconStyles.warningIcon}`} />
        </button>
      );
      buttons.push(
        <button
          key="document"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedRecord(record);
            setDialogType("permit");
            setIsReadOnly(true);
            setDialogOpen(true);
          }}
          className="p-1.5 lg:p-2 hover:bg-gray-100 rounded transition-colors"
          title="Xem tài liệu"
        >
          <FileText className={`h-3.5 w-3.5 lg:h-4 lg:w-4 ${iconStyles.infoIcon}`} />
        </button>
      );
    } else if (status === "paid") {
      // Nếu xe đủ điều kiện (permitStatus === 'approved'), hiển thị icon "Cấp lệnh xuất bến"
      if (record.permitStatus === "approved") {
        buttons.push(
          <button
            key="departure-order"
            onClick={(e) => {
              e.stopPropagation();
              handleAction(record, "departure-order");
            }}
            className="p-1.5 lg:p-2 hover:bg-gray-100 rounded transition-colors"
            title="Cấp lệnh xuất bến"
          >
            <ShieldCheck className={`h-3.5 w-3.5 lg:h-4 lg:w-4 ${iconStyles.successIcon}`} />
          </button>
        );
      }
      // Nếu xe không đủ điều kiện (permitStatus === 'rejected') hoặc chưa có trạng thái cấp phép, hiển thị icon "cho xe ra bến"
      if (record.permitStatus === "rejected" || !record.permitStatus) {
        buttons.push(
          <button
            key="exit"
            onClick={async (e) => {
              e.stopPropagation();
              if (window.confirm("Bạn có chắc chắn muốn cho xe ra bến?")) {
                try {
                  await dispatchService.recordExit(record.id);
                  toast.success("Cho xe ra bến thành công!");
                  loadRecords();
                } catch (error) {
                  console.error("Failed to record exit:", error);
                  toast.error("Không thể cho xe ra bến. Vui lòng thử lại sau.");
                }
              }
            }}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Cho xe ra bến"
          >
            <BusEnterIcon className="text-red-600" />
          </button>
        );
      }
    } else if (status === "departed") {
      // Chỉ hiển thị nút "Cho xe ra bến" nếu xe đang ở trạng thái "đã cấp lệnh" (chưa thực sự ra bến)
      if (record.currentStatus === "departure_ordered") {
        buttons.push(
          <button
            key="depart"
            onClick={(e) => {
              e.stopPropagation();
              handleAction(record, "depart");
            }}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Cho xe ra bến"
          >
            <BusEnterIcon className="text-gray-700" />
          </button>
        );
      }
    }

    return buttons;
  };

  // Render electronic order info for vehicles in station
  const renderElectronicOrderInfo = (
    record: DispatchRecord,
    status: DisplayStatus
  ) => {
    if (status !== "in-station") return null;

    const electronicStatus = record.metadata?.electronicOrderStatus;
    const electronicCode =
      record.metadata?.electronicOrderCode || record.transportOrderCode;
    const electronicUrl = record.metadata?.electronicOrderUrl;

    if (electronicStatus === "loading") {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Đang tự động tải Lệnh...</span>
        </div>
      );
    }

    if (electronicCode) {
      return (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Users className="h-4 w-4" />
          {electronicUrl ? (
            <a
              href={electronicUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
              onClick={(e) => e.stopPropagation()}
            >
              {electronicCode}
            </a>
          ) : (
            <span className="underline">{electronicCode}</span>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <XCircle className="h-4 w-4" />
        <span>Chưa sử dụng Lệnh điện tử</span>
      </div>
    );
  };

  const renderVehicleCard = (record: DispatchRecord, status: DisplayStatus) => {
    const getVehicleColor = () => {
      // Xe vãng lai (Irregular) - Orange
      if (record.metadata?.type === "irregular") {
        return "text-orange-600";
      }

      // Xe đã trả khách (Passengers Dropped) - Blue
      if (record.currentStatus === "passengers_dropped") {
        return "text-blue-600";
      }

      // Xe không đủ điều kiện (Ineligible) - Red
      if (
        record.permitStatus === "rejected" ||
        (status === "paid" && !record.permitStatus)
      ) {
        return "text-red-600";
      }

      // Xe đủ điều kiện (Eligible) - Green
      if (record.permitStatus === "approved") {
        return "text-green-600";
      }

      // Default based on status
      switch (status) {
        case "permit-issued":
        case "paid":
        case "departed":
          return "text-green-600";
        default:
          return "text-gray-600";
      }
    };

    const renderVehicleIcon = () => {
      const colorClass = getVehicleColor();
      const type = record.metadata?.type;

      if (type === "augmented") {
        return <BusPlusIcon className={`h-5 w-5 ${colorClass}`} />;
      }
      if (type === "replacement") {
        return <ArrowRightLeft className={`h-5 w-5 ${colorClass}`} />;
      }

      // Xe chưa cấp nốt (No Permit/Schedule)
      if (
        !record.scheduleId &&
        type !== "irregular" &&
        status === "in-station"
      ) {
        return <FileExclamationIcon className={`h-5 w-5 ${colorClass}`} />;
      }

      return <Bus className={`h-5 w-5 ${colorClass}`} />;
    };

    return (
      <Card
        key={record.id}
        className="mb-3 hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => {
          if (status === "in-station") {
            handleAction(record, "permit");
          } else if (status === "permit-issued") {
            navigate(`/thanh-toan/${record.id}`);
          } else if (status === "paid") {
            handleAction(record, "depart");
          }
        }}
      >
        <CardContent className="p-3 lg:p-4">
          <div className="space-y-2 lg:space-y-3">
            {/* Header with bus icon, plate number and entry time */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {renderVehicleIcon()}
                <span className="font-semibold text-gray-900 text-sm lg:text-base">
                  {record.vehiclePlateNumber}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs lg:text-sm text-gray-600">
                <Clock className={`h-3 w-3 lg:h-3.5 lg:w-3.5 ${iconStyles.navigationIcon}`} />
                <span className="hidden sm:inline">{formatVietnamDateTime(record.entryTime)}</span>
                <span className="sm:hidden">{formatVietnamDateTime(record.entryTime, "HH:mm")}</span>
              </div>
            </div>

            {/* Seat count / Passengers with permit time if available */}
            {(record.seatCount || record.passengersArrived) && (
              <div className="flex items-center justify-between gap-2 text-xs lg:text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Users className={`h-3 w-3 lg:h-4 lg:w-4 ${iconStyles.navigationIcon}`} />
                  <span>
                    {record.seatCount || record.passengersArrived || "-"}
                  </span>
                </div>
                {record.boardingPermitTime && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <FileCheck className={`h-3 w-3 lg:h-3.5 lg:w-3.5 ${iconStyles.successIcon}`} />
                    <span className="hidden sm:inline">{formatVietnamDateTime(record.boardingPermitTime)}</span>
                    <span className="sm:hidden">{formatVietnamDateTime(record.boardingPermitTime, "HH:mm")}</span>
                  </div>
                )}
              </div>
            )}

            {/* Electronic order info (in-station only) */}
            {renderElectronicOrderInfo(record, status)}

            {/* Driver name with departure time */}
            {(record.driverName || record.plannedDepartureTime) && (
              <div className="flex items-center justify-between gap-2 text-xs lg:text-sm text-gray-600">
                {record.driverName && (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <User className={`h-3 w-3 lg:h-4 lg:w-4 flex-shrink-0 ${iconStyles.navigationIcon}`} />
                    <span className="truncate">{record.driverName}</span>
                  </div>
                )}
                {record.plannedDepartureTime && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatVietnamDateTime(record.plannedDepartureTime)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Footer with route and action buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t">
              {record.routeName && (
                <div className="flex items-center gap-1.5 text-xs lg:text-sm text-gray-600 flex-1 min-w-0">
                  <MapPin className={`h-3 w-3 lg:h-3.5 lg:w-3.5 flex-shrink-0 ${iconStyles.navigationIcon}`} />
                  <span className="truncate">{record.routeName}</span>
                </div>
              )}
              <div className="flex items-center gap-1 flex-shrink-0 w-full sm:w-auto justify-end">
                {getActionButtons(record, status)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col space-y-3 lg:space-y-4 overflow-hidden p-3 sm:p-4 lg:p-6">
        {/* Header */}
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 flex-shrink-0">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${iconStyles.navigationIcon}`} />
            <Input
              placeholder="Tìm kiếm biển số, tuyến..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="outline" size="icon" onClick={loadRecords} className="shrink-0">
              <RefreshCw className={iconStyles.infoIcon} />
            </Button>
            
            <Button
              variant="outline"
              onClick={() => {
                setDialogType("depart-multiple");
                setDialogOpen(true);
              }}
              className="gap-2 flex-1 sm:flex-none"
              size="sm"
            >
              <ArrowRight className={iconStyles.infoIcon} />
              <span className="hidden sm:inline">Cho nhiều xe ra bến</span>
              <span className="sm:hidden">Nhiều xe</span>
            </Button>
          
            <Button
              onClick={() => {
                setDialogType("entry");
                setSelectedRecord(null);
                setDialogOpen(true);
              }}
              className="flex-1 sm:flex-none"
              size="sm"
            >
              <Plus className={iconStyles.successIcon} />
              <span className="hidden sm:inline ml-2">Cho xe vào bến</span>
              <span className="sm:hidden ml-2">Vào bến</span>
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 flex-1 overflow-hidden min-h-0">
          {/* Column 1: Trong bến */}
          <div className="bg-gray-50 rounded-lg p-3 lg:p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3 lg:mb-4 flex-shrink-0">
              <h2 className="font-semibold text-gray-900 text-sm lg:text-base">
                <span className="hidden sm:inline">Danh sách xe trong bến</span>
                <span className="sm:hidden">Trong bến</span>
                <span className="ml-1">({stats["in-station"]})</span>
              </h2>
              <Button variant="ghost" size="icon" onClick={loadRecords} className="h-8 w-8 lg:h-10 lg:w-10">
                <RefreshCw className={iconStyles.navigationIcon} />
              </Button>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Đang tải...
                </div>
              ) : getRecordsByStatus("in-station").length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Không có dữ liệu
                </div>
              ) : (
                getRecordsByStatus("in-station").map((record) =>
                  renderVehicleCard(record, "in-station")
                )
              )}
            </div>
          </div>

          {/* Column 2: Đã cấp nốt */}
          <div className="bg-gray-50 rounded-lg p-3 lg:p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3 lg:mb-4 flex-shrink-0">
              <h2 className="font-semibold text-gray-900 text-sm lg:text-base">
                <span className="hidden sm:inline">Danh sách xe đã cấp nốt</span>
                <span className="sm:hidden">Đã cấp nốt</span>
                <span className="ml-1">({stats["permit-issued"]})</span>
              </h2>
              <Button variant="ghost" size="icon" onClick={loadRecords} className="h-8 w-8 lg:h-10 lg:w-10">
                <RefreshCw className={iconStyles.navigationIcon} />
              </Button>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Đang tải...
                </div>
              ) : getRecordsByStatus("permit-issued").length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Không có dữ liệu
                </div>
              ) : (
                getRecordsByStatus("permit-issued").map((record) =>
                  renderVehicleCard(record, "permit-issued")
                )
              )}
            </div>
          </div>

          {/* Column 3: Đã thanh toán */}
          <div className="bg-gray-50 rounded-lg p-3 lg:p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3 lg:mb-4 flex-shrink-0">
              <h2 className="font-semibold text-gray-900 text-sm lg:text-base">
                <span className="hidden sm:inline">Danh sách xe đã thanh toán</span>
                <span className="sm:hidden">Đã thanh toán</span>
                <span className="ml-1">({stats["paid"]})</span>
              </h2>
              <Button variant="ghost" size="icon" onClick={loadRecords} className="h-8 w-8 lg:h-10 lg:w-10">
                <RefreshCw className={iconStyles.navigationIcon} />
              </Button>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Đang tải...
                </div>
              ) : getRecordsByStatus("paid").length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Không có dữ liệu
                </div>
              ) : (
                getRecordsByStatus("paid").map((record) =>
                  renderVehicleCard(record, "paid")
                )
              )}
            </div>
          </div>

          {/* Column 4: Đã cấp lệnh xuất bến */}
          <div className="bg-gray-50 rounded-lg p-3 lg:p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3 lg:mb-4 flex-shrink-0">
              <h2 className="font-semibold text-gray-900 text-sm lg:text-base">
                <span className="hidden sm:inline">Danh sách xe đã cấp lệnh xuất bến</span>
                <span className="sm:hidden">Đã xuất bến</span>
                <span className="ml-1">({stats["departed"]})</span>
              </h2>
              <Button variant="ghost" size="icon" onClick={loadRecords} className="h-8 w-8 lg:h-10 lg:w-10">
                <RefreshCw className={iconStyles.navigationIcon} />
              </Button>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Đang tải...
                </div>
              ) : getRecordsByStatus("departed").length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Không có dữ liệu
                </div>
              ) : (
                getRecordsByStatus("departed").map((record) =>
                  renderVehicleCard(record, "departed")
                )
              )}
            </div>
          </div>
        </div>

        {/* CapPhepDialog - Full Page */}
        {dialogType === "permit" && selectedRecord && (
          <CapPhepDialog
            key={selectedRecord.id}
            record={selectedRecord}
            open={dialogOpen}
            readOnly={isReadOnly}
            onClose={() => setDialogOpen(false)}
            onSuccess={() => {
              loadRecords();
            }}
          />
        )}

        {/* ChoXeVaoBenDialog - Full Page */}
        {dialogType === "entry" && (
          <ChoXeVaoBenDialog
            open={dialogOpen}
            vehicleOptions={vehicleOptions}
            onClose={() => setDialogOpen(false)}
            onSuccess={() => {
              loadRecords();
            }}
          />
        )}
        {/* Cho nhiều xe ra bến Dialog */}
        {dialogType === "depart-multiple" && (
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
          >
            <DialogContent
              className="max-h-[95vh] overflow-y-auto w-[95vw] max-w-[1800px]"
            >
              <DialogClose onClose={() => setDialogOpen(false)} />
              <DialogHeader>
                <DialogTitle>Cho nhiều xe ra bến</DialogTitle>
              </DialogHeader>
              <ChoNhieuXeRaBenDialog
                records={records.filter((r) => {
                  // Only show records that have departure order (ready to exit)
                  return r.currentStatus === "departure_ordered";
                })}
                onClose={() => setDialogOpen(false)}
                onSuccess={() => {
                  loadRecords();
                }}
                open={dialogOpen}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* Other Dialogs */}
        <Dialog
          open={dialogOpen && dialogType !== "permit" && dialogType !== "entry" && dialogType !== "depart-multiple"}
          onOpenChange={setDialogOpen}
        >
          <DialogContent
            className={`max-h-[95vh] overflow-y-auto w-[95vw] ${
              dialogType === "entry"
                ? "max-w-[1800px]"
                : dialogType === "depart"
                ? "max-w-xl"
                : "max-w-5xl"
            }`}
          >
            <DialogClose onClose={() => setDialogOpen(false)} />
            <DialogHeader>
              <DialogTitle>
                {dialogType === "return" && "Xác nhận trả khách"}
                {dialogType === "depart" && "Cho xe ra bến"}
                {dialogType === "departure-order" && "Cấp lệnh xuất bến"}
                {dialogType === "monthly-payment" && "Thanh toán theo tháng"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {dialogType === "return" && selectedRecord && (
                <XeTraKhachDialog
                  record={selectedRecord}
                  onClose={() => setDialogOpen(false)}
                  onSuccess={() => {
                    loadRecords();
                  }}
                />
              )}
              {dialogType === "depart" && selectedRecord && (
                <ChoXeRaBenDialog
                  record={selectedRecord}
                  onClose={() => setDialogOpen(false)}
                  onSuccess={() => {
                    loadRecords();
                  }}
                />
              )}
              {dialogType === "departure-order" && selectedRecord && (
                <CapLenhXuatBenDialog
                  record={selectedRecord}
                  onClose={() => setDialogOpen(false)}
                  onSuccess={() => {
                    loadRecords();
                  }}
                />
              )}
              {dialogType === "monthly-payment" && selectedRecord && (
                <ThanhToanTheoThangDialog
                  record={selectedRecord}
                  onClose={() => setDialogOpen(false)}
                  onSuccess={() => {
                    loadRecords();
                  }}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Footer with legend - Sticky at bottom */}
      <div className="border-t pt-4 pb-4 px-4 lg:px-6 bg-white flex-shrink-0">
        <div className="flex items-center justify-between text-sm">
          {/* Left side - Vehicle Types */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Bus className="h-5 w-5 text-gray-600" />
              <span className="text-gray-700">Xe tuyến cố định</span>
            </div>
            <div className="flex items-center gap-2">
              <BusPlusIcon className="h-5 w-5" />
              <span className="text-gray-700">Xe tăng cường</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <ArrowRightLeft className="h-5 w-5" />
              <span className="text-gray-700">Xe đi thay</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 text-gray-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-file-exclamation-point-icon lucide-file-exclamation-point"
                >
                  <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
              </div>
              <span className="text-gray-700">Xe chưa cấp nốt</span>
            </div>
          </div>

          {/* Right side - Vehicle Status */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-600"></div>
              <span className="text-sm text-gray-700">Xe đủ điều kiện</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-600"></div>
              <span className="text-sm text-gray-700">
                Xe không đủ điều kiện
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-600"></div>
              <span className="text-sm text-gray-700">Xe đã trả khách</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-orange-600"></div>
              <span className="text-sm text-gray-700">Xe vãng lai</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BusPlusIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`relative inline-flex h-5 w-5 ${className}`}>
      <CarFront className="h-5 w-5" />
      <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
        <Plus className="h-2.5 w-2.5" strokeWidth={3} />
      </div>
    </div>
  );
}

function FileExclamationIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function BusEnterIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`relative inline-flex h-5 w-5 ${className}`}>
      <Bus className="h-5 w-5" />
      <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
        <ArrowRight className="h-2.5 w-2.5" strokeWidth={2.5} />
      </div>
    </div>
  )
}
