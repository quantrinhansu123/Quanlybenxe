import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { 
  X, 
  Car, 
  DollarSign, 
  FileText, 
  TrendingUp, 
  Building2,
  Truck,
  Users,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Fuel
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/layout/StatusBadge"
import { vehicleService } from "@/services/vehicle.service"
import { invoiceService } from "@/services/invoice.service"
import { dispatchService } from "@/services/dispatch.service"
import type { Operator, Vehicle, Invoice, DispatchRecord } from "@/types"
import { format, parseISO, isValid } from "date-fns"
import { toast } from "react-toastify"

// Vehicle Card Component - Modern card-based design
const VehicleCard = ({ vehicle, index }: { vehicle: Vehicle; index: number }) => {
  const isActive = vehicle.isActive
  const hasSeats = vehicle.seatCapacity && vehicle.seatCapacity > 0
  const hasBeds = vehicle.bedCapacity && vehicle.bedCapacity > 0
  
  return (
    <div
      className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1"
      style={{ 
        animationDelay: `${index * 0.05}s`,
        animation: 'slideUp 0.4s ease-out backwards'
      }}
    >
      {/* Status ribbon */}
      <div className={`absolute top-3 right-3 z-10`}>
        <span className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
          ${isActive 
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30' 
            : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
          }
        `}>
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-gray-300'}`} />
          {isActive ? 'Hoạt động' : 'Ngừng'}
        </span>
      </div>

      {/* Card content */}
      <div className="p-5">
        {/* Plate number - Hero element */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 tracking-tight group-hover:text-blue-600 transition-colors">
              {vehicle.plateNumber}
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              {vehicle.vehicleType?.name || 'Loại khác'}
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Seats */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100">
            <Users className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-xs text-gray-500">Số ghế</p>
              <p className="text-sm font-bold text-gray-900">
                {hasSeats ? vehicle.seatCapacity : '—'}
              </p>
            </div>
          </div>

          {/* Beds */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100">
            <Fuel className="w-4 h-4 text-violet-600" />
            <div>
              <p className="text-xs text-gray-500">Giường</p>
              <p className="text-sm font-bold text-gray-900">
                {hasBeds ? vehicle.bedCapacity : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>{vehicle.province || 'Chưa xác định'}</span>
        </div>
      </div>

      {/* Hover gradient border effect */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
        }}
      />
    </div>
  )
}

// Empty state component
const EmptyVehicles = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="relative mb-6">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <Truck className="w-10 h-10 text-gray-400" />
      </div>
      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có xe nào</h3>
    <p className="text-sm text-gray-500 max-w-sm">
      Đơn vị vận tải này chưa có xe được đăng ký trong hệ thống
    </p>
  </div>
)

// Loading skeleton
const VehiclesSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gray-200" />
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-24 mb-1" />
            <div className="h-3 bg-gray-100 rounded w-16" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="h-14 bg-gray-100 rounded-xl" />
          <div className="h-14 bg-gray-100 rounded-xl" />
        </div>
        <div className="h-4 bg-gray-100 rounded w-20" />
      </div>
    ))}
  </div>
)

interface OperatorDetailDialogProps {
  open: boolean
  onClose: () => void
  operator: Operator | null
}

export function OperatorDetailDialog({
  open,
  onClose,
  operator,
}: OperatorDetailDialogProps) {
  const [activeTab, setActiveTab] = useState("vehicles")
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [paidDispatchRecords, setPaidDispatchRecords] = useState<DispatchRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && operator) {
      loadData()
    }
  }, [open, operator])

  const loadData = async () => {
    if (!operator) return

    setIsLoading(true)
    setError(null)
    try {
      // Check if this is a legacy operator (id starts with 'legacy_')
      const isLegacyOperator = operator.id.startsWith('legacy_')
      
      // Load vehicles - for non-legacy operators, exclude legacy vehicles for performance
      const vehiclesData = await vehicleService.getAll(operator.id, undefined, isLegacyOperator)
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : [])
      
      // Get vehicle IDs to fetch dispatch records
      const vehicleIds = Array.isArray(vehiclesData) ? vehiclesData.map(v => v.id) : []
      
      // Load invoices and all dispatch records in parallel
      const [invoicesData, allDispatchData] = await Promise.all([
        invoiceService.getAll(operator.id),
        // Get all dispatch records (we'll filter for paid/departed with payment later)
        vehicleIds.length > 0 
          ? Promise.all(vehicleIds.map(vehicleId => dispatchService.getAll(undefined, vehicleId)))
              .then(results => {
                const allRecords = results.flat()
                // Filter for records that have been paid (status = 'paid' or 'departed' with payment info)
                return allRecords.filter(record => 
                  (record.currentStatus === 'paid' || record.currentStatus === 'departed') &&
                  record.paymentTime && 
                  record.paymentAmount &&
                  record.paymentAmount > 0
                )
              })
          : Promise.resolve([])
      ])

      setInvoices(Array.isArray(invoicesData) ? invoicesData : [])
      setPaidDispatchRecords(Array.isArray(allDispatchData) ? allDispatchData : [])
    } catch (error: any) {
      console.error("Failed to load operator details:", error)
      const errorMessage = error?.response?.data?.error || error?.message || "Không thể tải thông tin chi tiết"
      setError(errorMessage)
      toast.error(errorMessage)
      setVehicles([])
      setInvoices([])
      setPaidDispatchRecords([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setActiveTab("vehicles")
    onClose()
  }

  if (!open || !operator) return null

  // Calculate debt (unpaid invoices)
  const unpaidInvoices = invoices.filter(
    (inv) => inv.paymentStatus === "pending" || inv.paymentStatus === "overdue"
  )
  const totalDebt = unpaidInvoices.reduce(
    (sum, inv) => sum + inv.totalAmount,
    0
  )

  // Payment history - combine paid invoices and paid dispatch records
  const paidInvoices = invoices.filter((inv) => inv.paymentStatus === "paid")
  
  // Create payment history items from dispatch records
  const paymentHistoryFromDispatch = paidDispatchRecords
    .filter(record => record.paymentTime && record.paymentAmount)
    .map(record => ({
      id: record.id,
      invoiceNumber: record.invoiceNumber || `DISPATCH-${record.id.substring(0, 8)}`,
      issueDate: record.entryTime,
      paymentDate: record.paymentTime,
      totalAmount: record.paymentAmount || 0,
      source: 'dispatch' as const,
      vehiclePlateNumber: record.vehiclePlateNumber,
      routeName: record.routeName,
    }))
  
  // Combine both sources and sort by payment date
  const allPaymentHistory = [
    ...paidInvoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      paymentDate: inv.paymentDate || inv.issueDate,
      totalAmount: inv.totalAmount,
      source: 'invoice' as const,
    })),
    ...paymentHistoryFromDispatch,
  ].sort((a, b) => {
    const dateA = a.paymentDate ? parseISO(a.paymentDate).getTime() : 0
    const dateB = b.paymentDate ? parseISO(b.paymentDate).getTime() : 0
    return dateB - dateA
  })

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return "N/A"
    try {
      const date = parseISO(dateString)
      return isValid(date) ? format(date, "dd/MM/yyyy") : "N/A"
    } catch {
      return "N/A"
    }
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      onClick={handleClose}
    >
      <div
        className="bg-white w-full h-full overflow-y-auto overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-[1920px] mx-auto p-8">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {operator.name}
                </h1>
                <p className="text-sm text-gray-500">Mã: {operator.code}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Car className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tổng số xe</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {vehicles.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tổng công nợ</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(totalDebt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Đã thanh toán</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(
                        allPaymentHistory.reduce(
                          (sum, item) => sum + item.totalAmount,
                          0
                        )
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tổng hóa đơn</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {invoices.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="vehicles">
                Xe trực thuộc ({vehicles.length})
              </TabsTrigger>
              <TabsTrigger value="debt">
                Công nợ ({unpaidInvoices.length})
              </TabsTrigger>
              <TabsTrigger value="payment-info">
                Thông tin thanh toán
              </TabsTrigger>
              <TabsTrigger value="payment-history">
                Lịch sử thanh toán ({allPaymentHistory.length})
              </TabsTrigger>
            </TabsList>

            {/* Vehicles Tab */}
            <TabsContent value="vehicles" className="mt-6">
              {/* Section header with stats */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Danh sách xe trực thuộc</h2>
                    <p className="text-sm text-gray-500">
                      {vehicles.length > 0 
                        ? `Tổng cộng ${vehicles.length} xe đang được quản lý`
                        : 'Chưa có xe nào được đăng ký'
                      }
                    </p>
                  </div>
                </div>

                {/* Quick stats pills */}
                {vehicles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      {vehicles.filter(v => v.isActive).length} hoạt động
                    </span>
                    {vehicles.filter(v => !v.isActive).length > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
                        <AlertCircle className="w-4 h-4" />
                        {vehicles.filter(v => !v.isActive).length} ngừng
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Vehicle cards grid */}
              {isLoading ? (
                <VehiclesSkeleton />
              ) : vehicles.length === 0 ? (
                <EmptyVehicles />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {vehicles.map((vehicle, index) => (
                    <VehicleCard key={vehicle.id} vehicle={vehicle} index={index} />
                  ))}
                </div>
              )}

              {/* CSS Animation */}
              <style>{`
                @keyframes slideUp {
                  from {
                    opacity: 0;
                    transform: translateY(20px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
              `}</style>
            </TabsContent>

            {/* Debt Tab */}
            <TabsContent value="debt" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Công nợ chưa thanh toán ({unpaidInvoices.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">Đang tải...</div>
                  ) : unpaidInvoices.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Không có công nợ
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 p-4 bg-red-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          Tổng công nợ:{" "}
                          <span className="text-xl font-bold text-red-600">
                            {formatCurrency(totalDebt)}
                          </span>
                        </p>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center">
                              Số hóa đơn
                            </TableHead>
                            <TableHead className="text-center">Ngày phát hành</TableHead>
                            <TableHead className="text-center">Hạn thanh toán</TableHead>
                            <TableHead className="text-center">Tổng tiền</TableHead>
                            <TableHead className="text-center">Trạng thái</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unpaidInvoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                              <TableCell className="font-medium text-center">
                                {invoice.invoiceNumber}
                              </TableCell>
                              <TableCell className="text-center">
                                {formatDate(invoice.issueDate)}
                              </TableCell>
                              <TableCell className="text-center">
                                {formatDate(invoice.dueDate)}
                              </TableCell>
                              <TableCell className="text-center">
                                {formatCurrency(invoice.totalAmount)}
                              </TableCell>
                              <TableCell className="text-center">
                                {invoice.paymentStatus === "overdue" ? (
                                  <StatusBadge status="inactive" />
                                ) : (
                                  <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                    Chưa thanh toán
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payment Info Tab */}
            <TabsContent value="payment-info" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin thanh toán</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Tổng quan</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tổng số hóa đơn:</span>
                          <span className="font-medium">{invoices.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Đã thanh toán:</span>
                          <span className="font-medium text-green-600">
                            {paidInvoices.length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Chưa thanh toán:</span>
                          <span className="font-medium text-red-600">
                            {unpaidInvoices.length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Quá hạn:</span>
                          <span className="font-medium text-red-600">
                            {
                              invoices.filter(
                                (inv) => inv.paymentStatus === "overdue"
                              ).length
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Tổng tiền</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tổng giá trị:</span>
                          <span className="font-medium">
                            {formatCurrency(
                              invoices.reduce(
                                (sum, inv) => sum + inv.totalAmount,
                                0
                              )
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Đã thanh toán:</span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(
                              allPaymentHistory.reduce(
                                (sum, item) => sum + item.totalAmount,
                                0
                              )
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Công nợ:</span>
                          <span className="font-medium text-red-600">
                            {formatCurrency(totalDebt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payment History Tab */}
            <TabsContent value="payment-history" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>
                      Lịch sử thanh toán ({allPaymentHistory.length})
                    </CardTitle>
                    {error && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadData}
                        className="text-sm"
                      >
                        Tải lại
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">Đang tải...</div>
                  ) : error ? (
                    <div className="text-center py-8">
                      <p className="text-red-600 mb-4">{error}</p>
                      <Button variant="outline" onClick={loadData}>
                        Thử lại
                      </Button>
                    </div>
                  ) : allPaymentHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>Chưa có lịch sử thanh toán</p>
                      <p className="text-sm mt-2">
                        Tổng số hóa đơn: {invoices.length} | 
                        Đã thanh toán (invoice): {paidInvoices.length} | 
                        Đã thanh toán (dispatch): {paidDispatchRecords.length} |
                        Chưa thanh toán: {unpaidInvoices.length}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 p-4 bg-green-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          Tổng đã thanh toán:{" "}
                          <span className="text-xl font-bold text-green-600">
                            {formatCurrency(
                              allPaymentHistory.reduce(
                                (sum, item) => sum + item.totalAmount,
                                0
                              )
                            )}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Bao gồm: {paidInvoices.length} hóa đơn và {paidDispatchRecords.length} đơn hàng đã thanh toán
                        </p>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center">
                              Số hóa đơn/Mã đơn
                            </TableHead>
                            <TableHead className="text-center">Ngày phát hành</TableHead>
                            <TableHead className="text-center">Ngày thanh toán</TableHead>
                            <TableHead className="text-center">Tổng tiền</TableHead>
                            <TableHead className="text-center">Nguồn</TableHead>
                            <TableHead className="text-center">Trạng thái</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allPaymentHistory.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium text-center">
                                {item.invoiceNumber}
                                {item.source === 'dispatch' && (
                                  <span className="ml-1 text-xs text-gray-500">
                                    ({'vehiclePlateNumber' in item ? item.vehiclePlateNumber : ''})
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {formatDate(item.issueDate)}
                              </TableCell>
                              <TableCell className="text-center">
                                {formatDate(item.paymentDate)}
                              </TableCell>
                              <TableCell className="text-center">
                                {formatCurrency(item.totalAmount)}
                              </TableCell>
                              <TableCell className="text-center">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  item.source === 'invoice' 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {item.source === 'invoice' ? 'Hóa đơn' : 'Đơn hàng'}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <StatusBadge status="active" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>,
    document.body
  )
}

