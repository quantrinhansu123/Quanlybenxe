import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { 
  ChevronDown, 
  ChevronUp, 
  Printer, 
  FileText, 
  Plus, 
  Trash2, 
  Check, 
  X,
  RefreshCw,
  FileSpreadsheet,
  Calendar,
  Clock,
  Bus,
  MapPin,
  User,
  Building2,
  CreditCard,
  Receipt,
  Banknote,
  CircleDollarSign,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { dispatchService } from "@/services/dispatch.service"
import { serviceChargeService } from "@/services/service-charge.service"
import type { DispatchRecord, ServiceCharge, ServiceType, ServiceChargeInput } from "@/types"
import { format } from "date-fns"
import { useUIStore } from "@/store/ui.store"
import * as XLSX from "xlsx"
import { DatePickerRange } from "@/components/DatePickerRange"
import { type DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"

// Status configuration
const statusConfig = {
  paid: { 
    label: "Đã thanh toán", 
    bg: "bg-emerald-100", 
    text: "text-emerald-700",
    icon: CheckCircle2,
    gradient: "from-emerald-500 to-teal-500"
  },
  departed: { 
    label: "Đã xuất bến", 
    bg: "bg-violet-100", 
    text: "text-violet-700",
    icon: ArrowRight,
    gradient: "from-violet-500 to-purple-500"
  },
  pending: { 
    label: "Chờ thanh toán", 
    bg: "bg-amber-100", 
    text: "text-amber-700",
    icon: Clock,
    gradient: "from-amber-500 to-orange-500"
  }
}

// Stats Card Component
function StatsCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  gradient,
  trend
}: { 
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  gradient: string
  trend?: { value: number; label: string }
}) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-5",
      "bg-gradient-to-br", gradient,
      "text-white shadow-lg"
    )}>
      <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 opacity-20">
        <Icon className="w-full h-full" />
      </div>
      <div className="relative">
        <p className="text-sm font-medium text-white/80">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        {subtitle && <p className="text-sm text-white/70 mt-1">{subtitle}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-2 text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>{trend.value}% {trend.label}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Order Card Component for List View
function OrderCard({ 
  item, 
  isSelected, 
  onSelect, 
  onNavigate 
}: { 
  item: DispatchRecord
  isSelected: boolean
  onSelect: () => void
  onNavigate: () => void
}) {
  const isPaid = item.currentStatus === 'paid' || item.currentStatus === 'departed'
  const status = isPaid 
    ? (item.currentStatus === 'paid' ? statusConfig.paid : statusConfig.departed)
    : statusConfig.pending
  const StatusIcon = status.icon

  return (
    <div 
      className={cn(
        "group relative bg-white rounded-xl border-2 transition-all duration-200",
        "hover:shadow-lg hover:border-blue-200 hover:-translate-y-0.5",
        isSelected ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-100"
      )}
    >
      {/* Selection checkbox */}
      {!isPaid && (
        <div className="absolute top-4 left-4 z-10">
          <Checkbox 
            checked={isSelected}
            onChange={onSelect}
            className="h-5 w-5"
          />
        </div>
      )}

      {/* Status indicator */}
      <div className={cn(
        "absolute top-0 right-0 px-3 py-1.5 rounded-bl-xl rounded-tr-xl",
        status.bg
      )}>
        <div className="flex items-center gap-1.5">
          <StatusIcon className={cn("w-3.5 h-3.5", status.text)} />
          <span className={cn("text-xs font-semibold", status.text)}>
            {status.label}
          </span>
        </div>
      </div>

      <div 
        className="p-5 cursor-pointer"
        onClick={onNavigate}
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className={cn(
            "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
            "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md"
          )}>
            <Bus className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <p className="font-bold text-gray-900 text-lg">
              {item.vehiclePlateNumber}
            </p>
            <p className="text-sm text-gray-500 truncate">
              {item.transportOrderCode || `#${item.id.slice(-8)}`}
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600 truncate">
              {item.vehicle?.operator?.name || 'Chưa có đơn vị'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600 truncate">
              {item.routeName || 'Chưa có tuyến'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600">
              {format(new Date(item.entryTime), "dd/MM/yyyy")}
            </span>
            <span className="text-gray-300">|</span>
            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600">
              {item.plannedDepartureTime 
                ? format(new Date(item.plannedDepartureTime), "HH:mm")
                : '--:--'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">{item.entryBy || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CircleDollarSign className="w-5 h-5 text-emerald-500" />
            <span className="text-lg font-bold text-emerald-600">
              {(item.paymentAmount || 0).toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>
      </div>

      {/* Hover action hint */}
      <div className={cn(
        "absolute inset-x-0 bottom-0 h-1 rounded-b-xl transition-all duration-200",
        "bg-gradient-to-r opacity-0 group-hover:opacity-100",
        isPaid ? status.gradient : "from-blue-500 to-indigo-500"
      )} />
    </div>
  )
}

export default function ThanhToan() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const setTitle = useUIStore((state) => state.setTitle)
  
  // Detail view state
  const [record, setRecord] = useState<DispatchRecord | null>(null)
  const [serviceCharges, setServiceCharges] = useState<ServiceCharge[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const [symbol, setSymbol] = useState("QLBX")
  const [note, setNote] = useState("")
  const [printOneCopy, setPrintOneCopy] = useState(true)
  const [printTwoCopies, setPrintTwoCopies] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAddingService, setIsAddingService] = useState(false)
  const [newService, setNewService] = useState({
    serviceTypeId: "",
    serviceName: "",
    quantity: 1,
    unitPrice: 0,
  })
  const [showServiceDropdown, setShowServiceDropdown] = useState(false)
  const serviceDropdownRef = useRef<HTMLDivElement>(null)
  const [showZeroAmountWarning, setShowZeroAmountWarning] = useState(false)

  // List view state
  const [allData, setAllData] = useState<DispatchRecord[]>([])
  const [listData, setListData] = useState<DispatchRecord[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [orderType, setOrderType] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date()
    const fromDate = new Date(today.setHours(0, 0, 0, 0))
    const toDate = new Date(today.setHours(23, 59, 59, 999))
    return { from: fromDate, to: toDate }
  })

  // Calculate stats
  const stats = {
    total: listData.length,
    pending: listData.filter(i => i.currentStatus !== 'paid' && i.currentStatus !== 'departed').length,
    paid: listData.filter(i => i.currentStatus === 'paid').length,
    totalAmount: listData.reduce((sum, i) => sum + (i.paymentAmount || 0), 0)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target as Node)) {
        setShowServiceDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (id) {
      setTitle("Xác nhận thanh toán")
      loadData()
    } else {
      setTitle("Quản lý đơn hàng")
      loadListData()
    }
  }, [id, setTitle])

  useEffect(() => {
    if (!id && allData.length > 0) {
      applyFilters()
    }
  }, [dateRange, orderType, searchQuery, allData.length, id])

  const applyFilters = () => {
    let filtered = [...allData]
    
    if (dateRange?.from && dateRange?.to) {
      const fromDate = new Date(dateRange.from)
      fromDate.setHours(0, 0, 0, 0)
      const toDate = new Date(dateRange.to)
      toDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter(record => {
        const entryTime = new Date(record.entryTime)
        return entryTime >= fromDate && entryTime <= toDate
      })
    } else if (dateRange?.from) {
      const fromDate = new Date(dateRange.from)
      fromDate.setHours(0, 0, 0, 0)
      filtered = filtered.filter(record => {
        const entryTime = new Date(record.entryTime)
        return entryTime >= fromDate
      })
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(record => 
        record.vehiclePlateNumber?.toLowerCase().includes(query) ||
        record.transportOrderCode?.toLowerCase().includes(query) ||
        record.vehicle?.operator?.name?.toLowerCase().includes(query) ||
        record.routeName?.toLowerCase().includes(query)
      )
    }
    
    filtered.sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime())
    setListData(filtered)
    
    setSelectedItems(prev => {
      const newSet = new Set<string>()
      prev.forEach(itemId => {
        const item = filtered.find(i => i.id === itemId)
        if (item && item.currentStatus !== 'paid' && item.currentStatus !== 'departed') {
          newSet.add(itemId)
        }
      })
      return newSet
    })
  }

  const loadListData = async () => {
    setIsLoading(true)
    try {
      const data = await dispatchService.getAll()
      setAllData(data)
    } catch (error) {
      console.error("Failed to load list data:", error)
      toast.error("Không thể tải danh sách đơn hàng")
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportExcel = () => {
    if (listData.length === 0) {
      toast.warning("Không có dữ liệu để xuất Excel")
      return
    }

    try {
      const excelData = listData.map((item, index) => ({
        "STT": index + 1,
        "Mã đơn hàng": item.transportOrderCode || item.id.substring(0, 8),
        "Biển kiểm soát": item.vehiclePlateNumber,
        "Đơn vị vận tải": item.vehicle?.operator?.name || "-",
        "Tuyến vận chuyển": item.routeName || "-",
        "Giờ xuất bến KH": item.plannedDepartureTime 
          ? format(new Date(item.plannedDepartureTime), "HH:mm") 
          : "-",
        "Ngày tạo": format(new Date(item.entryTime), "dd/MM/yyyy HH:mm"),
        "Người tạo": item.entryBy || "-",
        "Tổng tiền (đồng)": item.paymentAmount || 0,
        "Trạng thái": item.currentStatus === 'paid' ? 'Đã thanh toán' : 
                      item.currentStatus === 'departed' ? 'Đã xuất bến' : 'Chưa thanh toán'
      }))

      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Danh sách đơn hàng")

      const fromDateStr = dateRange?.from ? format(dateRange.from, "dd-MM-yyyy") : format(new Date(), "dd-MM-yyyy")
      const toDateStr = dateRange?.to ? format(dateRange.to, "dd-MM-yyyy") : format(new Date(), "dd-MM-yyyy")
      const filename = `Danh-sach-don-hang_${fromDateStr}_${toDateStr}.xlsx`

      XLSX.writeFile(wb, filename)
      toast.success(`Đã xuất Excel thành công`)
    } catch (error) {
      console.error("Failed to export Excel:", error)
      toast.error("Không thể xuất Excel")
    }
  }

  const loadData = async () => {
    if (!id) return
    
    setIsLoading(true)
    try {
      const [recordData, chargesData, typesData] = await Promise.all([
        dispatchService.getById(id),
        serviceChargeService.getAll(id),
        serviceChargeService.getServiceTypes(true)
      ])
      setRecord(recordData)
      setServiceCharges(chargesData)
      setServiceTypes(typesData)
      
      if (recordData) {
        setNote(`Đơn hàng điều độ (${format(new Date(recordData.entryTime), "dd/MM/yyyy HH:mm")})`)
        setExpandedOrders(new Set([recordData.transportOrderCode || `ORDER-${id?.slice(0, 8)}`]))
      }
    } catch (error) {
      console.error("Failed to load payment data:", error)
      toast.error("Không thể tải dữ liệu thanh toán")
      navigate("/dieu-do")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) newSet.delete(orderId)
      else newSet.add(orderId)
      return newSet
    })
  }

  const calculateTotals = () => {
    const subtotal = serviceCharges.reduce((sum, charge) => sum + charge.totalAmount, 0)
    const discount = 0
    const tax = 0
    const total = subtotal - discount + tax
    return { subtotal, discount, tax, total }
  }

  const processPayment = async () => {
    if (!record) return

    const { total } = calculateTotals()
    
    setIsProcessing(true)
    try {
      await dispatchService.processPayment(record.id, {
        paymentAmount: total,
        paymentMethod: 'cash'
      })
      
      toast.success("Thanh toán thành công!")
      navigate("/thanh-toan")
    } catch (error) {
      console.error("Failed to process payment:", error)
      toast.error("Không thể xử lý thanh toán")
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePayment = async () => {
    if (!record) return
    const { total } = calculateTotals()
    
    if (total === 0) {
      setShowZeroAmountWarning(true)
      return
    }
    
    await processPayment()
  }

  const handleConfirmZeroAmountPayment = async () => {
    setShowZeroAmountWarning(false)
    await processPayment()
  }

  const handleCancel = () => {
    if (window.confirm("Bạn có chắc chắn muốn hủy thanh toán?")) {
      navigate("/dieu-do")
    }
  }

  const handleAddServiceClick = () => {
    setIsAddingService(true)
    const orderId = record?.transportOrderCode || `ORDER-${id?.slice(0, 8)}`
    setExpandedOrders(prev => new Set(prev).add(orderId))
  }

  const handleSaveService = async () => {
    if (!id || !newService.serviceTypeId || !newService.unitPrice) {
      toast.warning("Vui lòng điền đầy đủ thông tin dịch vụ")
      return
    }

    if (newService.quantity <= 0) {
      toast.warning("Số lượng phải lớn hơn 0")
      return
    }

    try {
      const totalAmount = newService.quantity * newService.unitPrice
      const input: ServiceChargeInput = {
        dispatchRecordId: id,
        serviceTypeId: newService.serviceTypeId,
        quantity: newService.quantity,
        unitPrice: newService.unitPrice,
        totalAmount,
      }

      await serviceChargeService.create(input)
      const chargesData = await serviceChargeService.getAll(id)
      setServiceCharges(chargesData)
      
      setNewService({ serviceTypeId: "", serviceName: "", quantity: 1, unitPrice: 0 })
      setIsAddingService(false)
      toast.success("Thêm dịch vụ thành công!")
    } catch (error) {
      console.error("Failed to add service:", error)
      toast.error("Không thể thêm dịch vụ")
    }
  }

  const handleCancelService = () => {
    setIsAddingService(false)
    setNewService({ serviceTypeId: "", serviceName: "", quantity: 1, unitPrice: 0 })
  }

  const handleServiceTypeChange = (serviceTypeId: string) => {
    const selectedType = serviceTypes.find(st => st.id === serviceTypeId)
    setNewService({
      ...newService,
      serviceTypeId,
      serviceName: selectedType?.name || "",
      unitPrice: selectedType?.basePrice || 0,
    })
  }

  const handleDeleteService = async (chargeId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa dịch vụ này?")) return
    if (!id) return

    try {
      await serviceChargeService.delete(chargeId)
      const chargesData = await serviceChargeService.getAll(id)
      setServiceCharges(chargesData)
      toast.success("Xóa dịch vụ thành công!")
    } catch (error) {
      console.error("Failed to delete service:", error)
      toast.error("Không thể xóa dịch vụ")
    }
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) newSet.delete(itemId)
      else newSet.add(itemId)
      return newSet
    })
  }

  const handleBatchPayment = () => {
    if (selectedItems.size === 0) {
      toast.warning("Vui lòng chọn ít nhất một đơn hàng")
      return
    }
    const selectedRecord = listData.find(item => selectedItems.has(item.id))
    if (selectedRecord) {
      navigate(`/thanh-toan/${selectedRecord.id}`)
    }
  }

  // ========== LIST VIEW ==========
  if (!id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
        <div className="p-4 lg:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
                  <Receipt className="w-6 h-6" />
                </div>
                Quản lý đơn hàng
              </h1>
              <p className="text-gray-500 mt-1">Theo dõi và xử lý thanh toán</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadListData}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Làm mới
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportExcel}
                className="gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Xuất Excel
              </Button>
              {selectedItems.size > 0 && (
                <Button 
                  size="sm"
                  onClick={handleBatchPayment}
                  className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                >
                  <Banknote className="w-4 h-4" />
                  Thanh toán ({selectedItems.size})
                </Button>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Tổng đơn hàng"
              value={stats.total}
              subtitle="Trong khoảng thời gian"
              icon={Receipt}
              gradient="from-blue-500 to-indigo-600"
            />
            <StatsCard
              title="Chờ thanh toán"
              value={stats.pending}
              subtitle="Cần xử lý"
              icon={Clock}
              gradient="from-amber-500 to-orange-500"
            />
            <StatsCard
              title="Đã thanh toán"
              value={stats.paid}
              subtitle="Hoàn thành"
              icon={CheckCircle2}
              gradient="from-emerald-500 to-teal-500"
            />
            <StatsCard
              title="Tổng doanh thu"
              value={`${(stats.totalAmount / 1000000).toFixed(1)}M`}
              subtitle={`${stats.totalAmount.toLocaleString('vi-VN')}đ`}
              icon={Wallet}
              gradient="from-violet-500 to-purple-600"
            />
          </div>

          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Tìm theo biển số, mã đơn, đơn vị, tuyến..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Date Range */}
                <div className="w-full lg:w-80">
                  <DatePickerRange
                    range={dateRange}
                    onRangeChange={setDateRange}
                    placeholder="Chọn khoảng thời gian"
                    label=""
                    className="w-full"
                  />
                </div>

                {/* Order Type */}
                <div className="w-full lg:w-48">
                  <Select 
                    value={orderType} 
                    onChange={(e) => setOrderType(e.target.value)} 
                    className="w-full"
                  >
                    <option value="all">Tất cả loại</option>
                    <option value="thanh-toan-chuyen">Thanh toán chuyến</option>
                    <option value="thanh-toan-dinh-ky">Thanh toán định kỳ</option>
                    <option value="thanh-toan-vang-lai">Vãng lai</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orders Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-500 mt-4">Đang tải dữ liệu...</p>
              </div>
            </div>
          ) : listData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Receipt className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg font-medium">Không có đơn hàng nào</p>
              <p className="text-gray-400 text-sm mt-1">Thay đổi bộ lọc để xem thêm</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {listData.map(item => (
                <OrderCard
                  key={item.id}
                  item={item}
                  isSelected={selectedItems.has(item.id)}
                  onSelect={() => toggleItemSelection(item.id)}
                  onNavigate={() => navigate(`/thanh-toan/${item.id}`)}
                />
              ))}
            </div>
          )}

          {/* Footer Summary */}
          {listData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Hiển thị <strong>{listData.length}</strong> đơn hàng</span>
                  {selectedItems.size > 0 && (
                    <span className="text-blue-600">
                      | Đã chọn <strong>{selectedItems.size}</strong>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Tổng:</span>
                  <span className="text-2xl font-bold text-emerald-600">
                    {stats.totalAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ========== DETAIL VIEW ==========
  const { subtotal, discount, tax, total } = calculateTotals()
  const orderId = record?.transportOrderCode || `ORDER-${id?.slice(0, 8)}`
  const isExpanded = expandedOrders.has(orderId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 mt-4">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-gray-600 text-lg">Không tìm thấy thông tin thanh toán</p>
          <Button onClick={() => navigate("/dieu-do")} className="mt-4">
            Quay lại
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <button 
            onClick={() => navigate("/thanh-toan")}
            className="hover:text-blue-600 transition-colors"
          >
            Quản lý đơn hàng
          </button>
          <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
          <span className="text-gray-900 font-medium">Thanh toán</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="xl:col-span-2 space-y-6">
            {/* Vehicle Info Card */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <Bus className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm">Biển kiểm soát</p>
                    <p className="text-3xl font-bold">{record.vehiclePlateNumber}</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Tuyến vận chuyển</p>
                    <p className="font-semibold text-gray-900">{record.routeName || 'Chưa có'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Giờ vào bến</p>
                    <p className="font-semibold text-gray-900">
                      {format(new Date(record.entryTime), "HH:mm dd/MM/yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Giờ xuất bến KH</p>
                    <p className="font-semibold text-gray-900">
                      {record.plannedDepartureTime 
                        ? format(new Date(record.plannedDepartureTime), "HH:mm dd/MM/yyyy")
                        : 'Chưa có'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Số ghế</p>
                    <p className="font-semibold text-gray-900">{record.seatCount || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Services Card */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Danh sách dịch vụ
                </CardTitle>
                <Button
                  onClick={handleAddServiceClick}
                  size="sm"
                  className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600"
                >
                  <Plus className="w-4 h-4" />
                  Thêm dịch vụ
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {/* Order Header */}
                <button
                  onClick={() => toggleOrder(orderId)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors border-y"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Receipt className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">Mã đơn: {orderId}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(record.entryTime), "dd/MM/yyyy")}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {/* Services List */}
                {isExpanded && (
                  <div className="divide-y">
                    {/* Add Service Row */}
                    {isAddingService && (
                      <div className="p-4 bg-blue-50">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-2 relative" ref={serviceDropdownRef}>
                            <Label className="text-xs text-gray-500 mb-1 block">Dịch vụ</Label>
                            <Input
                              value={newService.serviceName}
                              onChange={(e) => {
                                setNewService({ ...newService, serviceName: e.target.value })
                                setShowServiceDropdown(true)
                              }}
                              onFocus={() => setShowServiceDropdown(true)}
                              placeholder="Nhập tên dịch vụ..."
                            />
                            {showServiceDropdown && (
                              <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                                {serviceTypes.filter(t => 
                                  t.name.toLowerCase().includes(newService.serviceName.toLowerCase())
                                ).map((type) => (
                                  <div
                                    key={type.id}
                                    onClick={() => {
                                      handleServiceTypeChange(type.id)
                                      setShowServiceDropdown(false)
                                    }}
                                    className="px-4 py-2.5 cursor-pointer hover:bg-blue-50 text-sm"
                                  >
                                    {type.name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500 mb-1 block">Đơn giá</Label>
                            <Input
                              type="number"
                              value={newService.unitPrice}
                              onChange={(e) => setNewService({ ...newService, unitPrice: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500 mb-1 block">Số lượng</Label>
                            <Input
                              type="number"
                              min="1"
                              value={newService.quantity}
                              onChange={(e) => setNewService({ ...newService, quantity: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <p className="text-sm">
                            Thành tiền: <span className="font-bold text-blue-600">
                              {(newService.quantity * newService.unitPrice).toLocaleString('vi-VN')}đ
                            </span>
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={handleCancelService}>
                              <X className="w-4 h-4 mr-1" /> Hủy
                            </Button>
                            <Button size="sm" onClick={handleSaveService}>
                              <Check className="w-4 h-4 mr-1" /> Lưu
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {serviceCharges.length === 0 ? (
                      <div className="py-12 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500">Chưa có dịch vụ nào</p>
                        <p className="text-sm text-gray-400 mt-1">Nhấn "Thêm dịch vụ" để bắt đầu</p>
                      </div>
                    ) : (
                      serviceCharges.map((charge) => (
                        <div key={charge.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                              <CreditCard className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {charge.serviceType?.name || "Dịch vụ"}
                              </p>
                              <p className="text-sm text-gray-500">
                                {charge.quantity} x {charge.unitPrice.toLocaleString('vi-VN')}đ
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="font-bold text-gray-900">
                              {charge.totalAmount.toLocaleString('vi-VN')}đ
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteService(charge.id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Total */}
                    {serviceCharges.length > 0 && (
                      <div className="p-4 bg-gray-50 flex items-center justify-between">
                        <p className="font-semibold text-gray-700">Tổng cộng</p>
                        <p className="text-xl font-bold text-emerald-600">
                          {subtotal.toLocaleString('vi-VN')}đ
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleCancel} className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
                <X className="w-4 h-4" />
                Hủy thanh toán
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  if (record?.vehiclePlateNumber) {
                    navigate(`/bao-cao/xe-tra-khach?vehiclePlateNumber=${encodeURIComponent(record.vehiclePlateNumber)}&returnTo=/thanh-toan/${id}`)
                  }
                }}
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                Lịch sử trả khách
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  if (record?.vehiclePlateNumber) {
                    navigate(`/bao-cao/xe-ra-vao-ben?vehiclePlateNumber=${encodeURIComponent(record.vehiclePlateNumber)}&returnTo=/thanh-toan/${id}`)
                  }
                }}
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                Lịch sử ra vào
              </Button>
            </div>
          </div>

          {/* Right Column - Payment Sidebar */}
          <div className="space-y-6">
            {/* Payment Card */}
            <Card className="border-0 shadow-lg sticky top-6">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm">Thực thu</p>
                    <p className="text-3xl font-bold">{total.toLocaleString('vi-VN')}đ</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-6">
                {/* Symbol */}
                <div>
                  <Label className="text-sm text-gray-500">Ký hiệu</Label>
                  <Select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="mt-1"
                  >
                    <option value="QLBX">QLBX</option>
                    <option value="KHAC">KHAC</option>
                  </Select>
                </div>

                {/* Note */}
                <div>
                  <Label className="text-sm text-gray-500">Ghi chú</Label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-1 w-full min-h-[80px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nhập ghi chú..."
                  />
                </div>

                {/* Customer Info */}
                <div className="space-y-3 pt-4 border-t">
                  <p className="text-sm font-semibold text-gray-700">Thông tin khách hàng</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">Người mua:</span>
                      <span className="font-medium">{record.driverName || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">Đơn vị:</span>
                      <span className="font-medium truncate">{record.vehicle?.operator?.name || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tổng tiền:</span>
                    <span className="font-medium">{subtotal.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Chiết khấu:</span>
                    <span className="font-medium">{discount.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Thuế GTGT:</span>
                    <span className="font-medium">{tax.toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>

                {/* Print Options */}
                <div className="space-y-2 pt-4 border-t">
                  <p className="text-sm font-semibold text-gray-700">Tùy chọn in</p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={printOneCopy}
                        onChange={(e) => {
                          setPrintOneCopy(e.target.checked)
                          if (e.target.checked) setPrintTwoCopies(false)
                        }}
                      />
                      <span className="text-sm">In 1 liên</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={printTwoCopies}
                        onChange={(e) => {
                          setPrintTwoCopies(e.target.checked)
                          if (e.target.checked) setPrintOneCopy(false)
                        }}
                      />
                      <span className="text-sm">In 2 liên</span>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => toast.info("Chức năng đang phát triển")}
                  >
                    <Printer className="w-4 h-4" />
                    Xem trước bản in
                  </Button>
                  <Button 
                    className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 h-12 text-lg"
                    onClick={handlePayment}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Thanh toán
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Zero Amount Warning Dialog */}
      <Dialog open={showZeroAmountWarning} onOpenChange={setShowZeroAmountWarning}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={() => setShowZeroAmountWarning(false)} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Cảnh báo thanh toán
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700">
              Tổng tiền thanh toán là <span className="font-bold text-red-600">0 đồng</span>.
            </p>
            <p className="text-gray-500 mt-2">
              Bạn có chắc chắn muốn tiếp tục?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowZeroAmountWarning(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleConfirmZeroAmountPayment}
              disabled={isProcessing}
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              {isProcessing ? "Đang xử lý..." : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
