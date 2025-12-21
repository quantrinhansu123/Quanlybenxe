import { Gauge, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { LiveBeacon } from "./LiveBeacon";

interface HeroStatsCardProps {
  total: number;
  inStation: number;
  departed: number;
  label: string;
  isLoading: boolean;
  onViewDetails: () => void;
}

export function HeroStatsCard({
  total,
  inStation,
  departed,
  label,
  isLoading,
  onViewDetails,
}: HeroStatsCardProps) {
  const animatedTotal = useAnimatedCounter(isLoading ? 0 : total, 2000);
  const animatedInStation = useAnimatedCounter(isLoading ? 0 : inStation, 2000);
  const animatedDeparted = useAnimatedCounter(isLoading ? 0 : departed, 2000);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-2xl">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/30">
              <Gauge className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{label}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <LiveBeacon size="small" />
                <span className="text-xs text-emerald-400 font-medium">
                  Đang hoạt động
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black text-white tracking-tight">
              {animatedTotal}
              <span className="text-lg text-slate-400 font-medium ml-1">
                lượt
              </span>
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <div>
                <p className="text-slate-400 text-xs">Trong bến</p>
                <p className="text-xl font-bold text-white">
                  {animatedInStation}
                </p>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <p className="text-slate-400 text-xs">Đã xuất bến</p>
                <p className="text-xl font-bold text-emerald-400">
                  {animatedDeparted}
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            className="text-slate-300 hover:text-white hover:bg-slate-700/50 gap-1 text-sm"
            onClick={onViewDetails}
          >
            Xem chi tiết
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
