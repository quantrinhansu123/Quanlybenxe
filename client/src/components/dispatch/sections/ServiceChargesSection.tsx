import { CreditCard, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GlassCard, SectionHeader } from "@/components/shared/styled-components";
import type { ServiceCharge } from "@/types";

interface ServiceChargesSectionProps {
  readOnly: boolean;
  serviceCharges: ServiceCharge[];
  totalAmount: number;
  serviceDetailsExpanded: boolean;
  setServiceDetailsExpanded: (value: boolean) => void;
  onAddService: () => void;
  recordId?: string;
}

export function ServiceChargesSection({
  readOnly,
  serviceCharges,
  totalAmount,
  serviceDetailsExpanded,
  setServiceDetailsExpanded,
  onAddService,
  recordId,
}: ServiceChargesSectionProps) {
  return (
    <GlassCard>
      <SectionHeader
        icon={CreditCard}
        title="Giá dịch vụ"
        action={
          <Button
            type="button"
            onClick={onAddService}
            disabled={!recordId || readOnly}
            className="h-8 px-3 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border-0 text-xs font-medium transition-all"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Thêm
          </Button>
        }
      />
      <div className="divide-y divide-gray-100">
        {/* Service list header */}
        <div
          className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setServiceDetailsExpanded(!serviceDetailsExpanded)}
        >
          <div className="flex items-center gap-3">
            <Checkbox
              checked={true}
              onChange={() => {}}
              onClick={(e) => e.stopPropagation()}
              disabled={readOnly}
            />
            <ChevronRight
              className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                serviceDetailsExpanded ? "rotate-90" : ""
              }`}
            />
            <span className="text-sm text-gray-600">Dịch vụ chuyến đi</span>
          </div>
          <span className="text-sm font-semibold text-gray-800">
            {totalAmount.toLocaleString("vi-VN")} ₫
          </span>
        </div>

        {/* Service details */}
        {serviceDetailsExpanded && (
          <div className="bg-gray-50/50">
            {serviceCharges.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CreditCard className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Chưa có dịch vụ</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {serviceCharges.map((charge) => (
                  <div key={charge.id} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-gray-600">
                      {charge.serviceType?.name || "Dịch vụ"}
                    </span>
                    <span className="text-sm text-gray-700">
                      {charge.totalAmount.toLocaleString("vi-VN")} ₫
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-50 to-cyan-50">
          <span className="text-sm font-semibold text-gray-700">Tổng tiền</span>
          <span className="text-lg font-bold text-blue-600">
            {totalAmount.toLocaleString("vi-VN")} ₫
          </span>
        </div>
      </div>
    </GlassCard>
  );
}
