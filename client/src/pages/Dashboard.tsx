import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bus,
  CheckCircle,
  Banknote,
  AlertTriangle,
  History,
  TrendingUp,
  RefreshCw,
  Clock,
  FileWarning,
  Calendar,
  Activity,
  Radio,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentWarningsTable } from "@/components/dashboard/DocumentWarningsTable";
import { EditDocumentDialog } from "@/components/dashboard/EditDocumentDialog";
import { VehicleHistoryTable } from "@/components/dashboard/VehicleHistoryTable";
import {
  LiveBeacon,
  HeroStatsCard,
  MetricCard,
  HeatMapCalendar,
  LiveActivityFeed,
  QuickStatCard,
} from "@/components/dashboard/stats";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { dashboardService } from "@/services/dashboard.service";
import type { DashboardStats, ChartDataPoint, RecentActivity, Warning } from "@/services/dashboard.service";
import { useUIStore } from "@/store/ui.store";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalVehiclesToday: 0,
    vehiclesInStation: 0,
    vehiclesDepartedToday: 0,
    revenueToday: 0,
    invalidVehicles: 0,
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editDocumentOpen, setEditDocumentOpen] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState<Warning | null>(null);
  const [vehicleHistoryOpen, setVehicleHistoryOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const setTitle = useUIStore((state) => state.setTitle);

  useEffect(() => {
    setTitle("Tổng quan");
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [setTitle]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const data = await dashboardService.getDashboardData();
      setStats(data.stats);
      setChartData(data.chartData);
      setRecentActivity(data.recentActivity);
      setWarnings(data.warnings);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      try {
        const [statsData, chartDataData, activityData, warningsData] = await Promise.all([
          dashboardService.getStats().catch(() => null),
          dashboardService.getChartData().catch(() => []),
          dashboardService.getRecentActivity().catch(() => []),
          dashboardService.getWarnings().catch(() => []),
        ]);
        if (statsData) setStats(statsData);
        if (chartDataData.length > 0) setChartData(chartDataData);
        if (activityData.length > 0) setRecentActivity(activityData);
        if (warningsData.length > 0) setWarnings(warningsData);
        setLastUpdated(new Date());
      } catch {
        // Silent fail
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditDocument = (warning: Warning) => {
    setSelectedWarning(warning);
    setEditDocumentOpen(true);
  };

  const handleViewHistory = (warning: Warning) => {
    setSelectedWarning(warning);
    setVehicleHistoryOpen(true);
  };

  const handleSaveDocument = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    loadDashboardData();
  };

  const totalVehiclesToday = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.count, 0);
  }, [chartData]);

  const peakHour = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData.reduce((prev, current) =>
      prev.count > current.count ? prev : current
    );
  }, [chartData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      {/* CSS Animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .animate-shimmer { animation: shimmer 2s infinite; }
        .animate-pulse-subtle { animation: pulse-subtle 2s ease-in-out infinite; }
      `}</style>

      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
                <Activity className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                  Command Center
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-2">
                    <LiveBeacon />
                    <span className="text-sm font-medium text-emerald-600">
                      Trực tiếp
                    </span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(), "EEEE, dd MMMM yyyy", { locale: vi })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600">Cập nhật:</span>
              <span className="text-sm font-mono font-semibold text-slate-900">
                {format(lastUpdated, "HH:mm:ss")}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hover:bg-slate-100"
              onClick={loadDashboardData}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              Làm mới
            </Button>
          </div>
        </div>

        {/* Hero Stats Card */}
        <HeroStatsCard
          total={stats.totalVehiclesToday}
          inStation={stats.vehiclesInStation}
          departed={stats.vehiclesDepartedToday}
          label="TỔNG XE HOẠT ĐỘNG HÔM NAY"
          isLoading={isLoading}
          onViewDetails={() => navigate("/dieu-do")}
        />

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Xe trong bến"
            value={stats.vehiclesInStation}
            icon={Bus}
            variant="blue"
            subtitle="Đang chờ xuất bến"
            trend={{ value: 12, isPositive: true }}
            isLoading={isLoading}
          />
          <MetricCard
            title="Xe đã xuất bến"
            value={stats.vehiclesDepartedToday}
            icon={CheckCircle}
            variant="emerald"
            subtitle="Trong ngày hôm nay"
            trend={{ value: 8, isPositive: true }}
            isLoading={isLoading}
          />
          <MetricCard
            title="Doanh thu"
            value={stats.revenueToday}
            icon={Banknote}
            variant="amber"
            subtitle="VNĐ trong ngày"
            trend={{ value: 15, isPositive: true }}
            isLoading={isLoading}
          />
          <MetricCard
            title="Cần xử lý"
            value={stats.invalidVehicles}
            icon={AlertTriangle}
            variant="rose"
            subtitle="Giấy tờ hết hạn"
            trend={{ value: 0, isPositive: false }}
            isLoading={isLoading}
            isPulsing={stats.invalidVehicles > 0}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Activity Feed */}
          <Card className="lg:col-span-2 border-0 shadow-lg bg-white/80 backdrop-blur">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                    <Radio className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-900">
                      Hoạt động trực tiếp
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      Cập nhật realtime từ bến xe
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100">
                  <LiveBeacon size="small" />
                  <span className="text-xs font-semibold text-slate-600">
                    {recentActivity.length} hoạt động
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <LiveActivityFeed activities={recentActivity} isLoading={isLoading} />
            </CardContent>
          </Card>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Heat Map Calendar */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-900">
                      Biểu đồ nhiệt
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      Tháng {format(new Date(), "MM/yyyy")}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <HeatMapCalendar
                  data={chartData}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Thống kê nhanh
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <QuickStatCard
                  label="Tổng lượt xe"
                  value={totalVehiclesToday}
                  icon={Bus}
                  color="blue"
                />
                {peakHour && (
                  <QuickStatCard
                    label={`Cao điểm (${peakHour.hour})`}
                    value={`${peakHour.count} xe`}
                    icon={TrendingUp}
                    color="emerald"
                  />
                )}
                <QuickStatCard
                  label="Cảnh báo giấy tờ"
                  value={warnings.length}
                  icon={FileWarning}
                  color="rose"
                />

                {/* Quick Actions */}
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => setVehicleHistoryOpen(true)}
                  >
                    <History className="w-4 h-4" />
                    Lịch sử chỉnh sửa
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-11"
                    onClick={loadDashboardData}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Làm mới dữ liệu
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Warnings Table */}
        <DocumentWarningsTable
          warnings={warnings}
          isLoading={isLoading}
          onEditDocument={handleEditDocument}
          onViewHistory={handleViewHistory}
        />
      </div>

      {/* Dialogs */}
      <EditDocumentDialog
        open={editDocumentOpen}
        onOpenChange={setEditDocumentOpen}
        warning={selectedWarning}
        onSave={handleSaveDocument}
      />

      <VehicleHistoryTable
        open={vehicleHistoryOpen}
        onOpenChange={setVehicleHistoryOpen}
      />
    </div>
  );
}
