import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Search,
  FileCheck,
  Plus,
  Bus,
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
  Activity,
  Radio,
  Radar,
  Timer,
  CheckCircle2,
  AlertTriangle,
  Sparkles
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

// Enhanced Column Configuration with Glass Effect
const columnConfig: Record<DisplayStatus, {
  title: string;
  shortTitle: string;
  gradient: string;
  glassGradient: string;
  accentColor: string;
  iconBg: string;
  iconColor: string;
  icon: React.ElementType;
  borderColor: string;
  headerGradient: string;
  glowColor: string;
  dotColor: string;
}> = {
  "in-station": {
    title: "Xe trong bến",
    shortTitle: "Trong bến",
    gradient: "from-sky-500/10 via-cyan-500/5 to-transparent",
    glassGradient: "from-sky-500 via-cyan-500 to-blue-600",
    accentColor: "text-sky-700",
    iconBg: "bg-gradient-to-br from-sky-500 to-cyan-600",
    iconColor: "text-white",
    icon: Radio,
    borderColor: "border-sky-200/50",
    headerGradient: "from-sky-600 via-sky-500 to-cyan-500",
    glowColor: "shadow-sky-500/20",
    dotColor: "bg-sky-500"
  },
  "permit-issued": {
    title: "Đã cấp nốt",
    shortTitle: "Cấp nốt",
    gradient: "from-amber-500/10 via-orange-500/5 to-transparent",
    glassGradient: "from-amber-500 via-orange-500 to-yellow-600",
    accentColor: "text-amber-700",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
    iconColor: "text-white",
    icon: FileCheck,
    borderColor: "border-amber-200/50",
    headerGradient: "from-amber-600 via-amber-500 to-orange-500",
    glowColor: "shadow-amber-500/20",
    dotColor: "bg-amber-500"
  },
  "paid": {
    title: "Đã thanh toán",
    shortTitle: "Thanh toán",
    gradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
    glassGradient: "from-emerald-500 via-teal-500 to-green-600",
    accentColor: "text-emerald-700",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600",
    iconColor: "text-white",
    icon: Banknote,
    borderColor: "border-emerald-200/50",
    headerGradient: "from-emerald-600 via-emerald-500 to-teal-500",
    glowColor: "shadow-emerald-500/20",
    dotColor: "bg-emerald-500"
  },
  "departed": {
    title: "Sẵn sàng xuất",
    shortTitle: "Xuất bến",
    gradient: "from-violet-500/10 via-purple-500/5 to-transparent",
    glassGradient: "from-violet-500 via-purple-500 to-indigo-600",
    accentColor: "text-violet-700",
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-600",
    iconColor: "text-white",
    icon: ArrowRight,
    borderColor: "border-violet-200/50",
    headerGradient: "from-violet-600 via-violet-500 to-purple-500",
    glowColor: "shadow-violet-500/20",
    dotColor: "bg-violet-500"
  }
};

// Radar Pulse Animation Component
function RadarPulse({ count, color }: { count: number; color: string }) {
  const colors: Record<string, string> = {
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    violet: "bg-violet-500",
  };
  
  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-white/50">
      <div className="relative">
        <span className={cn(
          "absolute inline-flex h-3 w-3 rounded-full opacity-75 animate-ping",
          colors[color]
        )} />
        <span className={cn(
          "relative inline-flex h-3 w-3 rounded-full",
          colors[color]
        )} />
      </div>
      <span className="text-sm font-black text-slate-800 tabular-nums">{count}</span>
    </div>
  );
}

// Status Ribbon Component
function StatusRibbon({ type }: { type: 'eligible' | 'ineligible' | 'returned' | 'irregular' }) {
  const configs = {
    eligible: { 
      bg: 'bg-gradient-to-r from-emerald-500 to-teal-500', 
      text: 'ĐỦ ĐK',
      icon: CheckCircle2
    },
    ineligible: { 
      bg: 'bg-gradient-to-r from-rose-500 to-red-500', 
      text: 'THIẾU',
      icon: XCircle
    },
    returned: { 
      bg: 'bg-gradient-to-r from-sky-500 to-blue-500', 
      text: 'TRẢ KHÁCH',
      icon: Users
    },
    irregular: { 
      bg: 'bg-gradient-to-r from-amber-500 to-orange-500', 
      text: 'VÃNG LAI',
      icon: AlertTriangle
    },
  };
  const config = configs[type];
  const Icon = config.icon;
  
  return (
    <div className={cn(
      "absolute -top-1 -right-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-bold uppercase tracking-wider shadow-lg",
      config.bg
    )}>
      <Icon className="w-3 h-3" />
      <span>{config.text}</span>
    </div>
  );
}

// Enhanced Action Button
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
    default: 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800',
    success: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-600 hover:text-emerald-700 hover:shadow-emerald-200',
    warning: 'bg-amber-100 hover:bg-amber-200 text-amber-600 hover:text-amber-700 hover:shadow-amber-200',
    danger: 'bg-rose-100 hover:bg-rose-200 text-rose-600 hover:text-rose-700 hover:shadow-rose-200',
    info: 'bg-sky-100 hover:bg-sky-200 text-sky-600 hover:text-sky-700 hover:shadow-sky-200',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "p-2.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-95",
        variants[variant]
      )}
      title={title}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

// Floating Dots Empty State
function FloatingDotsEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative w-24 h-24">
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Bus className="w-8 h-8 text-slate-300" />
          </div>
        </div>
        {/* Floating dots */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: '0s', animationDuration: '1.5s' }} />
        <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '1.5s' }} />
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '1.5s' }} />
        <div className="absolute top-1/2 -left-1 w-2 h-2 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: '0.6s', animationDuration: '1.5s' }} />
        <div className="absolute top-1/2 -right-1 w-2 h-2 rounded-full bg-rose-300 animate-bounce" style={{ animationDelay: '0.8s', animationDuration: '1.5s' }} />
      </div>
      <p className="text-slate-400 font-medium mt-4">{message}</p>
    </div>
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
    .filter((v) => {
      const isEditingThisVehicle = dialogType === "edit" && selectedRecord?.vehicleId === v.id;
      return !activeVehicleIds.has(v.id) || isEditingThisVehicle;
    })
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
          <ActionButton
            key="exit"
            icon={BusEnterIcon}
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
            title="Cho xe ra bến"
            variant="danger"
          />
        );
      }
    } else if (status === "departed" && record.currentStatus === "departure_ordered") {
      buttons.push(
        <ActionButton
          key="depart"
          icon={BusEnterIcon}
          onClick={(e) => { e.stopPropagation(); handleAction(record, "depart"); }}
          title="Cho xe ra bến"
          variant="success"
        />
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
        <div className="flex items-center gap-2 text-xs text-sky-600 bg-sky-50 px-2 py-1 rounded-lg">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Đang tải lệnh...</span>
        </div>
      );
    }

    if (electronicCode) {
      return (
        <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 bg-sky-50 px-2 py-1 rounded-lg">
          <Zap className="h-3 w-3" />
          {electronicUrl ? (
            <a href={electronicUrl} target="_blank" rel="noreferrer" 
               className="hover:underline" onClick={(e) => e.stopPropagation()}>
              {electronicCode}
            </a>
          ) : (
            <span>{electronicCode}</span>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-xs text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">
        <XCircle className="h-3 w-3" />
        <span>Chưa có lệnh</span>
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

  const getVehicleIconBg = (record: DispatchRecord, status: DisplayStatus) => {
    if (record.metadata?.type === "irregular") return "from-amber-500 to-orange-600";
    if (record.currentStatus === "passengers_dropped") return "from-sky-500 to-blue-600";
    if (record.permitStatus === "rejected" || (status === "paid" && !record.permitStatus)) return "from-rose-500 to-red-600";
    if (record.permitStatus === "approved") return "from-emerald-500 to-teal-600";
    
    return columnConfig[status].iconBg.replace('bg-gradient-to-br ', '');
  };

  const renderVehicleIcon = (record: DispatchRecord, status: DisplayStatus) => {
    const type = record.metadata?.type;
    if (type === "augmented") return <BusPlusIcon className="h-5 w-5 text-white" />;
    if (type === "replacement") return <ArrowRightLeft className="h-5 w-5 text-white" />;
    if (!record.scheduleId && type !== "irregular" && status === "in-station") {
      return <FileExclamationIcon className="h-5 w-5 text-white" />;
    }
    return <Bus className="h-5 w-5 text-white" />;
  };

  const renderVehicleCard = (record: DispatchRecord, status: DisplayStatus, index: number) => {
    const config = columnConfig[status];
    const vehicleStatus = getVehicleStatus(record, status);
    const iconBg = getVehicleIconBg(record, status);

    return (
      <div
        key={record.id}
        className={cn(
          "group relative rounded-2xl cursor-pointer transition-all duration-300",
          "bg-white/90 backdrop-blur-sm border-2 shadow-md",
          "hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1",
          config.borderColor,
          config.glowColor
        )}
        style={{
          animation: `slideUp 0.4s ease-out ${index * 0.05}s backwards`
        }}
        onClick={() => {
          if (status === "in-station") handleAction(record, "permit");
          else if (status === "permit-issued") navigate(`/thanh-toan/${record.id}`);
          else if (status === "paid") handleAction(record, "depart");
        }}
      >
        {/* Status Ribbon */}
        {vehicleStatus && <StatusRibbon type={vehicleStatus} />}

        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "p-3 rounded-xl bg-gradient-to-br shadow-lg",
              iconBg
            )}>
              {renderVehicleIcon(record, status)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-slate-900 text-lg tracking-wide">
                {record.vehiclePlateNumber}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <Timer className="h-3 w-3" />
                <span className="font-mono font-semibold">
                  {formatVietnamDateTime(record.entryTime, "HH:mm")}
                </span>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2 mb-4">
            {(record.seatCount || record.passengersArrived) && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="font-medium">{record.seatCount || record.passengersArrived} chỗ</span>
                </div>
                {record.boardingPermitTime && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                    <FileCheck className="h-3 w-3" />
                    <span className="font-semibold">{formatVietnamDateTime(record.boardingPermitTime, "HH:mm")}</span>
                  </div>
                )}
              </div>
            )}

            {renderElectronicOrderInfo(record, status)}

            {record.driverName && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="h-4 w-4 text-slate-400" />
                <span className="font-medium truncate">{record.driverName}</span>
              </div>
            )}

            {record.routeName && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span className="font-medium truncate">{record.routeName}</span>
              </div>
            )}
          </div>

          {/* Actions - Always visible on mobile, hover on desktop */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {getActionButtons(record, status)}
          </div>
        </div>

        {/* Bottom accent line */}
        <div className={cn(
          "absolute bottom-0 left-4 right-4 h-1 rounded-full bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity",
          config.headerGradient
        )} />
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
      <div className="flex flex-col h-full min-h-0 rounded-3xl overflow-hidden shadow-xl border border-white/50 bg-white/60 backdrop-blur-xl">
        {/* Glass Header */}
        <div className={cn(
          "relative px-5 py-5 bg-gradient-to-r overflow-hidden",
          config.headerGradient
        )}>
          {/* Glass overlay */}
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '20px 20px'
            }} />
          </div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm shadow-inner">
                <Icon className="h-6 w-6 text-white drop-shadow" />
              </div>
              <div>
                <h2 className="font-black text-white text-lg drop-shadow-sm tracking-wide">
                  <span className="hidden lg:inline">{config.title}</span>
                  <span className="lg:hidden">{config.shortTitle}</span>
                </h2>
              </div>
            </div>
            <RadarPulse count={columnRecords.length} color={colorMap[status]} />
          </div>
        </div>

        {/* Content */}
        <div className={cn(
          "flex-1 overflow-y-auto p-4 space-y-4 min-h-0",
          `bg-gradient-to-b ${config.gradient}`
        )}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin" />
                <Radar className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-400 font-medium mt-4">Đang quét...</p>
            </div>
          ) : columnRecords.length === 0 ? (
            <FloatingDotsEmpty message="Không có xe" />
          ) : (
            columnRecords.map((record, index) => renderVehicleCard(record, status, index))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-100 via-slate-50 to-white">
      {/* CSS Animations */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex-shrink-0 px-4 lg:px-6 py-4 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Title & Stats */}
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-4">
              <div className="relative p-3 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
                <Activity className="h-7 w-7 text-white" />
                {/* Pulse indicator */}
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
                </span>
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                  Dispatch Control
                </h1>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="font-semibold">{totalActive} xe hoạt động</span>
                </div>
              </div>
            </div>
            
            {/* Quick stats pills */}
            <div className="hidden lg:flex items-center gap-3 ml-6 pl-6 border-l border-slate-200">
              {(Object.keys(columnConfig) as DisplayStatus[]).map((key) => (
                <div 
                  key={key} 
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl bg-white shadow-sm border border-slate-100",
                    "hover:shadow-md transition-shadow"
                  )}
                >
                  <div className={cn("h-3 w-3 rounded-full", columnConfig[key].dotColor)} />
                  <span className="text-sm font-black text-slate-700 tabular-nums">{stats[key]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 lg:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Tìm biển số, tuyến, tài xế..."
                className="pl-12 h-12 bg-white/80 backdrop-blur border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={loadRecords}
              className="h-12 w-12 rounded-xl border-slate-200 bg-white/80 hover:bg-slate-100"
            >
              <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
            </Button>
            
            <Button
              variant="outline"
              onClick={() => { setDialogType("depart-multiple"); setDialogOpen(true); }}
              className="h-12 gap-2 rounded-xl border-slate-200 bg-white/80 hover:bg-slate-100 hidden sm:flex px-4"
            >
              <ArrowRight className="h-5 w-5" />
              <span className="hidden xl:inline font-semibold">Nhiều xe ra bến</span>
            </Button>
          
            <Button
              onClick={() => { setDialogType("entry"); setSelectedRecord(null); setDialogOpen(true); }}
              className="h-12 gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 px-5"
            >
              <Plus className="h-5 w-5" />
              <span className="hidden sm:inline font-semibold">Vào bến</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden p-4 lg:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 h-full">
          {renderColumn("in-station")}
          {renderColumn("permit-issued")}
          {renderColumn("paid")}
          {renderColumn("departed")}
        </div>
      </div>

      {/* Footer Legend */}
      <div className="flex-shrink-0 px-4 lg:px-6 py-4 border-t border-slate-200/50 bg-white/80 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="p-1.5 rounded-lg bg-slate-100"><Bus className="h-4 w-4" /></div>
              <span className="font-semibold">Tuyến cố định</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="p-1.5 rounded-lg bg-blue-100"><BusPlusIcon className="h-4 w-4 text-blue-600" /></div>
              <span className="font-semibold">Tăng cường</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="p-1.5 rounded-lg bg-violet-100"><ArrowRightLeft className="h-4 w-4 text-violet-600" /></div>
              <span className="font-semibold">Đi thay</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm" />
              <span className="text-sm text-slate-600 font-semibold">Đủ ĐK</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-500 shadow-sm" />
              <span className="text-sm text-slate-600 font-semibold">Thiếu ĐK</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-sky-500 shadow-sm" />
              <span className="text-sm text-slate-600 font-semibold">Trả khách</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500 shadow-sm" />
              <span className="text-sm text-slate-600 font-semibold">Vãng lai</span>
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
