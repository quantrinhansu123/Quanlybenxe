import { useState, useEffect, useMemo } from "react"
import { 
  Bus, 
  CheckCircle, 
  Banknote, 
  AlertTriangle, 
  History, 
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Clock,
  MapPin,
  FileWarning,
  Calendar,
  Activity,
  Zap
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DocumentWarningsTable } from "@/components/dashboard/DocumentWarningsTable"
import { EditDocumentDialog } from "@/components/dashboard/EditDocumentDialog"
import { VehicleHistoryTable } from "@/components/dashboard/VehicleHistoryTable"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { dashboardService } from "@/services/dashboard.service"
import type { DashboardStats, ChartDataPoint, RecentActivity, Warning } from "@/services/dashboard.service"
import { useUIStore } from "@/store/ui.store"
import { cn } from "@/lib/utils"

// Animated counter hook
function useAnimatedCounter(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0)
  
  useEffect(() => {
    if (end === 0) {
      setCount(0)
      return
    }
    
    let startTime: number | null = null
    const startValue = 0
    
    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(startValue + (end - startValue) * easeOutQuart))
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    requestAnimationFrame(animate)
  }, [end, duration])
  
  return count
}

// Live indicator component
function LiveIndicator() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
      </span>
      <span className="text-xs font-medium text-emerald-600">Trực tiếp</span>
    </div>
  )
}

// Stat card with modern design
interface ModernStatCardProps {
  title: string
  value: number
  suffix?: string
  icon: React.ElementType
  trend?: { value: number; isPositive: boolean }
  variant: 'primary' | 'success' | 'warning' | 'danger'
  subtitle?: string
  animate?: boolean
}

const variantStyles = {
  primary: {
    card: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    icon: 'bg-white/20 text-white',
    text: 'text-white',
    subtext: 'text-blue-100',
    trend: 'bg-white/20 text-white'
  },
  success: {
    card: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    icon: 'bg-white/20 text-white',
    text: 'text-white',
    subtext: 'text-emerald-100',
    trend: 'bg-white/20 text-white'
  },
  warning: {
    card: 'bg-gradient-to-br from-amber-500 to-orange-600',
    icon: 'bg-white/20 text-white',
    text: 'text-white',
    subtext: 'text-amber-100',
    trend: 'bg-white/20 text-white'
  },
  danger: {
    card: 'bg-gradient-to-br from-rose-500 to-red-600',
    icon: 'bg-white/20 text-white',
    text: 'text-white',
    subtext: 'text-rose-100',
    trend: 'bg-white/20 text-white'
  }
}

function ModernStatCard({ 
  title, 
  value, 
  suffix = '',
  icon: Icon, 
  trend, 
  variant,
  subtitle,
  animate = true
}: ModernStatCardProps) {
  const styles = variantStyles[variant]
  const animatedValue = useAnimatedCounter(animate ? value : 0, 1200)
  const displayValue = animate ? animatedValue : value
  
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-6 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02]",
      styles.card
    )}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-20 w-20 rounded-full bg-black/10 blur-xl" />
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <p className={cn("text-sm font-medium opacity-90", styles.subtext)}>{title}</p>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-4xl font-bold tracking-tight", styles.text)}>
                {displayValue.toLocaleString('vi-VN')}
              </span>
              {suffix && (
                <span className={cn("text-lg font-medium", styles.subtext)}>{suffix}</span>
              )}
            </div>
            {subtitle && (
              <p className={cn("text-xs", styles.subtext)}>{subtitle}</p>
            )}
          </div>
          <div className={cn("p-3 rounded-xl", styles.icon)}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        
        {trend && (
          <div className="mt-4 flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              styles.trend
            )}>
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
            <span className={cn("text-xs", styles.subtext)}>so với hôm qua</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Quick action button
interface QuickActionProps {
  icon: React.ElementType
  label: string
  onClick?: () => void
  variant?: 'default' | 'primary'
}

function QuickAction({ icon: Icon, label, onClick, variant = 'default' }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
        "hover:scale-[1.02] active:scale-[0.98]",
        variant === 'primary' 
          ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium text-sm">{label}</span>
    </button>
  )
}

// Status indicator for recent activity
function getStatusConfig(status: string) {
  const configs: Record<string, { color: string; bg: string; label: string }> = {
    'entered': { color: 'text-blue-700', bg: 'bg-blue-100', label: 'Vào bến' },
    'passengers_dropped': { color: 'text-purple-700', bg: 'bg-purple-100', label: 'Trả khách' },
    'permit_issued': { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Đã cấp nốt' },
    'paid': { color: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Đã thanh toán' },
    'departure_ordered': { color: 'text-cyan-700', bg: 'bg-cyan-100', label: 'Lệnh xuất bến' },
    'departed': { color: 'text-gray-700', bg: 'bg-gray-100', label: 'Đã xuất bến' },
  }
  return configs[status] || { color: 'text-gray-700', bg: 'bg-gray-100', label: status }
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    vehiclesInStation: 0,
    vehiclesDepartedToday: 0,
    revenueToday: 0,
    invalidVehicles: 0,
  })
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editDocumentOpen, setEditDocumentOpen] = useState(false)
  const [selectedWarning, setSelectedWarning] = useState<Warning | null>(null)
  const [vehicleHistoryOpen, setVehicleHistoryOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Tổng quan")
    loadDashboardData()
    
    // Auto refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000)
    return () => clearInterval(interval)
  }, [setTitle])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      const data = await dashboardService.getDashboardData()
      setStats(data.stats)
      setChartData(data.chartData)
      setRecentActivity(data.recentActivity)
      setWarnings(data.warnings)
      setLastUpdated(new Date())
    } catch (error) {
      console.error("Failed to load dashboard data:", error)
      // Fallback to individual calls
      try {
        const [statsData, chartDataData, activityData, warningsData] = await Promise.all([
          dashboardService.getStats().catch(() => null),
          dashboardService.getChartData().catch(() => []),
          dashboardService.getRecentActivity().catch(() => []),
          dashboardService.getWarnings().catch(() => []),
        ])

        if (statsData) setStats(statsData)
        if (chartDataData.length > 0) setChartData(chartDataData)
        if (activityData.length > 0) setRecentActivity(activityData)
        if (warningsData.length > 0) setWarnings(warningsData)
        setLastUpdated(new Date())
      } catch {
        // Silent fail
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditDocument = (warning: Warning) => {
    setSelectedWarning(warning)
    setEditDocumentOpen(true)
  }

  const handleViewHistory = (warning: Warning) => {
    setSelectedWarning(warning)
    setVehicleHistoryOpen(true)
  }

  const handleSaveDocument = async (_data: unknown) => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    loadDashboardData()
  }

  // Calculate peak hour
  const peakHour = useMemo(() => {
    if (chartData.length === 0) return null
    const max = chartData.reduce((prev, current) => 
      (prev.count > current.count) ? prev : current
    )
    return max.count > 0 ? max : null
  }, [chartData])

  // Calculate total vehicles today
  const totalVehiclesToday = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.count, 0)
  }, [chartData])

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Bảng điều khiển
            </h1>
            <LiveIndicator />
          </div>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {format(new Date(), "EEEE, dd MMMM yyyy", { locale: vi })}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500">Cập nhật lần cuối</p>
            <p className="text-sm font-medium text-gray-700">
              {format(lastUpdated, "HH:mm:ss")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={loadDashboardData}
            disabled={isLoading}
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ModernStatCard
          title="Xe trong bến"
          value={stats.vehiclesInStation}
          icon={Bus}
          variant="primary"
          subtitle="Đang chờ xuất bến"
          trend={{ value: 12, isPositive: true }}
          animate={!isLoading}
        />
        <ModernStatCard
          title="Xe đã xuất bến"
          value={stats.vehiclesDepartedToday}
          icon={CheckCircle}
          variant="success"
          subtitle="Trong ngày hôm nay"
          trend={{ value: 8, isPositive: true }}
          animate={!isLoading}
        />
        <ModernStatCard
          title="Doanh thu"
          value={stats.revenueToday}
          suffix="đ"
          icon={Banknote}
          variant="warning"
          subtitle="VNĐ trong ngày"
          trend={{ value: 15, isPositive: true }}
          animate={!isLoading}
        />
        <ModernStatCard
          title="Cần xử lý"
          value={stats.invalidVehicles}
          icon={AlertTriangle}
          variant="danger"
          subtitle="Giấy tờ hết hạn"
          trend={stats.invalidVehicles > 0 ? { value: stats.invalidVehicles * 5, isPositive: false } : undefined}
          animate={!isLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Lượt xe theo giờ
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Thống kê số lượng xe vào bến trong ngày
                </p>
              </div>
              {peakHour && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Giờ cao điểm</p>
                  <p className="text-lg font-bold text-blue-600">{peakHour.hour}</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-500 text-sm">Đang tải biểu đồ...</span>
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="text-center">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Chưa có dữ liệu</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="hour"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    width={30}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white rounded-lg shadow-xl border border-gray-100 p-3">
                            <p className="text-sm font-semibold text-gray-900">{label}</p>
                            <p className="text-sm text-blue-600 font-medium">
                              {payload[0].value} lượt xe
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    fill="url(#colorGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Panel */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Thống kê nhanh
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Total vehicles today */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Tổng lượt xe hôm nay</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">{totalVehiclesToday}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Bus className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Peak hour info */}
            {peakHour && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600 font-medium">Cao điểm ({peakHour.hour})</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">{peakHour.count} xe</p>
                  </div>
                  <div className="p-3 bg-emerald-100 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </div>
            )}

            {/* Warnings count */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-rose-50 to-red-50 border border-rose-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-rose-600 font-medium">Cảnh báo giấy tờ</p>
                  <p className="text-2xl font-bold text-rose-700 mt-1">{warnings.length}</p>
                </div>
                <div className="p-3 bg-rose-100 rounded-xl">
                  <FileWarning className="w-6 h-6 text-rose-600" />
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="pt-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Thao tác nhanh
              </p>
              <div className="space-y-2">
                <QuickAction 
                  icon={History} 
                  label="Lịch sử chỉnh sửa" 
                  onClick={() => setVehicleHistoryOpen(true)}
                />
                <QuickAction 
                  icon={RefreshCw} 
                  label="Làm mới dữ liệu" 
                  onClick={loadDashboardData}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Document Warnings */}
        <DocumentWarningsTable
          warnings={warnings}
          isLoading={isLoading}
          onEditDocument={handleEditDocument}
          onViewHistory={handleViewHistory}
        />

        {/* Recent Activity */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  Hoạt động gần đây
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Các chuyến xe mới nhất trong hệ thống
                </p>
              </div>
              {recentActivity.length > 0 && (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {recentActivity.length} hoạt động
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-500 text-sm mt-3">Đang tải...</p>
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="py-12 text-center">
                <Bus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Chưa có hoạt động nào</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 6).map((activity, index) => {
                  const statusConfig = getStatusConfig(activity.status)
                  return (
                    <div
                      key={activity.id}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-xl transition-all duration-200",
                        "hover:bg-gray-50 border border-transparent hover:border-gray-100",
                        index === 0 && "bg-blue-50/50 border-blue-100"
                      )}
                    >
                      <div className={cn(
                        "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                        statusConfig.bg
                      )}>
                        <Bus className={cn("w-5 h-5", statusConfig.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 truncate">
                            {activity.vehiclePlateNumber}
                          </p>
                          {index === 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              Mới nhất
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <p className="text-sm text-gray-500 truncate">{activity.route || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className={cn(
                          "inline-block px-2 py-1 rounded-lg text-xs font-medium",
                          statusConfig.bg, statusConfig.color
                        )}>
                          {statusConfig.label}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(activity.entryTime), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
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
  )
}
