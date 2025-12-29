import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FileText, X, XCircle, CheckCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useCapPhepDialog } from "@/hooks/useCapPhepDialog";
import {
  VehicleInfoSection,
  DriverSection,
  MonthlyCalendarHeatmap,
  TransportOrderSection,
  ServiceChargesSection,
  DocumentCheckCards,
  VehicleImageSection,
  GsgtCheckSection,
  NotesSection,
  ZeroAmountWarningDialog,
} from "./sections";
import { KiemTraGiayToDialog } from "./KiemTraGiayToDialog";
import { LyDoKhongDuDieuKienDialog } from "./LyDoKhongDuDieuKienDialog";
import { ThemDichVuDialog } from "./ThemDichVuDialog";
import { ThemTaiXeDialog } from "./ThemTaiXeDialog";
import type { DispatchRecord } from "@/types";

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
  const [isAnimating, setIsAnimating] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [notEligibleDialogOpen, setNotEligibleDialogOpen] = useState(false);
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false);
  const [addDriverDialogOpen, setAddDriverDialogOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const hook = useCapPhepDialog(record, onClose, onSuccess);

  useEffect(() => {
    if (open) {
      setIsAnimating(true);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [open]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  const handleNotEligibleConfirm = async (
    selectedReasons: string[],
    options: { createOrder: boolean; signAndTransmit: boolean; printDisplay: boolean }
  ) => {
    await hook.handleNotEligibleConfirm(selectedReasons, options);
    setNotEligibleDialogOpen(false);
  };

  if (!open) return null;

  const overallStatus = hook.getOverallStatus();

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col" onClick={handleClose}>
      {/* Clean background */}
      <div className="absolute inset-0 bg-gray-50" />

      {/* STICKY HEADER */}
      <div 
        className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Title & Info */}
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-blue-600">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {readOnly ? "Xem Cấp phép" : "Cấp phép lên nốt"}
                </h1>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-semibold text-blue-600">{record.vehiclePlateNumber || "---"}</span>
                  {record.entryTime && (
                    <span className="text-gray-500">
                      Vào bến: {format(new Date(record.entryTime), "HH:mm dd/MM")}
                    </span>
                  )}
                  {/* Pre-flight status inline */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                    overallStatus.isValid 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-rose-100 text-rose-700'
                  }`}>
                    {overallStatus.isValid ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {overallStatus.validCount}/{overallStatus.totalCount} ĐK
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleClose}
                disabled={hook.isLoading}
                className="h-9 px-4 rounded-lg border border-gray-300 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                <X className="h-4 w-4 inline mr-1" />
                {readOnly ? "Đóng" : "Hủy"}
              </button>
              {!readOnly && (
                <>
                  <button
                    onClick={() => setNotEligibleDialogOpen(true)}
                    disabled={hook.isLoading}
                    className="h-9 px-4 rounded-lg bg-rose-500 text-white font-medium text-sm hover:bg-rose-600 transition-colors"
                  >
                    <XCircle className="h-4 w-4 inline mr-1" />
                    Không đủ ĐK
                  </button>
                  <button
                    onClick={hook.handleEligible}
                    disabled={hook.isLoading}
                    className="h-10 px-6 rounded-lg bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30"
                  >
                    <CheckCircle className="h-4 w-4 inline mr-1" />
                    Đủ điều kiện
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT - Scrollable */}
      <div
        className={`flex-1 overflow-y-auto transition-all duration-300 ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-4">
          {/* Loading state */}
          {hook.isInitialLoading && (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="text-center">
                <div className="relative w-12 h-12 mx-auto mb-3">
                  <div className="absolute inset-0 rounded-full border-3 border-gray-200" />
                  <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-blue-500 animate-spin" />
                </div>
                <p className="text-gray-500 text-sm">Đang tải...</p>
              </div>
            </div>
          )}

          {!hook.isInitialLoading && (
            <div className="grid grid-cols-12 gap-4">
              {/* COLUMN 1: Vehicle, Driver, Documents (4 cols) */}
              <div className="col-span-12 lg:col-span-4 space-y-4">
                <VehicleInfoSection
                  record={record}
                  readOnly={readOnly}
                  permitType={hook.permitType}
                  setPermitType={hook.setPermitType}
                  selectedVehicle={hook.selectedVehicle}
                  vehiclesWithStatus={hook.vehiclesWithStatus}
                  replacementVehicleId={hook.replacementVehicleId}
                  setReplacementVehicleId={hook.setReplacementVehicleId}
                  operatorNameFromVehicle={hook.operatorNameFromVehicle}
                  selectedOperatorId={hook.selectedOperatorId}
                  setSelectedOperatorId={hook.setSelectedOperatorId}
                  operators={hook.operators}
                  scheduleId={hook.scheduleId}
                  setScheduleId={hook.setScheduleId}
                  routeId={hook.routeId}
                  schedules={hook.schedules}
                  departureTime={hook.departureTime}
                />
                <DriverSection
                  drivers={hook.drivers}
                  readOnly={readOnly}
                  onAddDriver={() => setAddDriverDialogOpen(true)}
                />
                <DocumentCheckCards
                  documents={hook.getDocumentsCheckResults()}
                  isValid={overallStatus.isValid}
                  validCount={overallStatus.validCount}
                  totalCount={overallStatus.totalCount}
                  onEdit={() => setDocumentDialogOpen(true)}
                />
              </div>

              {/* COLUMN 2: Transport Order & Services (4 cols) */}
              <div className="col-span-12 lg:col-span-4 space-y-4">
                <TransportOrderSection
                  readOnly={readOnly}
                  transportOrderCode={hook.transportOrderCode}
                  setTransportOrderCode={hook.setTransportOrderCode}
                  seatCount={hook.seatCount}
                  setSeatCount={hook.setSeatCount}
                  bedCount={hook.bedCount}
                  setBedCount={hook.setBedCount}
                  hhTicketCount={hook.hhTicketCount}
                  setHhTicketCount={hook.setHhTicketCount}
                  hhPercentage={hook.hhPercentage}
                  setHhPercentage={hook.setHhPercentage}
                  routeId={hook.routeId}
                  setRouteId={hook.setRouteId}
                  routes={hook.routes}
                  departureTime={hook.departureTime}
                  setDepartureTime={hook.setDepartureTime}
                  departureDate={hook.departureDate}
                  setDepartureDate={hook.setDepartureDate}
                  scheduleId={hook.scheduleId}
                  validationErrors={hook.validationErrors}
                />
                <ServiceChargesSection
                  readOnly={readOnly}
                  serviceCharges={hook.serviceCharges}
                  totalAmount={hook.totalAmount}
                  serviceDetailsExpanded={hook.serviceDetailsExpanded}
                  setServiceDetailsExpanded={hook.setServiceDetailsExpanded}
                  onAddService={() => setAddServiceDialogOpen(true)}
                  recordId={record.id}
                />
                <GsgtCheckSection />
              </div>

              {/* COLUMN 3: Images, Notes, Calendar (4 cols) */}
              <div className="col-span-12 lg:col-span-4 space-y-4">
                <VehicleImageSection
                  vehicleImageUrl={hook.selectedVehicle?.imageUrl}
                  entryImageUrl={record.entryImageUrl}
                  dispatchId={record.id}
                />
                <NotesSection />
                {/* Calendar Toggle */}
                <button
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Lịch hoạt động tháng
                  </span>
                  <span className="text-xs text-gray-400">{showCalendar ? "Ẩn" : "Hiện"}</span>
                </button>
                {showCalendar && (
                  <MonthlyCalendarHeatmap
                    departureDate={hook.departureDate}
                    dailyTripCounts={hook.dailyTripCounts}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {record.vehicleId && (
        <KiemTraGiayToDialog
          vehicleId={record.vehicleId}
          open={documentDialogOpen}
          onClose={() => setDocumentDialogOpen(false)}
          onSuccess={hook.handleDocumentDialogSuccess}
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
          onSuccess={hook.handleAddServiceSuccess}
        />
      )}
      <ThemTaiXeDialog
        operatorId={hook.selectedOperatorId || undefined}
        open={addDriverDialogOpen}
        onClose={() => setAddDriverDialogOpen(false)}
        onSuccess={hook.handleAddDriverSuccess}
      />
      <ZeroAmountWarningDialog
        open={hook.showZeroAmountConfirm}
        onClose={() => hook.setShowZeroAmountConfirm(false)}
        onConfirm={() => {
          hook.setShowZeroAmountConfirm(false);
          hook.submitPermit();
        }}
      />
    </div>,
    document.body
  );
}
