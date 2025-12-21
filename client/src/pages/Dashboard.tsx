import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
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
  ArrowRight,
  Gauge,
  Radio,
  Target,
  ChevronRight,
  Sparkles
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DocumentWarningsTable } from "@/components/dashboard/DocumentWarningsTable"
import { EditDocumentDialog } from "@/components/dashboard/EditDocumentDialog"
import { VehicleHistoryTable } from "@/components/dashboard/VehicleHistoryTable"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns"
import { vi } from "date-fns/locale"
import { dashboardService } from "@/services/dashboard.service"
import type { DashboardStats, ChartDataPoint, RecentActivity, Warning } from "@/services/dashboard.service"
import { useUIStore } from "@/store/ui.store"
import { cn } from "@/lib/utils"

// Animated counter hook with easing
function useAnimatedCounter(end: number, duration: number = 1500) {
  const [count, setCount] = useState(0)
  const countRef = useRef(0)
  const frameRef = useRef<number>()
  
  useEffect(() => {
    // Cancel any existing animation
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
    }
    
    // If target is 0, just set it
    if (end === 0) {
      setCount(0)
      countRef.current = 0
      return
    }
    
    const startValue = countRef.current
    const startTime = performance.now()
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // easeOutExpo for smooth deceleration
      const easeOutExpo = 1 - Math.pow(2, -10 * progress)
      const currentValue = Math.floor(startValue + (end - startValue) * easeOutExpo)
      
      setCount(currentValue)
      countRef.current = currentValue
      
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        setCount(end)
        countRef.current = end
      }
    }
    
    frameRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [end, duration])
  
  return count
}

// Pulsing Live Beacon
function LiveBeacon({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
  const sizes = {
    small: 'h-2 w-2',
    default: 'h-3 w-3',
    large: 'h-4 w-4'
  }
  return (
    <span className="relative flex">
      <span className={cn(
        "animate-ping absolute inline-flex rounded-full bg-emerald-400 opacity-75",
        sizes[size]
      )} />
      <span className={cn(
        "relative inline-flex rounded-full bg-emerald-500",
        sizes[size]
      )} />
    </span>
  )
}

// Hero Stats Card - Main KPI
function HeroStatsCard({ 
  total,
  inStation,
  departed,
  label,
  isLoading,
  onViewDetails
}: { 
  total: number
  inStation: number
  departed: number
  label: string
  isLoading: boolean
  onViewDetails: () => void
}) {
  const animatedTotal = useAnimatedCounter(isLoading ? 0 : total, 2000)
  const animatedInStation = useAnimatedCounter(isLoading ? 0 : inStation, 2000)
  const animatedDeparted = useAnimatedCounter(isLoading ? 0 : departed, 2000)
  
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-2xl">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
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
                <span className="text-xs text-emerald-400 font-medium">Đang hoạt động</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black text-white tracking-tight">
              {animatedTotal}
              <span className="text-lg text-slate-400 font-medium ml-1">lượt</span>
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
                <p className="text-xl font-bold text-white">{animatedInStation}</p>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <p className="text-slate-400 text-xs">Đã xuất bến</p>
                <p className="text-xl font-bold text-emerald-400">{animatedDeparted}</p>
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
  )
}

// Metric Card with 3D Effect
interface MetricCardProps {
  title: string
  value: number
  icon: React.ElementType
  trend?: { value: number; isPositive: boolean }
  variant: 'blue' | 'emerald' | 'amber' | 'rose'
  subtitle?: string
  isLoading?: boolean
  isPulsing?: boolean
}

const metricVariants = {
  blue: {
    gradient: 'from-blue-500 to-indigo-600',
    glow: 'shadow-blue-500/25',
    light: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    iconBg: 'bg-blue-100'
  },
  emerald: {
    gradient: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/25',
    light: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    iconBg: 'bg-emerald-100'
  },
  amber: {
    gradient: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/25',
    light: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    iconBg: 'bg-amber-100'
  },
  rose: {
    gradient: 'from-rose-500 to-red-600',
    glow: 'shadow-rose-500/25',
    light: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    iconBg: 'bg-rose-100'
  }
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  variant,
  subtitle,
  isLoading,
  isPulsing
}: MetricCardProps) {
  const styles = metricVariants[variant]
  const animatedValue = useAnimatedCounter(isLoading ? 0 : value, 1200)
  
  return (
    <div className={cn(
      "group relative overflow-hidden rounded-2xl transition-all duration-500",
      "hover:scale-[1.02] hover:-translate-y-1",
      isPulsing && "animate-pulse-subtle"
    )}>
      {/* Glass Background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-5",
        styles.gradient
      )} />
      
      {/* Card Content */}
      <div className={cn(
        "relative p-4 bg-white/80 backdrop-blur-xl border-2 rounded-2xl",
        "shadow-lg hover:shadow-xl transition-shadow",
        styles.border,
        isPulsing && styles.glow
      )}>
        {/* Header: Icon + Badge */}
        <div className="flex items-center justify-between mb-2">
          <div className={cn(
            "p-2 rounded-lg",
            `bg-gradient-to-br ${styles.gradient}`,
            "shadow-md",
            styles.glow
          )}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {isPulsing && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100">
              <LiveBeacon size="small" />
              <span className="text-xs font-semibold text-rose-600">Cần xử lý</span>
            </div>
          )}
        </div>
        
        {/* Title + Value + Subtitle inline */}
        <p className="text-xs font-medium text-slate-500 mb-0.5">{title}</p>
        <p className={cn(
          "text-3xl font-black tracking-tight leading-tight",
          styles.text
        )}>
          {animatedValue.toLocaleString('vi-VN')}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        )}
        
        {/* Trend - compact */}
        {trend && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
            <span className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold",
              trend.isPositive 
                ? "bg-emerald-100 text-emerald-700" 
                : "bg-rose-100 text-rose-700"
            )}>
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
            <span className="text-xs text-slate-400">vs hôm qua</span>
          </div>
        )}
        
        {/* Hover Decoration */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity",
          styles.gradient
        )} />
      </div>
    </div>
  )
}

// Heat Map Calendar
function HeatMapCalendar({ 
  data, 
  selectedDate,
  onSelectDate 
}: { 
  data: ChartDataPoint[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
}) {
  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  
  // Group data by date
  const dataByDate = useMemo(() => {
    const map = new Map<string, number>()
    data.forEach(d => {
      const dateKey = format(today, 'yyyy-MM-dd')
      map.set(dateKey, (map.get(dateKey) || 0) + d.count)
    })
    return map
  }, [data])
  
  const getHeatLevel = (count: number): string => {
    if (count === 0) return 'bg-slate-100'
    if (count <= 5) return 'bg-emerald-200'
    if (count <= 15) return 'bg-emerald-400'
    if (count <= 30) return 'bg-emerald-500'
    return 'bg-emerald-600'
  }
  
  const weekDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  const firstDayOfWeek = monthStart.getDay()
  
  return (
    <div className="space-y-4">
      {/* Week Headers */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-slate-400 py-1">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for alignment */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        
        {/* Day cells */}
        {days.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const count = dataByDate.get(dateKey) || 0
          const isSelected = isSameDay(day, selectedDate)
          const isTodayDate = isToday(day)
          const hasActivity = count > 0
          
          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all relative",
                "hover:ring-2 hover:ring-blue-400 hover:ring-offset-1",
                hasActivity ? getHeatLevel(count) : 'bg-slate-50',
                isSelected && "ring-2 ring-amber-400 ring-offset-2",
                isTodayDate && "ring-2 ring-blue-500 ring-offset-1"
              )}
              title={`${format(day, 'dd/MM')}: ${count} chuyến`}
            >
              <span className={cn(
                "font-medium",
                hasActivity && count > 2 ? 'text-white' : 'text-slate-600'
              )}>
                {format(day, 'd')}
              </span>
              {hasActivity && (
                <span className="text-[10px] font-bold text-red-500 drop-shadow-sm">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-xs text-slate-400">Ít</span>
        <div className="flex items-center gap-1">
          {['bg-slate-100', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-500', 'bg-emerald-600'].map((bg, i) => (
            <div key={i} className={cn("w-4 h-4 rounded", bg)} />
          ))}
        </div>
        <span className="text-xs text-slate-400">Nhiều</span>
      </div>
    </div>
  )
}

// Live Activity Feed with Animations
function LiveActivityFeed({ 
  activities, 
  isLoading 
}: { 
  activities: RecentActivity[]
  isLoading: boolean
}) {
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
      'entered': { color: 'text-blue-600', bg: 'bg-blue-100', icon: ArrowRight, label: 'Vào bến' },
      'passengers_dropped': { color: 'text-purple-600', bg: 'bg-purple-100', icon: Target, label: 'Trả khách' },
      'permit_issued': { color: 'text-amber-600', bg: 'bg-amber-100', icon: CheckCircle, label: 'Cấp nốt' },
      'paid': { color: 'text-emerald-600', bg: 'bg-emerald-100', icon: Banknote, label: 'Thanh toán' },
      'departure_ordered': { color: 'text-cyan-600', bg: 'bg-cyan-100', icon: Radio, label: 'Lệnh xuất' },
      'departed': { color: 'text-slate-600', bg: 'bg-slate-100', icon: Bus, label: 'Xuất bến' },
    }
    return configs[status] || { color: 'text-slate-600', bg: 'bg-slate-100', icon: Bus, label: status }
  }
  
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-xl bg-slate-50">
            <div className="w-12 h-12 rounded-xl bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
            <Bus className="w-10 h-10 text-slate-300" />
          </div>
          {/* Floating dots animation */}
          <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-blue-200 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="absolute -bottom-1 -left-3 w-3 h-3 rounded-full bg-emerald-200 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="absolute top-1/2 -right-4 w-2 h-2 rounded-full bg-amber-200 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-slate-500 font-medium mt-4">Chưa có hoạt động nào</p>
        <p className="text-slate-400 text-sm">Các xe mới sẽ hiển thị tại đây</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
      {activities.map((activity, index) => {
        const config = getStatusConfig(activity.status)
        const StatusIcon = config.icon
        
        return (
          <div
            key={activity.id}
            className={cn(
              "group flex items-center gap-4 p-4 rounded-xl transition-all duration-300",
              "hover:bg-slate-50 border border-transparent hover:border-slate-200",
              "cursor-pointer",
              index === 0 && "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100"
            )}
            style={{
              animation: `slideInRight 0.4s ease-out ${index * 0.1}s backwards`
            }}
          >
            {/* Status Icon */}
            <div className={cn(
              "relative flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
              config.bg
            )}>
              <StatusIcon className={cn("w-6 h-6", config.color)} />
              {index === 0 && (
                <span className="absolute -top-1 -right-1">
                  <LiveBeacon size="small" />
                </span>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-900">{activity.vehiclePlateNumber}</p>
                {index === 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold uppercase">
                    Mới
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-400" />
                <p className="text-sm text-slate-500 truncate">{activity.route || 'Không có tuyến'}</p>
              </div>
            </div>
            
            {/* Time & Status */}
            <div className="flex-shrink-0 text-right">
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold",
                config.bg, config.color
              )}>
                <StatusIcon className="w-3 h-3" />
                {config.label}
              </span>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {format(new Date(activity.entryTime), "HH:mm")}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Quick Stats Mini Card
function QuickStatCard({ 
  label, 
  value, 
  icon: Icon, 
  color 
}: { 
  label: string
  value: number | string
  icon: React.ElementType
  color: 'blue' | 'emerald' | 'amber' | 'rose'
}) {
  const colors = {
    blue: 'from-blue-500 to-indigo-600 shadow-blue-500/20',
    emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
    amber: 'from-amber-500 to-orange-600 shadow-amber-500/20',
    rose: 'from-rose-500 to-red-600 shadow-rose-500/20'
  }
  
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors">
      <div className={cn(
        "p-2.5 rounded-lg bg-gradient-to-br text-white shadow-lg",
        colors[color]
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({
    totalVehiclesToday: 0,
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Tổng quan")
    loadDashboardData()
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

  const handleSaveDocument = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    loadDashboardData()
  }

  const totalVehiclesToday = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.count, 0)
  }, [chartData])

  const peakHour = useMemo(() => {
    if (chartData.length === 0) return null
    return chartData.reduce((prev, current) => 
      (prev.count > current.count) ? prev : current
    )
  }, [chartData])

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
                    <span className="text-sm font-medium text-emerald-600">Trực tiếp</span>
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
          onViewDetails={() => navigate('/dieu-do')}
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
                      Tháng {format(new Date(), 'MM/yyyy')}
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
  )
}
