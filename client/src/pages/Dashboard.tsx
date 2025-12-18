import { useState, useEffect } from "react"
import { Bus, CheckCircle, DollarSign, AlertTriangle, History } from "lucide-react"
import { iconStyles } from "@/lib/icon-theme"
import { DashboardCard } from "@/components/layout/DashboardCard"
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { format } from "date-fns"
import { dashboardService } from "@/services/dashboard.service"
import type { DashboardStats, ChartDataPoint, RecentActivity, Warning } from "@/services/dashboard.service"
import { useUIStore } from "@/store/ui.store"

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
      // Try to load all data at once, fallback to individual calls
      try {
        const data = await dashboardService.getDashboardData()
        setStats(data.stats)
        setChartData(data.chartData)
        setRecentActivity(data.recentActivity)
        setWarnings(data.warnings)
      } catch {
        // If combined endpoint doesn't exist, load individually
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
      // Keep default values on error
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditDocument = (warning: Warning) => {
    setSelectedWarning(warning)
    setEditDocumentOpen(true)
  }

const handleViewHistory = (warning: Warning) => {
  // Pass the warning to filter history for specific vehicle/driver
  setSelectedWarning(warning)
  setVehicleHistoryOpen(true)
}


  const handleSaveDocument = async (data: any) => {
    // This would make an API call to update the document
    console.log("Saving document:", data)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    // Reload warnings after successful update
    loadDashboardData()
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          title="Xe trong bến"
          value={stats.vehiclesInStation}
          icon={Bus}
          description="Hiện tại"
        />
        <DashboardCard
          title="Xe đã xuất bến hôm nay"
          value={stats.vehiclesDepartedToday}
          icon={CheckCircle}
        />
        <DashboardCard
          title="Doanh thu hôm nay"
          value={`${(stats.revenueToday / 1000000).toFixed(1)}M`}
          icon={DollarSign}
        />
        <DashboardCard
          title="Xe không đủ điều kiện"
          value={stats.invalidVehicles}
          icon={AlertTriangle}
          description="Cần xử lý"
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Lượt xe theo giờ</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {isLoading || chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Đang tải dữ liệu...
              </div>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={2}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Warnings */}
        <DocumentWarningsTable
          warnings={warnings}
          isLoading={isLoading}
          onEditDocument={handleEditDocument}
          onViewHistory={handleViewHistory}
        />

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Hoạt động gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Biển số</TableHead>
                  <TableHead>Tuyến</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : recentActivity.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                      Không có hoạt động gần đây
                    </TableCell>
                  </TableRow>
                ) : (
                  recentActivity.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium">
                        {activity.vehiclePlateNumber}
                      </TableCell>
                      <TableCell>{activity.route}</TableCell>
                      <TableCell>
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
      <div className="flex justify-center">
        <Button
          onClick={() => setVehicleHistoryOpen(true)}
          className="gap-2"
          size="lg"
        >
          <History className={iconStyles.historyButton} />
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

