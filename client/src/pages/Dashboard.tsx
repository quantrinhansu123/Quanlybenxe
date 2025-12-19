import { useState, useEffect } from "react"
import { Bus, CheckCircle, DollarSign, AlertTriangle, History, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/layout/StatusBadge"
import { DocumentWarningsTable } from "@/components/dashboard/DocumentWarningsTable"
import { EditDocumentDialog } from "@/components/dashboard/EditDocumentDialog"
import { VehicleHistoryTable } from "@/components/dashboard/VehicleHistoryTable"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts"
import { format } from "date-fns"
import { dashboardService } from "@/services/dashboard.service"
import type { DashboardStats, ChartDataPoint, RecentActivity, Warning } from "@/services/dashboard.service"
import { useUIStore } from "@/store/ui.store"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  description?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  color: 'blue' | 'green' | 'amber' | 'red'
  delay?: number
}

const colorVariants = {
  blue: {
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    trendPositive: 'text-green-600 bg-green-50',
    trendNegative: 'text-red-600 bg-red-50',
  },
  green: {
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    trendPositive: 'text-green-600 bg-green-50',
    trendNegative: 'text-red-600 bg-red-50',
  },
  amber: {
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    trendPositive: 'text-green-600 bg-green-50',
    trendNegative: 'text-red-600 bg-red-50',
  },
  red: {
    bg: 'bg-red-50',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    trendPositive: 'text-red-600 bg-red-50',
    trendNegative: 'text-green-600 bg-green-50',
  },
}

function StatCard({ title, value, icon: Icon, description, trend, color, delay = 0 }: StatCardProps) {
  const colors = colorVariants[color]

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300",
        "opacity-0 animate-fade-in"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn("absolute inset-0 opacity-50", colors.bg)} />
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{value}</span>
              {trend && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium",
                  trend.isPositive ? colors.trendPositive : colors.trendNegative
                )}>
                  {trend.isPositive ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
          </div>
          <div className={cn("p-3 rounded-xl", colors.iconBg)}>
            <Icon className={cn("w-6 h-6", colors.iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
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
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Tổng quan")
    loadDashboardData()
  }, [setTitle])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      try {
        const data = await dashboardService.getDashboardData()
        setStats(data.stats)
        setChartData(data.chartData)
        setRecentActivity(data.recentActivity)
        setWarnings(data.warnings)
      } catch {
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
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error)
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

  const formatRevenue = (value: number) => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}B`
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    return value.toLocaleString('vi-VN')
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng quan hệ thống</h1>
          <p className="text-gray-500 mt-1">
            Theo dõi hoạt động bến xe trong ngày {format(new Date(), 'dd/MM/yyyy')}
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2 self-start sm:self-auto"
          onClick={loadDashboardData}
          disabled={isLoading}
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Làm mới
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Xe trong bến"
          value={stats.vehiclesInStation}
          icon={Bus}
          description="Đang chờ xuất bến"
          trend={{ value: 12, isPositive: true }}
          color="blue"
          delay={0}
        />
        <StatCard
          title="Xe đã xuất bến"
          value={stats.vehiclesDepartedToday}
          icon={CheckCircle}
          description="Hôm nay"
          trend={{ value: 8, isPositive: true }}
          color="green"
          delay={100}
        />
        <StatCard
          title="Doanh thu"
          value={formatRevenue(stats.revenueToday)}
          icon={DollarSign}
          description="VNĐ hôm nay"
          trend={{ value: 15, isPositive: true }}
          color="amber"
          delay={200}
        />
        <StatCard
          title="Cần xử lý"
          value={stats.invalidVehicles}
          icon={AlertTriangle}
          description="Xe không đủ điều kiện"
          trend={stats.invalidVehicles > 0 ? { value: stats.invalidVehicles, isPositive: false } : undefined}
          color="red"
          delay={300}
        />
      </div>

      {/* Chart Section */}
      <Card className="border-0 shadow-sm opacity-0 animate-fade-in" style={{ animationDelay: '400ms' }}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-semibold">Lượt xe theo giờ</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Thống kê số lượng xe xuất bến trong ngày</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span>Xu hướng tăng</span>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <ResponsiveContainer width="100%" height={320}>
            {isLoading || chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-500">Đang tải dữ liệu...</span>
                </div>
              </div>
            ) : (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
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
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                  }}
                  labelStyle={{ fontWeight: 600, color: '#111827' }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorCount)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tables Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Warnings */}
        <div className="opacity-0 animate-fade-in" style={{ animationDelay: '500ms' }}>
          <DocumentWarningsTable
            warnings={warnings}
            isLoading={isLoading}
            onEditDocument={handleEditDocument}
            onViewHistory={handleViewHistory}
          />
        </div>

        {/* Recent Activity */}
        <Card className="border-0 shadow-sm opacity-0 animate-fade-in" style={{ animationDelay: '600ms' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Hoạt động gần đây</CardTitle>
            <p className="text-sm text-gray-500">Các chuyến xe mới nhất trong hệ thống</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-100">
                  <TableHead className="text-gray-600 font-medium">Biển số</TableHead>
                  <TableHead className="text-gray-600 font-medium">Tuyến</TableHead>
                  <TableHead className="text-gray-600 font-medium">Thời gian</TableHead>
                  <TableHead className="text-gray-600 font-medium">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-gray-500">Đang tải...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : recentActivity.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Bus className="w-8 h-8 text-gray-300" />
                        <span className="text-gray-500">Không có hoạt động gần đây</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentActivity.map((activity) => (
                    <TableRow
                      key={activity.id}
                      className="border-gray-100 hover:bg-gray-50/50 transition-colors"
                    >
                      <TableCell className="font-semibold text-gray-900">
                        {activity.vehiclePlateNumber}
                      </TableCell>
                      <TableCell className="text-gray-600">{activity.route}</TableCell>
                      <TableCell className="text-gray-600">
                        {format(new Date(activity.entryTime), "HH:mm")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={activity.status as any} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle History Button */}
      <div className="flex justify-center opacity-0 animate-fade-in" style={{ animationDelay: '700ms' }}>
        <Button
          onClick={() => setVehicleHistoryOpen(true)}
          className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all duration-300"
          size="lg"
        >
          <History className="w-5 h-5" />
          Xem lịch sử chỉnh sửa thông số xe
        </Button>
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
