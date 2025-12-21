import { FileText } from "lucide-react";
import { format } from "date-fns";
import { Autocomplete } from "@/components/ui/autocomplete";
import { DatePicker } from "@/components/DatePicker";
import { GlassCard, SectionHeader, FormField, StyledInput } from "@/components/shared/styled-components";
import type { Route } from "@/types";

interface TransportOrderSectionProps {
  readOnly: boolean;
  transportOrderCode: string;
  setTransportOrderCode: (value: string) => void;
  seatCount: string;
  setSeatCount: (value: string) => void;
  bedCount: string;
  setBedCount: (value: string) => void;
  hhTicketCount: string;
  setHhTicketCount: (value: string) => void;
  hhPercentage: string;
  setHhPercentage: (value: string) => void;
  routeId: string;
  setRouteId: (value: string) => void;
  routes: Route[];
  departureTime: string;
  setDepartureTime: (value: string) => void;
  departureDate: string;
  setDepartureDate: (value: string) => void;
  scheduleId: string;
}

export function TransportOrderSection({
  readOnly,
  transportOrderCode,
  setTransportOrderCode,
  seatCount,
  setSeatCount,
  bedCount,
  setBedCount,
  hhTicketCount,
  setHhTicketCount,
  hhPercentage,
  setHhPercentage,
  routeId,
  setRouteId,
  routes,
  departureTime,
  setDepartureTime,
  departureDate,
  setDepartureDate,
  scheduleId,
}: TransportOrderSectionProps) {
  return (
    <GlassCard>
      <SectionHeader icon={FileText} title="Lệnh vận chuyển" />
      <div className="p-5 space-y-4">
        <FormField label="Mã lệnh vận chuyển" required>
          <StyledInput
            value={transportOrderCode}
            onChange={(e) => setTransportOrderCode(e.target.value)}
            placeholder="Nhập mã lệnh vận chuyển"
            autoComplete="off"
            readOnly={readOnly}
          />
        </FormField>

        <div className="grid grid-cols-4 gap-3">
          <FormField label="Số ghế">
            <StyledInput
              type="number"
              value={seatCount}
              onChange={(e) => setSeatCount(e.target.value)}
              min="0"
              readOnly={readOnly}
            />
          </FormField>
          <FormField label="Số giường">
            <StyledInput
              type="number"
              value={bedCount}
              onChange={(e) => setBedCount(e.target.value)}
              min="0"
              readOnly={readOnly}
            />
          </FormField>
          <FormField label="Số vé HH">
            <StyledInput
              type="number"
              value={hhTicketCount}
              onChange={(e) => setHhTicketCount(e.target.value)}
              min="0"
              readOnly={readOnly}
            />
          </FormField>
          <FormField label="% HH">
            <StyledInput
              type="number"
              value={hhPercentage}
              onChange={(e) => setHhPercentage(e.target.value)}
              min="0"
              max="100"
              readOnly={readOnly}
            />
          </FormField>
        </div>

        <FormField label="Tuyến vận chuyển" required>
          <Autocomplete
            value={routeId}
            onChange={(value) => setRouteId(value)}
            options={routes.map((r) => ({
              value: r.id,
              label: `${r.routeName} (${r.routeCode})${r.distanceKm ? ` - ${r.distanceKm} Km` : ""}`,
            }))}
            placeholder="Gõ để tìm tuyến..."
            disabled={readOnly}
            className="w-full"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Giờ xuất bến khác" required={!scheduleId}>
            <StyledInput
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              readOnly={readOnly}
            />
          </FormField>
          <FormField label="Ngày xuất bến" required>
            <div className="relative">
              <DatePicker
                date={departureDate ? new Date(departureDate) : null}
                onDateChange={(date) => setDepartureDate(date ? format(date, "yyyy-MM-dd") : "")}
                placeholder="Chọn ngày"
                disabled={readOnly}
              />
            </div>
          </FormField>
        </div>
      </div>
    </GlassCard>
  );
}
