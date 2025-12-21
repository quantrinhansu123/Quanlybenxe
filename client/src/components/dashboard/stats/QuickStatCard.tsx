import { cn } from "@/lib/utils";

interface QuickStatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: "blue" | "emerald" | "amber" | "rose";
}

const colorStyles = {
  blue: "from-blue-500 to-indigo-600 shadow-blue-500/20",
  emerald: "from-emerald-500 to-teal-600 shadow-emerald-500/20",
  amber: "from-amber-500 to-orange-600 shadow-amber-500/20",
  rose: "from-rose-500 to-red-600 shadow-rose-500/20",
};

export function QuickStatCard({ label, value, icon: Icon, color }: QuickStatCardProps) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors">
      <div
        className={cn(
          "p-2.5 rounded-lg bg-gradient-to-br text-white shadow-lg",
          colorStyles[color]
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
