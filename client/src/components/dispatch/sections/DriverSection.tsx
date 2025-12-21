import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, SectionHeader } from "@/components/shared/styled-components";
import type { Driver } from "@/types";

interface DriverSectionProps {
  drivers: Driver[];
  readOnly: boolean;
  onAddDriver: () => void;
}

export function DriverSection({ drivers, readOnly, onAddDriver }: DriverSectionProps) {
  return (
    <GlassCard>
      <SectionHeader
        icon={Users}
        title="Lái xe"
        action={
          <Button
            type="button"
            onClick={onAddDriver}
            disabled={readOnly}
            className="h-8 px-3 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border-0 text-xs font-medium transition-all"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Thêm
          </Button>
        }
      />
      <div className="p-5">
        {drivers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Chưa có lái xe</p>
          </div>
        ) : (
          <div className="space-y-2">
            {drivers.map((driver) => (
              <div
                key={driver.id}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm">
                    <span className="text-sm font-semibold text-white">
                      {driver.fullName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{driver.fullName}</p>
                    <p className="text-xs text-gray-500">{driver.phone || "Chưa có SĐT"}</p>
                  </div>
                </div>
                <span className="px-2 py-1 text-xs font-medium rounded-lg bg-gray-200 text-gray-600">
                  {driver.licenseClass}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
