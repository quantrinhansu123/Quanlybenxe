import { memo } from "react";
import { Bus, MapPin, User, Users, FileCheck, RefreshCw, Zap, XCircle, Timer, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatVietnamDateTime } from "@/lib/vietnam-time";
import { columnConfig, type DisplayStatus } from "./column-config";
import { StatusRibbon } from "./StatusRibbon";
import { BusPlusIcon, FileExclamationIcon } from "@/components/dispatch/icons";
import type { DispatchRecord } from "@/types";

interface VehicleCardProps {
  record: DispatchRecord;
  status: DisplayStatus;
  index: number;
  vehicleStatus: 'eligible' | 'ineligible' | 'returned' | 'irregular' | null;
  onClick: () => void;
  actionButtons: React.ReactNode;
}

export const VehicleCard = memo(function VehicleCard({ record, status, index, vehicleStatus, onClick, actionButtons }: VehicleCardProps) {
  const config = columnConfig[status];
  const iconBg = getVehicleIconBg(record, status);

  return (
    <div
      className={cn(
        "group relative rounded-2xl cursor-pointer transition-all duration-300",
        "bg-white/90 backdrop-blur-sm border-2 shadow-md",
        "hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1",
        config.borderColor,
        config.glowColor
      )}
      style={{ animation: `slideUp 0.4s ease-out ${index * 0.05}s backwards` }}
      onClick={onClick}
    >
      {vehicleStatus && <StatusRibbon type={vehicleStatus} />}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={cn("p-3 rounded-xl bg-gradient-to-br shadow-lg", iconBg)}>
            {renderVehicleIcon(record, status)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-900 text-lg tracking-wide">{record.vehiclePlateNumber}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <Timer className="h-3 w-3" />
              <span className="font-mono font-semibold">{formatVietnamDateTime(record.entryTime, "HH:mm")}</span>
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          {actionButtons}
        </div>
      </div>

      {/* Bottom accent line */}
      <div className={cn(
        "absolute bottom-0 left-4 right-4 h-1 rounded-full bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity",
        config.headerGradient
      )} />
    </div>
  );
});

function getVehicleIconBg(record: DispatchRecord, status: DisplayStatus) {
  if (record.metadata?.type === "irregular") return "from-amber-500 to-orange-600";
  if (record.currentStatus === "passengers_dropped") return "from-sky-500 to-blue-600";
  if (record.permitStatus === "rejected" || (status === "paid" && !record.permitStatus)) return "from-rose-500 to-red-600";
  if (record.permitStatus === "approved") return "from-emerald-500 to-teal-600";
  return columnConfig[status].iconBg.replace('bg-gradient-to-br ', '');
}

function renderVehicleIcon(record: DispatchRecord, status: DisplayStatus) {
  const type = record.metadata?.type;
  if (type === "augmented") return <BusPlusIcon className="h-5 w-5 text-white" />;
  if (type === "replacement") return <ArrowRightLeft className="h-5 w-5 text-white" />;
  if (!record.scheduleId && type !== "irregular" && status === "in-station") {
    return <FileExclamationIcon className="h-5 w-5 text-white" />;
  }
  return <Bus className="h-5 w-5 text-white" />;
}

function renderElectronicOrderInfo(record: DispatchRecord, status: DisplayStatus) {
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
}
