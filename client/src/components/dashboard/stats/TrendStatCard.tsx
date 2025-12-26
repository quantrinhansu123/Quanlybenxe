import { memo } from "react";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";

export interface TrendStatCardProps {
  /** Category label displayed as colored pill */
  category: string;
  /** Color theme for category pill */
  categoryColor: "orange" | "green" | "blue" | "rose" | "purple" | "amber";
  /** Main value to display */
  value: number | string;
  /** Subtitle description */
  subtitle: string;
  /** Trend indicator */
  trend?: {
    direction: "up" | "down" | "attention";
    value: string;
    description: string;
  };
  /** Loading state */
  isLoading?: boolean;
  /** Format value as currency VND */
  isCurrency?: boolean;
}

const categoryColors = {
  orange: "bg-orange-100 text-orange-600",
  green: "bg-emerald-100 text-emerald-600",
  blue: "bg-blue-100 text-blue-600",
  rose: "bg-rose-100 text-rose-600",
  purple: "bg-purple-100 text-purple-600",
  amber: "bg-amber-100 text-amber-600",
};

const trendColors = {
  up: "text-emerald-600",
  down: "text-rose-600",
  attention: "text-amber-600",
};

const TrendIcon = ({ direction }: { direction: "up" | "down" | "attention" }) => {
  switch (direction) {
    case "up":
      return <TrendingUp className="w-3.5 h-3.5" />;
    case "down":
      return <TrendingDown className="w-3.5 h-3.5" />;
    case "attention":
      return <AlertCircle className="w-3.5 h-3.5" />;
  }
};

export const TrendStatCard = memo(function TrendStatCard({
  category,
  categoryColor,
  value,
  subtitle,
  trend,
  isLoading,
  isCurrency,
}: TrendStatCardProps) {
  const numericValue = typeof value === "number" ? value : 0;
  const animatedValue = useAnimatedCounter(isLoading ? 0 : numericValue, 1200);

  const formatValue = (val: number) => {
    if (isCurrency) {
      return new Intl.NumberFormat("vi-VN").format(val);
    }
    return val.toLocaleString("vi-VN");
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      {/* Category Pill */}
      <div className="mb-3">
        <span
          className={cn(
            "inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide",
            categoryColors[categoryColor]
          )}
        >
          {category}
        </span>
      </div>

      {/* Value */}
      <div className="mb-1">
        {isLoading ? (
          <div className="h-8 w-20 bg-stone-200 rounded animate-pulse" />
        ) : (
          <p className="text-[28px] font-bold text-stone-900 leading-tight">
            {typeof value === "string" ? value : formatValue(animatedValue)}
          </p>
        )}
      </div>

      {/* Subtitle */}
      <p className="text-[13px] text-stone-500 mb-4">{subtitle}</p>

      {/* Trend Indicator */}
      {trend && (
        <div
          className={cn(
            "flex items-center gap-1.5 text-[13px] font-medium",
            trendColors[trend.direction]
          )}
        >
          <TrendIcon direction={trend.direction} />
          <span>{trend.value}</span>
          <span className="text-stone-400 font-normal">{trend.description}</span>
        </div>
      )}
    </div>
  );
});
