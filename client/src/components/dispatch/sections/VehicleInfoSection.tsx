import { Truck, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { formatVietnamTime } from "@/utils/timezone";
import { Select } from "@/components/ui/select";
import { Autocomplete } from "@/components/ui/autocomplete";
import { GlassCard, SectionHeader, FormField, StyledInput, StyledSelect } from "@/components/shared/styled-components";
import type { DispatchRecord, Schedule, Vehicle, Operator } from "@/types";

interface VehicleInfoSectionProps {
  record: DispatchRecord;
  readOnly: boolean;
  permitType: string;
  setPermitType: (value: string) => void;
  selectedVehicle: Vehicle | null;
  vehiclesWithStatus: (Vehicle & { isBusy: boolean })[];
  replacementVehicleId: string;
  setReplacementVehicleId: (value: string) => void;
  operatorNameFromVehicle: string;
  selectedOperatorId: string;
  setSelectedOperatorId: (value: string) => void;
  operators: Operator[];
  scheduleId: string;
  setScheduleId: (value: string) => void;
  routeId: string;
  schedules: Schedule[];
  departureTime: string;
}

export function VehicleInfoSection({
  record,
  readOnly,
  permitType,
  setPermitType,
  selectedVehicle,
  vehiclesWithStatus,
  replacementVehicleId,
  setReplacementVehicleId,
  operatorNameFromVehicle,
  selectedOperatorId,
  setSelectedOperatorId,
  operators,
  scheduleId,
  setScheduleId,
  routeId,
  schedules,
  departureTime,
}: VehicleInfoSectionProps) {
  return (
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
          <FormField label="Biển số vào bến">
            <StyledInput
              value={record.vehiclePlateNumber || "---"}
              readOnly
              className="bg-gray-100 cursor-not-allowed font-medium"
            />
            <span className="text-xs text-gray-500 mt-1 block">
              Để sửa biển số, vui lòng edit Entry
            </span>
          </FormField>
          <FormField label="Xe đi thay">
            <Autocomplete
              value={replacementVehicleId}
              onChange={(value) => setReplacementVehicleId(value)}
              options={vehiclesWithStatus
                .filter(v => v.plateNumber && v.id !== selectedVehicle?.id)
                .map(v => ({
                  value: v.id,
                  label: `${v.plateNumber} ${v.isBusy ? '(Đang bận)' : '(Sẵn sàng)'}`
                }))}
              placeholder="Chọn hoặc nhập biển số xe thay thế"
              disabled={readOnly}
              className="bg-gray-50 border-gray-200 rounded-xl"
            />
            {replacementVehicleId && (() => {
              const selectedReplacement = vehiclesWithStatus.find(v => v.id === replacementVehicleId);
              if (selectedReplacement?.isBusy) {
                return (
                  <div className="flex items-center gap-1.5 mt-2 text-amber-600 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Xe đang bận (có dispatch chưa hoàn thành)</span>
                  </div>
                );
              }
              if (selectedReplacement) {
                return (
                  <div className="flex items-center gap-1.5 mt-2 text-emerald-600 text-xs">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Xe sẵn sàng</span>
                  </div>
                );
              }
              return null;
            })()}
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
              value={formatVietnamTime(record.entryTime, "HH:mm dd/MM/yyyy")}
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
  );
}
