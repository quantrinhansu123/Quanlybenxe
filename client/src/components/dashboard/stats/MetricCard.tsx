import { memo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { LiveBeacon } from "./LiveBeacon";

export interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  variant: "blue" | "emerald" | "amber" | "rose";
  subtitle?: string;
  isLoading?: boolean;
  isPulsing?: boolean;
}

export const metricVariants = {
  blue: {
    gradient: "from-blue-500 to-indigo-600",
    glow: "shadow-blue-500/25",
    light: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    iconBg: "bg-blue-100",
  },
  emerald: {
    gradient: "from-emerald-500 to-teal-600",
    glow: "shadow-emerald-500/25",
    light: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    iconBg: "bg-emerald-100",
  },
  amber: {
    gradient: "from-amber-500 to-orange-600",
    glow: "shadow-amber-500/25",
    light: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    iconBg: "bg-amber-100",
  },
  rose: {
    gradient: "from-rose-500 to-red-600",
    glow: "shadow-rose-500/25",
    light: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    iconBg: "bg-rose-100",
  },
};

export const MetricCard = memo(function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  variant,
  subtitle,
  isLoading,
  isPulsing,
}: MetricCardProps) {
  const styles = metricVariants[variant];
  const animatedValue = useAnimatedCounter(isLoading ? 0 : value, 1200);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl transition-all duration-500",
        "hover:scale-[1.02] hover:-translate-y-1",
        isPulsing && "animate-pulse-subtle"
      )}
    >
      {/* Glass Background */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-5",
          styles.gradient
        )}
      />

      {/* Card Content */}
      <div
        className={cn(
          "relative p-4 bg-white/80 backdrop-blur-xl border-2 rounded-2xl",
          "shadow-lg hover:shadow-xl transition-shadow",
          styles.border,
          isPulsing && styles.glow
        )}
      >
        {/* Header: Icon + Badge */}
        <div className="flex items-center justify-between mb-2">
          <div
            className={cn(
              "p-2 rounded-lg",
              `bg-gradient-to-br ${styles.gradient}`,
              "shadow-md",
              styles.glow
            )}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          {isPulsing && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100">
              <LiveBeacon size="small" />
              <span className="text-xs font-semibold text-rose-600">
                Cần xử lý
              </span>
            </div>
          )}
        </div>

        {/* Title + Value + Subtitle inline */}
        <p className="text-xs font-medium text-slate-500 mb-0.5">{title}</p>
        <p
          className={cn(
            "text-3xl font-black tracking-tight leading-tight",
            styles.text
          )}
        >
          {animatedValue.toLocaleString("vi-VN")}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        )}

        {/* Trend - compact */}
        {trend && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold",
                trend.isPositive
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700"
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </span>
            <span className="text-xs text-slate-400">vs hôm qua</span>
          </div>
        )}

        {/* Hover Decoration */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity",
            styles.gradient
          )}
        />
      </div>
    </div>
  );
});
