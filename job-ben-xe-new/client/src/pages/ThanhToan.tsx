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
  RotateCw,
} from "lucide-react"
import { iconStyles } from "@/lib/icon-theme"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { dispatchService } from "@/services/dispatch.service"
import { serviceChargeService } from "@/services/service-charge.service"
import type { DispatchRecord, ServiceCharge, ServiceType, ServiceChargeInput } from "@/types"
import { format } from "date-fns"
import { useUIStore } from "@/store/ui.store"
import * as XLSX from "xlsx"
import { DatePickerRange } from "@/components/DatePickerRange"
import { type DateRange } from "react-day-picker"

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
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date()
    const fromDate = new Date(today.setHours(0, 0, 0, 0))
    const toDate = new Date(today.setHours(23, 59, 59, 999))
    return {
      from: fromDate,
      to: toDate,
    }
  })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target as Node)) {
        setShowServiceDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
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

  // Auto-filter when dateRange or orderType changes
  useEffect(() => {
    if (!id && allData.length > 0) {
      applyFilters()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, orderType, allData.length, id])

  const applyFilters = () => {
    let filtered = [...allData]
    
    // Filter by date
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
    
    // Filter by order type (if needed in the future)
    // For now, orderType filter is not implemented as there's no field in DispatchRecord
    // This can be extended later based on business requirements
    
    // Sort by entry time desc
    filtered.sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime())
    
    setListData(filtered)
    
    // Clear selection for items that no longer exist or have been paid
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
      // Fetch all records
      const data = await dispatchService.getAll()
      setAllData(data)
      
      // Apply filters will be triggered by useEffect
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
      // Prepare data for Excel
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
        "Ngày áp dụng": format(new Date(item.entryTime), "dd/MM/yyyy"),
        "Người tạo": item.entryBy || "-",
        "Ca trực": "-",
        "Tổng tiền (đồng)": item.paymentAmount || 0,
        "Trạng thái": item.currentStatus === 'paid' ? 'Đã thanh toán' : 
                      item.currentStatus === 'departed' ? 'Đã xuất bến' : 'Chưa thanh toán'
      }))

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Danh sách đơn hàng")

      // Set column widths
      const colWidths = [
        { wch: 5 },   // STT
        { wch: 15 },  // Mã đơn hàng
        { wch: 15 },  // Biển kiểm soát
        { wch: 25 },  // Đơn vị vận tải
        { wch: 20 },  // Tuyến vận chuyển
        { wch: 15 },  // Giờ xuất bến KH
        { wch: 20 },  // Ngày tạo
        { wch: 15 },  // Ngày áp dụng
        { wch: 15 },  // Người tạo
        { wch: 10 },  // Ca trực
        { wch: 18 },  // Tổng tiền
        { wch: 15 },  // Trạng thái
      ]
      ws['!cols'] = colWidths

      // Generate filename with date range
      const fromDateStr = dateRange?.from ? format(dateRange.from, "dd-MM-yyyy") : format(new Date(), "dd-MM-yyyy")
      const toDateStr = dateRange?.to ? format(dateRange.to, "dd-MM-yyyy") : format(new Date(), "dd-MM-yyyy")
      const filename = `Danh-sach-don-hang_${fromDateStr}_${toDateStr}.xlsx`

      // Write file
      XLSX.writeFile(wb, filename)
      
      toast.success(`Đã xuất Excel thành công: ${filename}`)
    } catch (error) {
      console.error("Failed to export Excel:", error)
      toast.error("Không thể xuất Excel. Vui lòng thử lại sau.")
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
      
      // Set default note
      if (recordData) {
        setNote(`Đơn hàng điều độ (${format(new Date(recordData.entryTime), "dd/MM/yyyy HH:mm")})`)
      }
    } catch (error) {
      console.error("Failed to load payment data:", error)
      toast.error("Không thể tải dữ liệu thanh toán. Vui lòng thử lại sau.")
      navigate("/dieu-do")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const calculateTotals = () => {
    const subtotal = serviceCharges.reduce((sum, charge) => sum + charge.totalAmount, 0)
    const discount = 0 // Có thể tính từ serviceCharges nếu có
    const tax = 0 // Có thể tính từ serviceCharges nếu có
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
      toast.error("Không thể xử lý thanh toán. Vui lòng thử lại sau.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePayment = async () => {
    if (!record) return

    const { total } = calculateTotals()
    
    // Kiểm tra nếu tổng tiền = 0, hiển thị modal cảnh báo
    if (total === 0) {
      setShowZeroAmountWarning(true)
      return
    }
    
    // Nếu có tiền, thanh toán trực tiếp
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
    // Ensure the order section is expanded
    const orderId = record?.transportOrderCode || `ORDER-${id?.slice(0, 8)}`
    setExpandedOrders(prev => {
      const newSet = new Set(prev)
      newSet.add(orderId)
      return newSet
    })
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
      
      // Reload service charges
      const chargesData = await serviceChargeService.getAll(id)
      setServiceCharges(chargesData)
      
      // Reset form and close adding mode
      setNewService({
        serviceTypeId: "",
        serviceName: "",
        quantity: 1,
        unitPrice: 0,
      })
      setIsAddingService(false)
      toast.success("Thêm dịch vụ thành công!")
    } catch (error) {
      console.error("Failed to add service:", error)
      toast.error("Không thể thêm dịch vụ. Vui lòng thử lại sau.")
    }
  }

  const handleCancelService = () => {
    setIsAddingService(false)
    setNewService({
      serviceTypeId: "",
      serviceName: "",
      quantity: 1,
      unitPrice: 0,
    })
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
    if (!window.confirm("Bạn có chắc chắn muốn xóa dịch vụ này?")) {
      return
    }

    if (!id) return

    try {
      await serviceChargeService.delete(chargeId)
      
      // Reload service charges
      const chargesData = await serviceChargeService.getAll(id)
      setServiceCharges(chargesData)
      
      toast.success("Xóa dịch vụ thành công!")
    } catch (error) {
      console.error("Failed to delete service:", error)
      toast.error("Không thể xóa dịch vụ. Vui lòng thử lại sau.")
    }
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const handleBatchPayment = () => {
    if (selectedItems.size === 0) {
      toast.warning("Vui lòng chọn ít nhất một đơn hàng để thanh toán")
      return
    }

    // Get the first selected item
    const selectedRecord = listData.find(item => selectedItems.has(item.id))
    
    if (selectedRecord) {
      // Navigate to payment page for the selected item
      navigate(`/thanh-toan/${selectedRecord.id}`)
    }
  }

  // Render List View if no ID
  if (!id) {
    return (
      <div className="h-full flex flex-col">
        {/* Filters */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-end gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 sm:min-w-[280px] lg:w-96">
                    <Label className="text-xs text-gray-500 mb-1 block">Khoảng thời gian (*)</Label>
                    <DatePickerRange
                      range={dateRange}
                      onRangeChange={setDateRange}
                      placeholder="Chọn khoảng thời gian"
                      label=""
                      className="w-full"
                    />
                </div>
                <div className="flex-1 min-w-0 sm:min-w-[180px] lg:w-48">
                    <Label className="text-xs text-gray-500 mb-1 block">Loại đơn hàng (*)</Label>
                    <Select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="w-full">
                        <option value="all">Tất cả</option>
                        <option value="thanh-toan-chuyen">Thanh toán chuyến</option>
                        <option value="thanh-toan-dinh-ky">Thanh toán định kỳ</option>
                        <option value="thanh-toan-truy-thu">Thanh toán truy thu</option>
                        <option value="khac">Khác</option>
                        <option value="thanh-toan-khong-du-dieu-kien">Thanh toán không đủ điều kiện</option>
                        <option value="thanh-toan-chuyen-tang-cuong">Thanh toán chuyến (Tăng cường)</option>
                        <option value="thanh-toan-vang-lai">Thanh toán vãng lai</option>
                    </Select>
                </div>
            </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white p-2 sm:p-3 rounded-t-lg border-b">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
                    <Button variant="ghost" size="icon" title="Làm mới" onClick={loadListData} className="shrink-0">
                        <RefreshCw className={iconStyles.infoIcon} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Xuất Excel" onClick={handleExportExcel} className="shrink-0">
                        <FileSpreadsheet className={iconStyles.infoIcon} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Thêm mới" onClick={() => navigate("/thanh-toan/tao-moi")} className="shrink-0">
                        <Plus className={iconStyles.successIcon} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Tải lại" onClick={loadListData} className="shrink-0">
                        <RotateCw className={iconStyles.infoIcon} />
                    </Button>
                    {selectedItems.size > 0 && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="gap-2 bg-green-600 hover:bg-green-700 ml-2 shrink-0 text-xs sm:text-sm"
                        onClick={handleBatchPayment}
                      >
                        <span className="hidden sm:inline">THANH TOÁN</span>
                        <span className="sm:hidden">TT</span>
                        {selectedItems.size > 1 ? ` (${selectedItems.size})` : ''}
                      </Button>
                    )}
                </div>
                <div className="w-full sm:w-auto">
                     <Button variant="secondary" size="sm" className="gap-2 w-full sm:w-auto text-xs sm:text-sm">
                        <span className="hidden sm:inline">Loại thanh toán</span>
                        <span className="sm:hidden">Loại TT</span>
                        <ChevronUp className={iconStyles.navigationIcon} />
                     </Button>
                </div>
            </div>
        </div>

        {/* Table - Desktop */}
        <div className="bg-white flex-1 overflow-auto border rounded-b-lg hidden md:block">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Mã đơn hàng</TableHead>
                        <TableHead>Biển kiểm soát</TableHead>
                        <TableHead>Đơn vị vận tải</TableHead>
                        <TableHead>Tuyến vận chuyển</TableHead>
                        <TableHead>Giờ xuất bến KH</TableHead>
                        <TableHead>Ngày tạo</TableHead>
                        <TableHead>Ngày áp dụng</TableHead>
                        <TableHead>Người tạo</TableHead>
                        <TableHead>Ca trực</TableHead>
                        <TableHead>Tổng tiền (đồng)</TableHead>
                        <TableHead>Trạng thái</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={12} className="text-center py-20 text-gray-500">
                                <div className="flex justify-center items-center gap-2">
                                    <RefreshCw className={`${iconStyles.infoIcon} animate-spin`} />
                                    Đang tải dữ liệu...
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : listData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={12} className="text-center py-20 text-gray-500">
                                Không có dữ liệu!
                            </TableCell>
                        </TableRow>
                    ) : (
                        listData.map(item => {
                            const isPaid = item.currentStatus === 'paid' || item.currentStatus === 'departed'
                            const isSelected = selectedItems.has(item.id)
                            
                            return (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        {!isPaid && (
                                            <Checkbox 
                                                checked={isSelected}
                                                onChange={() => toggleItemSelection(item.id)}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>{item.transportOrderCode || item.id.substring(0, 8)}</TableCell>
                                    <TableCell>{item.vehiclePlateNumber}</TableCell>
                                    <TableCell>{item.vehicle?.operator?.name}</TableCell>
                                    <TableCell>{item.routeName}</TableCell>
                                    <TableCell>{item.plannedDepartureTime ? format(new Date(item.plannedDepartureTime), "HH:mm") : "-"}</TableCell>
                                    <TableCell>{format(new Date(item.entryTime), "dd/MM/yyyy HH:mm")}</TableCell>
                                    <TableCell>{format(new Date(item.entryTime), "dd/MM/yyyy")}</TableCell>
                                    <TableCell>{item.entryBy || "-"}</TableCell>
                                    <TableCell>-</TableCell>
                                    <TableCell>{item.paymentAmount?.toLocaleString('vi-VN') || 0}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                            item.currentStatus === 'paid' ? 'bg-green-100 text-green-800' : 
                                            item.currentStatus === 'departed' ? 'bg-gray-100 text-gray-800' : 
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {item.currentStatus === 'paid' ? 'Đã thanh toán' : 
                                             item.currentStatus === 'departed' ? 'Đã xuất bến' : 'Chưa thanh toán'}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            )
                        })
                    )}
                </TableBody>
            </Table>
        </div>

        {/* Mobile Card Layout */}
        <div className="md:hidden bg-white flex-1 overflow-auto border rounded-b-lg">
            {isLoading ? (
                <div className="text-center py-20 text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                        <RefreshCw className={`${iconStyles.infoIcon} animate-spin`} />
                        Đang tải dữ liệu...
                    </div>
                </div>
            ) : listData.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    Không có dữ liệu!
                </div>
            ) : (
                <div className="p-3 space-y-3">
                    {listData.map(item => (
                        <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={selectedItems.has(item.id)}
                                        onChange={(checked) => {
                                            const newSelected = new Set(selectedItems)
                                            if (checked) {
                                                newSelected.add(item.id)
                                            } else {
                                                newSelected.delete(item.id)
                                            }
                                            setSelectedItems(newSelected)
                                        }}
                                    />
                                    <span className="font-semibold text-blue-600 text-sm">
                                        {item.transportOrderCode || item.id.slice(-8)}
                                    </span>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    item.currentStatus === 'paid' 
                                        ? 'bg-green-100 text-green-800'
                                        : item.currentStatus === 'departed'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {item.currentStatus === 'paid' ? 'Đã thanh toán' : 
                                     item.currentStatus === 'departed' ? 'Đã xuất bến' : 'Chưa thanh toán'}
                                </span>
                            </div>
                            
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Biển số:</span>
                                    <span className="font-medium">{item.vehiclePlateNumber}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Đơn vị:</span>
                                    <span className="font-medium text-right">{item.vehicle?.operator?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Tuyến:</span>
                                    <span className="font-medium text-right">{item.routeName || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Xuất bến:</span>
                                    <span className="font-medium">
                                        {item.plannedDepartureTime 
                                            ? format(new Date(item.plannedDepartureTime), "HH:mm") 
                                            : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Ngày tạo:</span>
                                    <span className="font-medium">
                                        {format(new Date(item.entryTime), "dd/MM/yyyy")}
                                    </span>
                                </div>
                                <div className="flex justify-between border-t pt-2 mt-2">
                                    <span className="text-gray-600">Tổng tiền:</span>
                                    <span className="font-bold text-green-600">
                                        {(item.paymentAmount || 0).toLocaleString()} đ
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="bg-white p-2 border-t flex justify-between items-center text-sm mt-auto">
            <div className="font-medium">Tổng: {listData.length} đơn hàng</div>
            <div className="font-bold">{listData.reduce((sum, item) => sum + (item.paymentAmount || 0), 0).toLocaleString('vi-VN')}</div>
        </div>
      </div>
    )
  }

  // Detail View Logic
  const { subtotal, discount, tax, total } = calculateTotals()
  const orderId = record?.transportOrderCode || `ORDER-${id?.slice(0, 8)}`
  const isExpanded = expandedOrders.has(orderId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600">Không tìm thấy thông tin thanh toán</p>
          <Button onClick={() => navigate("/dieu-do")} className="mt-4">
            Quay lại
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-600">
        Quản lý đơn hàng &gt; Thanh toán
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {/* Service List Table */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Danh sách dịch vụ</h2>
                <Button
                  onClick={handleAddServiceClick}
                  size="sm"
                  className="gap-2 w-full sm:w-auto"
                >
                  <Plus className={iconStyles.successIcon} />
                  <span className="hidden sm:inline">Thêm dịch vụ</span>
                  <span className="sm:hidden">Thêm</span>
                </Button>
              </div>
            </CardContent>
            <CardContent className="p-0 pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Dịch vụ</TableHead>
                    <TableHead className="text-center">Đơn giá (đ)</TableHead>
                    <TableHead className="text-center">Số lượng</TableHead>
                    <TableHead className="text-center">Chiết khấu (đ)</TableHead>
                    <TableHead className="text-center">Chiết khấu (%)</TableHead>
                    <TableHead className="text-center">Phần trăm thuế (%)</TableHead>
                    <TableHead className="text-center">Thành tiền (đ)</TableHead>
                    <TableHead className="text-center">Nợ</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Add Service Row */}
                  {isAddingService && (
                    <TableRow className="bg-blue-50">
                      <TableCell className="p-2">
                        <div className="relative" ref={serviceDropdownRef}>
                          <Input
                            value={newService.serviceName}
                            onChange={(e) => {
                              setNewService({ ...newService, serviceName: e.target.value })
                              setShowServiceDropdown(true)
                            }}
                            onFocus={() => setShowServiceDropdown(true)}
                            placeholder="Tên dịch vụ"
                            className="h-8 w-full"
                          />
                          {showServiceDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                              {serviceTypes.filter(t => t.name.toLowerCase().includes(newService.serviceName.toLowerCase())).length > 0 ? (
                                serviceTypes.filter(t => t.name.toLowerCase().includes(newService.serviceName.toLowerCase())).map((type) => (
                                  <div
                                    key={type.id}
                                    onClick={() => {
                                      handleServiceTypeChange(type.id)
                                      setShowServiceDropdown(false)
                                    }}
                                    className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm"
                                  >
                                    {type.name}
                                  </div>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-gray-500 text-sm">
                                  Không tìm thấy kết quả
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-2 text-center">
                        <Input
                          type="number"
                          min="0"
                          value={newService.unitPrice}
                          onChange={(e) => setNewService({ ...newService, unitPrice: parseFloat(e.target.value) || 0 })}
                          className="h-8 w-24 mx-auto"
                        />
                      </TableCell>
                      <TableCell className="p-2 text-center">
                        <Input
                          type="number"
                          min="1"
                          value={newService.quantity}
                          onChange={(e) => setNewService({ ...newService, quantity: parseInt(e.target.value) || 1 })}
                          className="h-8 w-20 mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-center">0</TableCell>
                      <TableCell className="text-center">0</TableCell>
                      <TableCell className="text-center">0</TableCell>
                      <TableCell className="font-medium text-center">
                        {(newService.quantity * newService.unitPrice).toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox disabled className="mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleSaveService}
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Check className={iconStyles.successIcon} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCancelService}
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className={iconStyles.deleteButton} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Collapsible Order Row */}
                  <TableRow className="bg-gray-50">
                    <TableCell colSpan={9} className="p-0">
                      <button
                        onClick={() => toggleOrder(orderId)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-100"
                      >
                        <span className="font-medium">
                          Mã đơn hàng: {orderId} ({format(new Date(record.entryTime), "dd/MM/yyyy")})
                        </span>
                        {isExpanded ? (
                          <ChevronUp className={iconStyles.navigationIcon} />
                        ) : (
                          <ChevronDown className={iconStyles.navigationIcon} />
                        )}
                      </button>
                    </TableCell>
                  </TableRow>

                  {/* Service Items */}
                  {isExpanded && (
                    <>
                      {serviceCharges.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                            Không có dịch vụ
                          </TableCell>
                        </TableRow>
                      ) : (
                        serviceCharges.map((charge) => (
                          <TableRow key={charge.id}>
                            <TableCell className="font-medium">
                              {charge.serviceType?.name || "Dịch vụ"}
                            </TableCell>
                            <TableCell className="text-center">{charge.unitPrice.toLocaleString('vi-VN')}</TableCell>
                            <TableCell className="text-center">{charge.quantity}</TableCell>
                            <TableCell className="text-center">0</TableCell>
                            <TableCell className="text-center">0</TableCell>
                            <TableCell className="text-center">0</TableCell>
                            <TableCell className="font-medium text-center">
                              {charge.totalAmount.toLocaleString('vi-VN')}
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox className="mx-auto" />
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteService(charge.id)}
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className={iconStyles.deleteButton} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}

                      {/* Total Row */}
                      <TableRow className="bg-gray-50 font-semibold">
                        <TableCell colSpan={6} className="text-right">
                          Tổng tiền:
                        </TableCell>
                        <TableCell>
                          {subtotal.toLocaleString('vi-VN')}₫
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Control Sheet */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 mb-3">Biên kiểm soát</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Biến kiểm soát:</span>
                  <span className="ml-2 font-medium">{record.vehiclePlateNumber}</span>
                </div>
                <div>
                  <span className="text-gray-600">Tuyến vận chuyển:</span>
                  <span className="ml-2 font-medium">{record.routeName || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Giờ vào bến:</span>
                  <span className="ml-2 font-medium">
                    {format(new Date(record.entryTime), "HH:mm dd/MM/yyyy")}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Số ghế | Số giường:</span>
                  <span className="ml-2 font-medium">
                    {record.seatCount || '-'} | 41
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Giờ xuất bến kế hoạch:</span>
                  <span className="ml-2 font-medium">
                    {record.plannedDepartureTime 
                      ? format(new Date(record.plannedDepartureTime), "HH:mm dd/MM/yyyy")
                      : '-'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="destructive" onClick={handleCancel}>
              HỦY THANH TOÁN
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                if (record?.vehiclePlateNumber) {
                  navigate(`/bao-cao/xe-tra-khach?vehiclePlateNumber=${encodeURIComponent(record.vehiclePlateNumber)}&returnTo=/thanh-toan/${id}`)
                }
              }}
            >
              <FileText className={iconStyles.infoIcon} />
              LỊCH SỬ XE TRẢ KHÁCH
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                if (record?.vehiclePlateNumber) {
                  navigate(`/bao-cao/xe-ra-vao-ben?vehiclePlateNumber=${encodeURIComponent(record.vehiclePlateNumber)}&returnTo=/thanh-toan/${id}`)
                }
              }}
            >
              <FileText className={iconStyles.infoIcon} />
              LỊCH SỬ XE RA VÀO BẾN
            </Button>
          </div>
        </div>

        {/* Right Column - Payment Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Thanh toán</h2>

              {/* Symbol */}
              <div>
                <Label htmlFor="symbol">Ký hiệu:</Label>
                <Select
                  id="symbol"
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
                <Label htmlFor="note">Ghi chú</Label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Ghi chú..."
                />
              </div>

              {/* Customer Info */}
              <div className="pt-4 border-t space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Người mua:</span>
                  <span className="ml-2 font-medium">
                    {record.driverName || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Đơn vị vận tải:</span>
                  <span className="ml-2 font-medium">
                    {record.vehicle?.operator?.name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Mã số thuế:</span>
                  <span className="ml-2 font-medium">
                    {record.vehicle?.operator?.taxCode || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Địa chỉ:</span>
                  <span className="ml-2 font-medium">
                    {record.vehicle?.operator?.address || '-'}
                  </span>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="pt-4 border-t space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tổng tiền:</span>
                  <span className="font-medium">{subtotal.toLocaleString('vi-VN')} đồng</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Chiết khấu:</span>
                  <span className="font-medium">{discount.toLocaleString('vi-VN')} đồng</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tiền thuế GTGT:</span>
                  <span className="font-medium">{tax.toLocaleString('vi-VN')} đồng</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-bold text-lg">
                  <span>Thực thu:</span>
                  <span className="text-blue-600">{total.toLocaleString('vi-VN')} đồng</span>
                </div>
              </div>

              {/* Print Options */}
              <div className="pt-4 border-t space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="printOne"
                    checked={printOneCopy}
                    onChange={(e) => {
                      setPrintOneCopy(e.target.checked)
                      if (e.target.checked) setPrintTwoCopies(false)
                    }}
                  />
                  <Label htmlFor="printOne" className="cursor-pointer text-sm">
                    In 1 liên
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="printTwo"
                    checked={printTwoCopies}
                    onChange={(e) => {
                      setPrintTwoCopies(e.target.checked)
                      if (e.target.checked) setPrintOneCopy(false)
                    }}
                  />
                  <Label htmlFor="printTwo" className="cursor-pointer text-sm">
                    In 2 liên
                  </Label>
                </div>
              </div>

              {/* Final Action Buttons */}
              <div className="pt-4 border-t space-y-2">
                <Button variant="outline" className="w-full" onClick={() => {
                  // TODO: Implement print preview
                  toast.info("Chức năng xem trước bản in đang được phát triển")
                }}>
                  <Printer className={iconStyles.infoIcon} />
                  XEM TRƯỚC BẢN IN
                </Button>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handlePayment}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Đang xử lý..." : "THANH TOÁN"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Zero Amount Warning Dialog */}
      <Dialog open={showZeroAmountWarning} onOpenChange={setShowZeroAmountWarning}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={() => setShowZeroAmountWarning(false)} />
          <DialogHeader>
            <DialogTitle>Cảnh báo thanh toán</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700">
              Tổng tiền thanh toán là <span className="font-bold text-red-600">0 đồng</span>.
            </p>
            <p className="text-gray-600 mt-2">
              Bạn có chắc chắn muốn tiếp tục thanh toán?
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowZeroAmountWarning(false)}
            >
              Hủy
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleConfirmZeroAmountPayment}
              disabled={isProcessing}
            >
              {isProcessing ? "Đang xử lý..." : "Xác nhận thanh toán"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

