import { createPortal } from "react-dom";
import { CapPhepDialog } from "./CapPhepDialog";
import { FormHeader, VehicleEntryForm, TransportOrderPreview } from "./entry";
import { useChoXeVaoBenForm } from "@/hooks/useChoXeVaoBenForm";
import type { DispatchRecord } from "@/types";

interface ChoXeVaoBenDialogProps {
  vehicleOptions: Array<{ id: string; plateNumber: string }>;
  onClose: () => void;
  onSuccess?: () => void;
  open?: boolean;
  editRecord?: DispatchRecord | null;
}

export function ChoXeVaoBenDialog({
  vehicleOptions,
  onClose,
  onSuccess,
  open = true,
  editRecord = null,
}: ChoXeVaoBenDialogProps) {
  const {
    isEditMode,
    vehicleId,
    entryDateTime,
    setEntryDateTime,
    performPermitAfterEntry,
    setPerformPermitAfterEntry,
    confirmPassengerDrop,
    scheduleId,
    setScheduleId,
    passengersArrived,
    setPassengersArrived,
    routeId,
    setRouteId,
    transportOrderCode,
    setTransportOrderCode,
    signAndTransmit,
    setSignAndTransmit,
    printDisplay,
    setPrintDisplay,
    routes,
    schedules,
    transportOrderDisplay,
    isLoading,
    isAnimating,
    showPermitDialog,
    permitDispatchRecord,
    handleVehicleSelect,
    handleRefreshTransportOrder,
    handleConfirmPassengerDropChange,
    handleSubmit,
    handleClose,
    handlePermitDialogClose,
  } = useChoXeVaoBenForm({ open, editRecord, onSuccess, onClose });

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
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormHeader
              isEditMode={isEditMode}
              isLoading={isLoading}
              performPermitAfterEntry={performPermitAfterEntry}
              onPerformPermitChange={setPerformPermitAfterEntry}
              onClose={handleClose}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <VehicleEntryForm
                vehicleOptions={vehicleOptions}
                vehicleId={vehicleId}
                editRecordPlateNumber={editRecord?.vehiclePlateNumber}
                entryDateTime={entryDateTime}
                confirmPassengerDrop={confirmPassengerDrop}
                routeId={routeId}
                scheduleId={scheduleId}
                passengersArrived={passengersArrived}
                transportOrderCode={transportOrderCode}
                routes={routes}
                schedules={schedules}
                onVehicleSelect={handleVehicleSelect}
                onEntryDateTimeChange={setEntryDateTime}
                onConfirmPassengerDropChange={handleConfirmPassengerDropChange}
                onRouteChange={setRouteId}
                onScheduleChange={setScheduleId}
                onPassengersArrivedChange={setPassengersArrived}
                onTransportOrderCodeChange={setTransportOrderCode}
                onRefreshTransportOrder={handleRefreshTransportOrder}
              />

              <TransportOrderPreview
                signAndTransmit={signAndTransmit}
                printDisplay={printDisplay}
                transportOrderDisplay={transportOrderDisplay}
                onSignAndTransmitChange={setSignAndTransmit}
                onPrintDisplayChange={setPrintDisplay}
              />
            </div>
          </form>
        </div>
      </div>

      {showPermitDialog && permitDispatchRecord && (
        <CapPhepDialog
          record={permitDispatchRecord}
          open={showPermitDialog}
          onClose={handlePermitDialogClose}
          onSuccess={handlePermitDialogClose}
        />
      )}
    </div>,
    document.body
  );
}
