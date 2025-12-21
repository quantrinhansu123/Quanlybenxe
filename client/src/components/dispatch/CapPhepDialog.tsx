import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FileText } from "lucide-react";
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
  PermitActions,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleClose}>
      {/* Light background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-gray-50 to-blue-50">
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
                            radial-gradient(circle at 75% 75%, rgba(16, 185, 129, 0.05) 0%, transparent 50%)`
        }} />
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
          {hook.isInitialLoading && (
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

          {!hook.isInitialLoading && (
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
                <PermitActions
                  readOnly={readOnly}
                  isLoading={hook.isLoading}
                  onClose={handleClose}
                  onNotEligible={() => setNotEligibleDialogOpen(true)}
                  onEligible={hook.handleEligible}
                />
              </div>

              {/* Main grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN */}
                <div className="space-y-6">
                  <VehicleInfoSection
                    record={record}
                    readOnly={readOnly}
                    permitType={hook.permitType}
                    setPermitType={hook.setPermitType}
                    registeredPlateNumber={hook.registeredPlateNumber}
                    setRegisteredPlateNumber={hook.setRegisteredPlateNumber}
                    selectedVehicle={hook.selectedVehicle}
                    vehicleBadges={hook.vehicleBadges}
                    replacementVehicleId={hook.replacementVehicleId}
                    setReplacementVehicleId={hook.setReplacementVehicleId}
                    entryPlateNumber={hook.entryPlateNumber}
                    setEntryPlateNumber={hook.setEntryPlateNumber}
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
                  <MonthlyCalendarHeatmap
                    departureDate={hook.departureDate}
                    dailyTripCounts={hook.dailyTripCounts}
                  />
                </div>

                {/* MIDDLE COLUMN */}
                <div className="space-y-6">
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
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                  <VehicleImageSection />
                  <DocumentCheckCards
                    documents={hook.getDocumentsCheckResults()}
                    isValid={overallStatus.isValid}
                    validCount={overallStatus.validCount}
                    totalCount={overallStatus.totalCount}
                    onEdit={() => setDocumentDialogOpen(true)}
                  />
                  <GsgtCheckSection />
                  <NotesSection />
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
      </div>
    </div>,
    document.body
  );
}
