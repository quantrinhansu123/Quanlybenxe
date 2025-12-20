import { useState, useEffect, useMemo } from "react";
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
  User,
  RefreshCw,
  ShieldCheck,
  XCircle,
  Banknote,
  ArrowRightLeft,
  ArrowRight,
  Users,
  Pencil,
  Trash2,
  Zap,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
import { BusPlusIcon, FileExclamationIcon, BusEnterIcon } from "@/components/dispatch/icons";
import { cn } from "@/lib/utils";

type DisplayStatus = "in-station" | "permit-issued" | "paid" | "departed";

// Column configuration with distinct visual styles - Light theme
const columnConfig: Record<DisplayStatus, {
  title: string;
  shortTitle: string;
  gradient: string;
  accentColor: string;
  iconBg: string;
  iconColor: string;
  icon: React.ElementType;
  borderColor: string;
  headerBg: string;
}> = {
  "in-station": {
    title: "Xe trong bến",
    shortTitle: "Trong bến",
    gradient: "from-sky-50 to-cyan-50",
    accentColor: "text-sky-700",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    icon: Bus,
    borderColor: "border-sky-200",
    headerBg: "bg-gradient-to-r from-sky-500 to-cyan-500"
  },
  "permit-issued": {
    title: "Đã cấp nốt",
    shortTitle: "Cấp nốt",
    gradient: "from-amber-50 to-orange-50",
    accentColor: "text-amber-700",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    icon: FileCheck,
    borderColor: "border-amber-200",
    headerBg: "bg-gradient-to-r from-amber-500 to-orange-500"
  },
  "paid": {
    title: "Đã thanh toán",
    shortTitle: "Thanh toán",
    gradient: "from-emerald-50 to-teal-50",
    accentColor: "text-emerald-700",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    icon: Banknote,
    borderColor: "border-emerald-200",
    headerBg: "bg-gradient-to-r from-emerald-500 to-teal-500"
  },
  "departed": {
    title: "Sẵn sàng xuất bến",
    shortTitle: "Xuất bến",
    gradient: "from-violet-50 to-purple-50",
    accentColor: "text-violet-700",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    icon: ArrowRight,
    borderColor: "border-violet-200",
    headerBg: "bg-gradient-to-r from-violet-500 to-purple-500"
  }
};

// Live indicator component
function LiveIndicator({ count, color = "emerald" }: { count: number; color?: string }) {
  const colors: Record<string, { ping: string; dot: string }> = {
    emerald: { ping: "bg-emerald-400", dot: "bg-emerald-500" },
    sky: { ping: "bg-sky-400", dot: "bg-sky-500" },
    amber: { ping: "bg-amber-400", dot: "bg-amber-500" },
    violet: { ping: "bg-violet-400", dot: "bg-violet-500" },
  };
  const c = colors[color] || colors.emerald;
  
  return (
    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm">
      <span className="relative flex h-2 w-2">
        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", c.ping)}></span>
        <span className={cn("relative inline-flex rounded-full h-2 w-2", c.dot)}></span>
      </span>
      <span className="text-xs font-bold text-gray-700 tabular-nums">{count}</span>
    </div>
  );
}

// Status badge component - Light theme
function VehicleStatusBadge({ type }: { type: 'eligible' | 'ineligible' | 'returned' | 'irregular' }) {
  const configs = {
    eligible: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    ineligible: { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' },
    returned: { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500' },
    irregular: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  };
  const config = configs[type];
  
  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full", config.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      <span className={cn("text-[10px] font-semibold uppercase tracking-wider", config.text)}>
        {type === 'eligible' ? 'Đủ ĐK' : type === 'ineligible' ? 'Thiếu ĐK' : type === 'returned' ? 'Trả khách' : 'Vãng lai'}
      </span>
    </div>
  );
}

// Action button component - Light theme
function ActionButton({ 
  icon: Icon, 
  onClick, 
  title, 
  variant = 'default' 
}: { 
  icon: React.ElementType; 
  onClick: (e: React.MouseEvent) => void; 
  title: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const variants = {
    default: 'hover:bg-gray-100 text-gray-500 hover:text-gray-700',
    success: 'hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700',
    warning: 'hover:bg-amber-100 text-amber-600 hover:text-amber-700',
    danger: 'hover:bg-rose-100 text-rose-600 hover:text-rose-700',
    info: 'hover:bg-sky-100 text-sky-600 hover:text-sky-700',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "p-2 rounded-lg transition-all duration-200 hover:shadow-sm",
        variants[variant]
      )}
      title={title}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export default function DieuDo() {
  const navigate = useNavigate();
  const { records, setRecords } = useDispatchStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<DispatchRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<
    | "entry"
    | "edit"
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
    
    // Auto refresh every 30 seconds
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
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Không thể xóa");
    }
  };

  const handleEdit = (record: DispatchRecord) => {
    setSelectedRecord(record);
    setDialogType("edit");
    setIsReadOnly(false);
    setDialogOpen(true);
  };

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

  const getRecordsByStatus = (status: DisplayStatus) => {
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
  };

  const stats = useMemo(() => ({
    "in-station": getRecordsByStatus("in-station").length,
    "permit-issued": getRecordsByStatus("permit-issued").length,
    paid: getRecordsByStatus("paid").length,
    departed: getRecordsByStatus("departed").length,
  }), [records, searchQuery]);

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
    .filter((v) => !activeVehicleIds.has(v.id))
    .map((v) => ({ id: v.id, plateNumber: v.plateNumber }));

  const handleAction = (record: DispatchRecord, type: typeof dialogType) => {
    setSelectedRecord(record);
    setDialogType(type);
    setDialogOpen(true);
    setIsReadOnly(false);
  };

  const isMonthlyPaymentVehicle = (record: DispatchRecord): boolean => {
    if (record.metadata?.paymentType === "monthly") return true;
    const displayStatus = getDisplayStatus(record.currentStatus);
    if (record.transportOrderCode && displayStatus === "in-station") return true;
    return false;
  };

  const getActionButtons = (record: DispatchRecord, status: DisplayStatus) => {
    const buttons: React.ReactNode[] = [];

    if (status === "in-station") {
      if (isMonthlyPaymentVehicle(record)) {
        buttons.push(
          <ActionButton
            key="monthly-payment"
            icon={FileCheck}
            onClick={(e) => { e.stopPropagation(); handleAction(record, "monthly-payment"); }}
            title="Thanh toán theo tháng"
            variant="info"
          />
        );
      }
      buttons.push(
        <ActionButton
          key="return"
          icon={User}
          onClick={(e) => { e.stopPropagation(); handleAction(record, "return"); }}
          title="Xác nhận trả khách"
          variant="info"
        />,
        <ActionButton
          key="permit"
          icon={FileCheck}
          onClick={(e) => { e.stopPropagation(); handleAction(record, "permit"); }}
          title="Cấp phép"
          variant="success"
        />,
        <ActionButton
          key="edit"
          icon={Pencil}
          onClick={(e) => { e.stopPropagation(); handleEdit(record); }}
          title="Sửa thông tin"
          variant="warning"
        />,
        <ActionButton
          key="delete"
          icon={Trash2}
          onClick={(e) => { e.stopPropagation(); handleDelete(record); }}
          title="Xóa"
          variant="danger"
        />
      );
    } else if (status === "permit-issued") {
      buttons.push(
        <ActionButton
          key="payment"
          icon={Banknote}
          onClick={(e) => { e.stopPropagation(); navigate(`/thanh-toan/${record.id}`); }}
          title="Thanh toán"
          variant="warning"
        />,
        <ActionButton
          key="document"
          icon={FileText}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedRecord(record);
            setDialogType("permit");
            setIsReadOnly(true);
            setDialogOpen(true);
          }}
          title="Xem tài liệu"
          variant="info"
        />
      );
    } else if (status === "paid") {
      if (record.permitStatus === "approved") {
        buttons.push(
          <ActionButton
            key="departure-order"
            icon={ShieldCheck}
            onClick={(e) => { e.stopPropagation(); handleAction(record, "departure-order"); }}
            title="Cấp lệnh xuất bến"
            variant="success"
          />
        );
      }
      if (record.permitStatus === "rejected" || !record.permitStatus) {
        buttons.push(
          <button
            key="exit"
            onClick={async (e) => {
              e.stopPropagation();
              if (window.confirm("Cho xe ra bến?")) {
                try {
                  await dispatchService.recordExit(record.id);
                  toast.success("Cho xe ra bến thành công!");
                  loadRecords();
                } catch {
                  toast.error("Không thể cho xe ra bến");
                }
              }
            }}
            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all"
            title="Cho xe ra bến"
          >
            <BusEnterIcon className="h-4 w-4" />
          </button>
        );
      }
    } else if (status === "departed" && record.currentStatus === "departure_ordered") {
      buttons.push(
        <button
          key="depart"
          onClick={(e) => { e.stopPropagation(); handleAction(record, "depart"); }}
          className="p-1.5 rounded-lg hover:bg-violet-500/20 text-violet-400 hover:text-violet-300 transition-all"
          title="Cho xe ra bến"
        >
          <BusEnterIcon className="h-4 w-4" />
        </button>
      );
    }

    return buttons;
  };

  const renderElectronicOrderInfo = (record: DispatchRecord, status: DisplayStatus) => {
    if (status !== "in-station") return null;

    const metadata = (record.metadata || {}) as Record<string, unknown>;
    const electronicStatus = metadata.electronicOrderStatus as string | undefined;
    const electronicCode = String(metadata.electronicOrderCode || record.transportOrderCode || "");
    const electronicUrl = metadata.electronicOrderUrl as string | undefined;

    if (electronicStatus === "loading") {
      return (
        <div className="flex items-center gap-2 text-xs text-sky-600">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Đang tải lệnh...</span>
        </div>
      );
    }

    if (electronicCode) {
      return (
        <div className="flex items-center gap-2 text-xs text-sky-600 font-medium">
          <Zap className="h-3 w-3" />
          {electronicUrl ? (
            <a href={electronicUrl} target="_blank" rel="noreferrer" 
               className="hover:underline hover:text-sky-700" onClick={(e) => e.stopPropagation()}>
              {electronicCode}
            </a>
          ) : (
            <span>{electronicCode}</span>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-xs text-rose-500">
        <XCircle className="h-3 w-3" />
        <span>Chưa có lệnh điện tử</span>
      </div>
    );
  };

  const getVehicleStatus = (record: DispatchRecord, status: DisplayStatus): 'eligible' | 'ineligible' | 'returned' | 'irregular' | null => {
    if (record.metadata?.type === "irregular") return 'irregular';
    if (record.currentStatus === "passengers_dropped") return 'returned';
    if (record.permitStatus === "rejected" || (status === "paid" && !record.permitStatus)) return 'ineligible';
    if (record.permitStatus === "approved") return 'eligible';
    return null;
  };

  const getVehicleIconColor = (record: DispatchRecord, status: DisplayStatus) => {
    if (record.metadata?.type === "irregular") return "text-amber-600";
    if (record.currentStatus === "passengers_dropped") return "text-sky-600";
    if (record.permitStatus === "rejected" || (status === "paid" && !record.permitStatus)) return "text-rose-600";
    if (record.permitStatus === "approved") return "text-emerald-600";
    
    switch (status) {
      case "permit-issued":
      case "paid":
      case "departed":
        return "text-emerald-600";
      default:
        return "text-gray-500";
    }
  };

  const renderVehicleIcon = (record: DispatchRecord, status: DisplayStatus) => {
    const colorClass = getVehicleIconColor(record, status);
    const type = record.metadata?.type;

    if (type === "augmented") return <BusPlusIcon className={cn("h-5 w-5", colorClass)} />;
    if (type === "replacement") return <ArrowRightLeft className={cn("h-5 w-5", colorClass)} />;
    if (!record.scheduleId && type !== "irregular" && status === "in-station") {
      return <FileExclamationIcon className={cn("h-5 w-5", colorClass)} />;
    }
    return <Bus className={cn("h-5 w-5", colorClass)} />;
  };

  const renderVehicleCard = (record: DispatchRecord, status: DisplayStatus) => {
    const config = columnConfig[status];
    const vehicleStatus = getVehicleStatus(record, status);

    return (
      <div
        key={record.id}
        className={cn(
          "group relative rounded-xl p-4 cursor-pointer transition-all duration-300",
          "bg-white border-2 shadow-sm",
          "hover:shadow-lg hover:scale-[1.02]",
          config.borderColor
        )}
        onClick={() => {
          if (status === "in-station") handleAction(record, "permit");
          else if (status === "permit-issued") navigate(`/thanh-toan/${record.id}`);
          else if (status === "paid") handleAction(record, "depart");
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("p-2.5 rounded-xl", config.iconBg)}>
              {renderVehicleIcon(record, status)}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-base tracking-wide truncate">
                {record.vehiclePlateNumber}
              </h3>
              {vehicleStatus && <VehicleStatusBadge type={vehicleStatus} />}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular-nums font-medium">{formatVietnamDateTime(record.entryTime, "HH:mm")}</span>
          </div>
        </div>

        {/* Info rows */}
        <div className="space-y-2 mb-3">
          {(record.seatCount || record.passengersArrived) && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="h-3.5 w-3.5" />
                <span>{record.seatCount || record.passengersArrived} chỗ</span>
              </div>
              {record.boardingPermitTime && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <FileCheck className="h-3 w-3" />
                  <span>{formatVietnamDateTime(record.boardingPermitTime, "HH:mm")}</span>
                </div>
              )}
            </div>
          )}

          {renderElectronicOrderInfo(record, status)}

          {record.driverName && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-3.5 w-3.5" />
              <span className="truncate">{record.driverName}</span>
            </div>
          )}

          {record.routeName && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{record.routeName}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
          {getActionButtons(record, status)}
        </div>
      </div>
    );
  };

  const renderColumn = (status: DisplayStatus) => {
    const config = columnConfig[status];
    const columnRecords = getRecordsByStatus(status);
    const Icon = config.icon;
    const colorMap: Record<DisplayStatus, string> = {
      "in-station": "sky",
      "permit-issued": "amber",
      "paid": "emerald",
      "departed": "violet"
    };

    return (
      <div className={cn(
        "flex flex-col h-full min-h-0 rounded-2xl overflow-hidden shadow-sm border",
        `bg-gradient-to-b ${config.gradient}`,
        config.borderColor
      )}>
        {/* Column Header - Gradient */}
        <div className={cn("relative px-4 py-4", config.headerBg)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm lg:text-base drop-shadow-sm">
                  <span className="hidden lg:inline">{config.title}</span>
                  <span className="lg:hidden">{config.shortTitle}</span>
                </h2>
              </div>
            </div>
            <LiveIndicator count={columnRecords.length} color={colorMap[status]} />
          </div>
        </div>

        {/* Column Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 bg-white/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <RefreshCw className="h-8 w-8 animate-spin mb-3" />
              <span className="text-sm font-medium">Đang tải...</span>
            </div>
          ) : columnRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Bus className="h-10 w-10 mb-3 opacity-50" />
              <span className="text-sm font-medium">Không có xe</span>
            </div>
          ) : (
            columnRecords.map((record) => renderVehicleCard(record, status))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      {/* Header - Light Theme */}
      <div className="flex-shrink-0 px-4 lg:px-6 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Title & Stats */}
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/30">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg lg:text-xl font-bold text-gray-900">Bảng điều độ</h1>
                <p className="text-xs text-gray-500">
                  {totalActive} xe đang hoạt động
                </p>
              </div>
            </div>
            
            {/* Quick stats */}
            <div className="hidden md:flex items-center gap-4 ml-6 pl-6 border-l border-gray-200">
              {(Object.keys(columnConfig) as DisplayStatus[]).map((key) => (
                <div key={key} className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
                  <div className={cn("h-2.5 w-2.5 rounded-full", 
                    key === 'in-station' ? 'bg-sky-500' :
                    key === 'permit-issued' ? 'bg-amber-500' :
                    key === 'paid' ? 'bg-emerald-500' : 'bg-violet-500'
                  )} />
                  <span className="text-sm font-semibold text-gray-700 tabular-nums">{stats[key]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm biển số, tuyến, tài xế..."
                className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-sky-500 focus:ring-sky-500/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={loadRecords}
              className="border-gray-300 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            
            <Button
              variant="outline"
              onClick={() => { setDialogType("depart-multiple"); setDialogOpen(true); }}
              className="gap-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-700 hidden sm:flex"
            >
              <ArrowRight className="h-4 w-4" />
              <span className="hidden lg:inline">Nhiều xe ra bến</span>
            </Button>
          
            <Button
              onClick={() => { setDialogType("entry"); setSelectedRecord(null); setDialogOpen(true); }}
              className="gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-lg shadow-sky-500/30"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Vào bến</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden p-4 lg:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 h-full">
          {renderColumn("in-station")}
          {renderColumn("permit-issued")}
          {renderColumn("paid")}
          {renderColumn("departed")}
        </div>
      </div>

      {/* Footer Legend - Light Theme */}
      <div className="flex-shrink-0 px-4 lg:px-6 py-3 border-t border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-2 text-gray-600">
              <Bus className="h-4 w-4" />
              <span className="font-medium">Tuyến cố định</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <BusPlusIcon className="h-4 w-4" />
              <span className="font-medium">Tăng cường</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <ArrowRightLeft className="h-4 w-4" />
              <span className="font-medium">Đi thay</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" />
              <span className="text-gray-600 font-medium">Đủ ĐK</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm" />
              <span className="text-gray-600 font-medium">Thiếu ĐK</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-sm" />
              <span className="text-gray-600 font-medium">Trả khách</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-sm" />
              <span className="text-gray-600 font-medium">Vãng lai</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {dialogType === "permit" && selectedRecord && (
        <CapPhepDialog
          key={selectedRecord.id}
          record={selectedRecord}
          open={dialogOpen}
          readOnly={isReadOnly}
          onClose={() => setDialogOpen(false)}
          onSuccess={() => loadRecords()}
        />
      )}

      {(dialogType === "entry" || dialogType === "edit") && (
        <ChoXeVaoBenDialog
          open={dialogOpen}
          vehicleOptions={vehicleOptions}
          onClose={() => setDialogOpen(false)}
          onSuccess={() => loadRecords()}
          editRecord={dialogType === "edit" ? selectedRecord : null}
        />
      )}

      {dialogType === "depart-multiple" && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[95vh] overflow-y-auto w-[95vw] max-w-[1800px]">
            <DialogClose onClose={() => setDialogOpen(false)} />
            <DialogHeader>
              <DialogTitle>Cho nhiều xe ra bến</DialogTitle>
            </DialogHeader>
            <ChoNhieuXeRaBenDialog
              records={records.filter((r) => r.currentStatus === "departure_ordered")}
              onClose={() => setDialogOpen(false)}
              onSuccess={() => loadRecords()}
              open={dialogOpen}
            />
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={dialogOpen && !["permit", "entry", "edit", "depart-multiple"].includes(dialogType)}
        onOpenChange={setDialogOpen}
      >
        <DialogContent className={cn(
          "max-h-[95vh] overflow-y-auto w-[95vw]",
          dialogType === "depart" ? "max-w-xl" : "max-w-5xl"
        )}>
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
              <XeTraKhachDialog record={selectedRecord} onClose={() => setDialogOpen(false)} onSuccess={() => loadRecords()} />
            )}
            {dialogType === "depart" && selectedRecord && (
              <ChoXeRaBenDialog record={selectedRecord} onClose={() => setDialogOpen(false)} onSuccess={() => loadRecords()} />
            )}
            {dialogType === "departure-order" && selectedRecord && (
              <CapLenhXuatBenDialog record={selectedRecord} onClose={() => setDialogOpen(false)} onSuccess={() => loadRecords()} />
            )}
            {dialogType === "monthly-payment" && selectedRecord && (
              <ThanhToanTheoThangDialog record={selectedRecord} onClose={() => setDialogOpen(false)} onSuccess={() => loadRecords()} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
