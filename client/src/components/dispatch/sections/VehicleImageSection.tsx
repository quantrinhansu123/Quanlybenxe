import { Camera } from "lucide-react";
import { GlassCard, SectionHeader } from "@/components/shared/styled-components";

export function VehicleImageSection() {
  return (
    <GlassCard>
      <SectionHeader icon={Camera} title="Ảnh xe vào bến" />
      <div className="p-5">
        <div className="aspect-video rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
          <Camera className="h-10 w-10 text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">Chưa có ảnh</p>
        </div>
      </div>
    </GlassCard>
  );
}
