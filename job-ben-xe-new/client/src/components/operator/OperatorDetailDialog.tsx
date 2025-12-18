import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { X, Car, DollarSign, FileText, TrendingUp, Building2 } from "lucide-react"
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
      // Load vehicles first
      const vehiclesData = await vehicleService.getAll(operator.id)
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
      
      console.log("Loaded vehicles:", vehiclesData)
      console.log("Loaded invoices:", invoicesData)
      console.log("Loaded paid/dispatched dispatch records:", allDispatchData)
      console.log("Invoice count:", invoicesData?.length || 0)
      console.log("Paid invoices:", invoicesData?.filter((inv) => inv.paymentStatus === "paid") || [])
      console.log("Paid/dispatched dispatch records count:", allDispatchData?.length || 0)
      
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
              <Card>
                <CardHeader>
                  <CardTitle>Danh sách xe trực thuộc</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">Đang tải...</div>
                  ) : vehicles.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Không có xe nào
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-center">Biển số</TableHead>
                          <TableHead className="text-center">Loại xe</TableHead>
                          <TableHead className="text-center">
                            Số ghế/Giường
                          </TableHead>
                          <TableHead className="text-center">Tỉnh/TP</TableHead>
                          <TableHead className="text-center">Trạng thái</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vehicles.map((vehicle) => (
                          <TableRow key={vehicle.id}>
                            <TableCell className="font-medium text-center">
                              {vehicle.plateNumber}
                            </TableCell>
                            <TableCell className="text-center">
                              {vehicle.vehicleType?.name || "N/A"}
                            </TableCell>
                            <TableCell className="text-center">
                              {vehicle.seatCapacity}
                              {vehicle.bedCapacity
                                ? ` / ${vehicle.bedCapacity}`
                                : ""}
                            </TableCell>
                            <TableCell className="text-center">
                              {vehicle.province || "N/A"}
                            </TableCell>
                            <TableCell className="text-center">
                              <StatusBadge
                                status={vehicle.isActive ? "active" : "inactive"}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
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

