import { useState, useEffect, useRef } from "react"
import { toast } from "react-toastify"
import { Search, Eye, Download, Plus, Edit, Trash2, Upload, FileSpreadsheet } from "lucide-react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/layout/StatusBadge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { vehicleBadgeService, type VehicleBadge, type CreateVehicleBadgeInput } from "@/services/vehicle-badge.service"
import { useUIStore } from "@/store/ui.store"

// Helper function to format date
const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) return "N/A"
  // Handle DD/MM/YYYY format
  if (dateString.includes("/")) {
    return dateString
  }
  // Try to parse ISO date
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "N/A"
    return date.toLocaleDateString("vi-VN")
  } catch {
    return dateString
  }
}

// Helper function to get status badge variant based on Vietnamese status text
const getStatusVariant = (status: string): "active" | "inactive" | "maintenance" => {
  if (!status) return "inactive"
  const statusLower = status.toLowerCase()
  // "Còn hiệu lực", "Cấp mới" etc. are active
  if (statusLower.includes("hiệu lực") || statusLower.includes("cấp mới") || statusLower.includes("cap moi")) {
    return "active"
  }
  // "Hết hạn" is expired/inactive
  if (statusLower.includes("hết") || statusLower.includes("het")) {
    return "inactive"
  }
  // "Thu hồi" is revoked/maintenance
  if (statusLower.includes("thu hồi") || statusLower.includes("thu hoi")) {
    return "maintenance"
  }
  return "active" // Default to active for other statuses
}

export default function QuanLyPhuHieuXe() {
  const [badges, setBadges] = useState<VehicleBadge[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterBadgeType, setFilterBadgeType] = useState("")
  const [filterBadgeColor, setFilterBadgeColor] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedBadge, setSelectedBadge] = useState<VehicleBadge | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [badgeToDelete, setBadgeToDelete] = useState<VehicleBadge | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importData, setImportData] = useState<CreateVehicleBadgeInput[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState<CreateVehicleBadgeInput>({
    badge_number: "",
    license_plate_sheet: "",
    badge_type: "",
    badge_color: "",
    issue_date: "",
    expiry_date: "",
    status: "Còn hiệu lực",
    file_code: "",
    issue_type: "Cấp mới",
    bus_route_ref: "",
    vehicle_type: "",
    notes: "",
  })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Quản lý phù hiệu xe")
    loadBadges()
  }, [setTitle])

  const loadBadges = async (forceRefresh = false) => {
    setIsLoading(true)
    try {
      const data = await vehicleBadgeService.getAll(forceRefresh)
      setBadges(data)
    } catch (error) {
      console.error("Failed to load vehicle badges:", error)
      toast.error("Không thể tải danh sách phù hiệu xe. Vui lòng thử lại sau.")
    } finally {
      setIsLoading(false)
    }
  }

  // Get unique values for filters - only from allowed badge types
  const allowedTypesForFilters = ["Buýt", "Tuyến cố định"]
  const filteredByTypeOnly = badges.filter(b => allowedTypesForFilters.includes(b.badge_type || ""))
  const badgeStatuses = Array.from(new Set(filteredByTypeOnly.map((b) => b.status).filter(Boolean))).sort()
  const badgeTypes = allowedTypesForFilters // Only show allowed types in dropdown
  const badgeColors = Array.from(new Set(filteredByTypeOnly.map((b) => b.badge_color).filter(Boolean))).sort()

  // Only show "Buýt" and "Tuyến cố định" badge types
  const allowedBadgeTypes = ["Buýt", "Tuyến cố định"]
  
  const filteredBadges = badges.filter((badge) => {
    // Filter by allowed badge types (Buýt and Tuyến cố định only)
    if (!allowedBadgeTypes.includes(badge.badge_type || "")) {
      return false
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        badge.badge_number.toLowerCase().includes(query) ||
        badge.license_plate_sheet.toLowerCase().includes(query) ||
        badge.file_code.toLowerCase().includes(query) ||
        (badge.vehicle_id && badge.vehicle_id.toLowerCase().includes(query))
      if (!matchesSearch) return false
    }

    // Status filter (based on status: active/expired/revoked)
    if (filterStatus && badge.status !== filterStatus) {
      return false
    }

    // Badge type filter
    if (filterBadgeType && badge.badge_type !== filterBadgeType) {
      return false
    }

    // Badge color filter
    if (filterBadgeColor && badge.badge_color !== filterBadgeColor) {
      return false
    }

    return true
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredBadges.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedBadges = filteredBadges.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterStatus, filterBadgeType, filterBadgeColor])

  const handleView = (badge: VehicleBadge) => {
    setSelectedBadge(badge)
    setViewDialogOpen(true)
  }

  const handleCreate = () => {
    setFormMode("create")
    setFormData({
      badge_number: "",
      license_plate_sheet: "",
      badge_type: "",
      badge_color: "",
      issue_date: "",
      expiry_date: "",
      status: "Còn hiệu lực",
      file_code: "",
      issue_type: "Cấp mới",
      bus_route_ref: "",
      vehicle_type: "",
      notes: "",
    })
    setFormDialogOpen(true)
  }

  const handleEdit = (badge: VehicleBadge) => {
    setFormMode("edit")
    setSelectedBadge(badge)
    setFormData({
      badge_number: badge.badge_number,
      license_plate_sheet: badge.license_plate_sheet,
      badge_type: badge.badge_type || "",
      badge_color: badge.badge_color || "",
      issue_date: badge.issue_date || "",
      expiry_date: badge.expiry_date || "",
      status: badge.status || "Còn hiệu lực",
      file_code: badge.file_code || "",
      issue_type: badge.issue_type || "Cấp mới",
      bus_route_ref: badge.bus_route_ref || "",
      vehicle_type: badge.vehicle_type || "",
      notes: badge.notes || "",
    })
    setFormDialogOpen(true)
  }

  const handleDelete = (badge: VehicleBadge) => {
    setBadgeToDelete(badge)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!badgeToDelete) return

    try {
      await vehicleBadgeService.delete(badgeToDelete.id)
      toast.success("Xóa phù hiệu thành công")
      loadBadges(true)
      setDeleteDialogOpen(false)
      setBadgeToDelete(null)
    } catch (error) {
      console.error("Failed to delete badge:", error)
      toast.error("Không thể xóa phù hiệu. Vui lòng thử lại sau.")
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.badge_number || !formData.license_plate_sheet) {
      toast.error("Vui lòng nhập số phù hiệu và biển số xe")
      return
    }

    setIsSubmitting(true)
    try {
      if (formMode === "create") {
        await vehicleBadgeService.create(formData)
        toast.success("Thêm phù hiệu mới thành công")
      } else {
        if (!selectedBadge) return
        await vehicleBadgeService.update(selectedBadge.id, formData)
        toast.success("Cập nhật phù hiệu thành công")
      }
      setFormDialogOpen(false)
      loadBadges(true)
    } catch (error: any) {
      console.error("Failed to save badge:", error)
      const errorMessage = error.response?.data?.error || "Không thể lưu phù hiệu. Vui lòng thử lại sau."
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: "binary" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]

        if (jsonData.length < 2) {
          toast.error("File Excel không có dữ liệu")
          return
        }

        // Get headers from first row
        const headers = jsonData[0].map((h) => h?.toString().toLowerCase().trim() || "")
        
        // Map Vietnamese headers to field names
        const headerMap: Record<string, string> = {
          "số phù hiệu": "badge_number",
          "so phu hieu": "badge_number",
          "biển số xe": "license_plate_sheet",
          "bien so xe": "license_plate_sheet",
          "biển số": "license_plate_sheet",
          "bien so": "license_plate_sheet",
          "loại phù hiệu": "badge_type",
          "loai phu hieu": "badge_type",
          "màu phù hiệu": "badge_color",
          "mau phu hieu": "badge_color",
          "màu": "badge_color",
          "mau": "badge_color",
          "ngày cấp": "issue_date",
          "ngay cap": "issue_date",
          "ngày hết hạn": "expiry_date",
          "ngay het han": "expiry_date",
          "trạng thái": "status",
          "trang thai": "status",
          "mã hồ sơ": "file_code",
          "ma ho so": "file_code",
          "loại cấp": "issue_type",
          "loai cap": "issue_type",
          "tuyến đường": "bus_route_ref",
          "tuyen duong": "bus_route_ref",
          "loại xe": "vehicle_type",
          "loai xe": "vehicle_type",
          "ghi chú": "notes",
          "ghi chu": "notes",
        }

        // Find column indices
        const columnMap: Record<string, number> = {}
        headers.forEach((header, index) => {
          const fieldName = headerMap[header]
          if (fieldName) {
            columnMap[fieldName] = index
          }
        })

        // Check required columns
        if (columnMap["badge_number"] === undefined || columnMap["license_plate_sheet"] === undefined) {
          toast.error("File Excel phải có cột 'Số phù hiệu' và 'Biển số xe'")
          return
        }

        // Parse data rows
        const parsedData: CreateVehicleBadgeInput[] = []
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row || row.length === 0) continue

          const badgeNumber = row[columnMap["badge_number"]]?.toString().trim()
          const plateNumber = row[columnMap["license_plate_sheet"]]?.toString().trim()

          if (!badgeNumber || !plateNumber) continue

          parsedData.push({
            badge_number: badgeNumber,
            license_plate_sheet: plateNumber,
            badge_type: columnMap["badge_type"] !== undefined ? row[columnMap["badge_type"]]?.toString().trim() || "" : "",
            badge_color: columnMap["badge_color"] !== undefined ? row[columnMap["badge_color"]]?.toString().trim() || "" : "",
            issue_date: columnMap["issue_date"] !== undefined ? row[columnMap["issue_date"]]?.toString().trim() || "" : "",
            expiry_date: columnMap["expiry_date"] !== undefined ? row[columnMap["expiry_date"]]?.toString().trim() || "" : "",
            status: columnMap["status"] !== undefined ? row[columnMap["status"]]?.toString().trim() || "Còn hiệu lực" : "Còn hiệu lực",
            file_code: columnMap["file_code"] !== undefined ? row[columnMap["file_code"]]?.toString().trim() || "" : "",
            issue_type: columnMap["issue_type"] !== undefined ? row[columnMap["issue_type"]]?.toString().trim() || "Cấp mới" : "Cấp mới",
            bus_route_ref: columnMap["bus_route_ref"] !== undefined ? row[columnMap["bus_route_ref"]]?.toString().trim() || "" : "",
            vehicle_type: columnMap["vehicle_type"] !== undefined ? row[columnMap["vehicle_type"]]?.toString().trim() || "" : "",
            notes: columnMap["notes"] !== undefined ? row[columnMap["notes"]]?.toString().trim() || "" : "",
          })
        }

        if (parsedData.length === 0) {
          toast.error("Không tìm thấy dữ liệu hợp lệ trong file")
          return
        }

        setImportData(parsedData)
        setImportDialogOpen(true)
      } catch (error) {
        console.error("Failed to parse Excel file:", error)
        toast.error("Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.")
      }
    }
    reader.readAsBinaryString(file)
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleImportConfirm = async () => {
    if (importData.length === 0) return

    setIsImporting(true)
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const badge of importData) {
      try {
        await vehicleBadgeService.create(badge)
        successCount++
      } catch (error: any) {
        errorCount++
        const errorMsg = error.response?.data?.error || "Lỗi không xác định"
        errors.push(`${badge.badge_number}: ${errorMsg}`)
      }
    }

    setIsImporting(false)
    setImportDialogOpen(false)
    setImportData([])

    if (successCount > 0) {
      toast.success(`Đã import thành công ${successCount} phù hiệu`)
      loadBadges(true)
    }
    if (errorCount > 0) {
      toast.error(`Có ${errorCount} phù hiệu không thể import`)
      console.error("Import errors:", errors)
    }
  }

  const downloadTemplate = () => {
    const templateData = [
      ["Số phù hiệu", "Biển số xe", "Loại phù hiệu", "Màu phù hiệu", "Ngày cấp", "Ngày hết hạn", "Trạng thái", "Mã hồ sơ", "Loại cấp", "Tuyến đường", "Loại xe", "Ghi chú"],
      ["PH001", "51B-12345", "Xe khách cố định", "Xanh", "01/01/2024", "01/01/2029", "Còn hiệu lực", "HS001", "Cấp mới", "Sài Gòn - Nha Trang", "Xe khách 45 chỗ", "Ghi chú mẫu"],
    ]
    
    const ws = XLSX.utils.aoa_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Template")
    
    // Set column widths
    ws["!cols"] = [
      { wch: 15 }, // Số phù hiệu
      { wch: 15 }, // Biển số xe
      { wch: 18 }, // Loại phù hiệu
      { wch: 15 }, // Màu phù hiệu
      { wch: 12 }, // Ngày cấp
      { wch: 15 }, // Ngày hết hạn
      { wch: 15 }, // Trạng thái
      { wch: 12 }, // Mã hồ sơ
      { wch: 12 }, // Loại cấp
      { wch: 25 }, // Tuyến đường
      { wch: 20 }, // Loại xe
      { wch: 20 }, // Ghi chú
    ]
    
    XLSX.writeFile(wb, "template-phu-hieu-xe.xlsx")
    toast.success("Đã tải template Excel")
  }

  const handleExport = () => {
    // Convert data to CSV
    const headers = [
      "Số phù hiệu",
      "Biển số xe",
      "Loại phù hiệu",
      "Màu phù hiệu",
      "Ngày cấp",
      "Ngày hết hạn",
      "Trạng thái",
      "Mã hồ sơ",
      "Loại cấp",
      "Ghi chú",
    ]

    const rows = filteredBadges.map((badge) => [
      badge.badge_number,
      badge.license_plate_sheet,
      badge.badge_type,
      badge.badge_color,
      badge.issue_date,
      badge.expiry_date,
      badge.status || "",
      badge.file_code,
      badge.issue_type,
      badge.notes || "",
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    // Create blob and download
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `phu-hieu-xe-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success("Xuất dữ liệu thành công")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản lý phù hiệu xe</h1>
        <div className="flex gap-2">
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm phù hiệu
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Import Excel
          </Button>
          <Button variant="outline" onClick={downloadTemplate}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Tải Template
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Xuất Excel
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".xlsx,.xls"
            className="hidden"
          />
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Tìm kiếm theo số phù hiệu, biển số, mã hồ sơ..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filterStatus" className="text-sm font-medium">
                  Lọc theo trạng thái
                </Label>
                <Select
                  id="filterStatus"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  {badgeStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterBadgeType" className="text-sm font-medium">
                  Lọc theo loại phù hiệu
                </Label>
                <Select
                  id="filterBadgeType"
                  value={filterBadgeType}
                  onChange={(e) => setFilterBadgeType(e.target.value)}
                >
                  <option value="">Tất cả loại</option>
                  {badgeTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterBadgeColor" className="text-sm font-medium">
                  Lọc theo màu phù hiệu
                </Label>
                <Select
                  id="filterBadgeColor"
                  value={filterBadgeColor}
                  onChange={(e) => setFilterBadgeColor(e.target.value)}
                >
                  <option value="">Tất cả màu</option>
                  {badgeColors.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">Số phù hiệu</TableHead>
              <TableHead className="text-center">Biển số xe</TableHead>
              <TableHead className="text-center">Loại phù hiệu</TableHead>
              <TableHead className="text-center">Màu phù hiệu</TableHead>
              <TableHead className="text-center">Ngày cấp</TableHead>
              <TableHead className="text-center">Ngày hết hạn</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead className="text-center">Mã hồ sơ</TableHead>
              <TableHead className="text-center">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : filteredBadges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              paginatedBadges.map((badge) => (
                <TableRow key={badge.id}>
                  <TableCell className="font-medium text-center">
                    {badge.badge_number}
                  </TableCell>
                  <TableCell className="text-center">
                    {badge.license_plate_sheet || "N/A"}
                  </TableCell>
                  <TableCell className="text-center">
                    {badge.badge_type || "N/A"}
                  </TableCell>
                  <TableCell className="text-center">
                    {badge.badge_color || "N/A"}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatDate(badge.issue_date)}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatDate(badge.expiry_date)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge
                      status={getStatusVariant(badge.status)}
                      label={badge.status || "N/A"}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    {badge.file_code || "N/A"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleView(badge)}
                        aria-label="Xem chi tiết"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(badge)}
                        aria-label="Sửa"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(badge)}
                        aria-label="Xóa"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {filteredBadges.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Hiển thị {startIndex + 1} - {Math.min(endIndex, filteredBadges.length)} của {filteredBadges.length} phù hiệu
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Trang trước
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      // Show first page, last page, current page, and pages around current
                      return (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      )
                    })
                    .map((page, index, array) => (
                      <div key={page} className="flex items-center">
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="min-w-[40px]"
                        >
                          {page}
                        </Button>
                      </div>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Detail Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl w-full max-h-[95vh] overflow-y-auto p-6">
          <DialogClose onClose={() => setViewDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle className="text-2xl">Chi tiết phù hiệu xe</DialogTitle>
          </DialogHeader>
          {selectedBadge && (
            <div className="mt-4 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Số phù hiệu</Label>
                  <p className="text-sm">{selectedBadge.badge_number || "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Biển số xe</Label>
                  <p className="text-sm">{selectedBadge.license_plate_sheet || "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Loại phù hiệu</Label>
                  <p className="text-sm">{selectedBadge.badge_type || "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Màu phù hiệu</Label>
                  <p className="text-sm">{selectedBadge.badge_color || "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Ngày cấp</Label>
                  <p className="text-sm">{formatDate(selectedBadge.issue_date)}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Ngày hết hạn</Label>
                  <p className="text-sm">{formatDate(selectedBadge.expiry_date)}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Trạng thái</Label>
                  <StatusBadge
                    status={getStatusVariant(selectedBadge.status)}
                    label={selectedBadge.status || "N/A"}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Loại cấp</Label>
                  <p className="text-sm">{selectedBadge.issue_type || "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Mã hồ sơ</Label>
                  <p className="text-sm">{selectedBadge.file_code || "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">ID Xe</Label>
                  <p className="text-sm">{selectedBadge.vehicle_id || "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">ID Giấy phép kinh doanh</Label>
                  <p className="text-sm">{selectedBadge.business_license_ref || "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">ID Tuyến</Label>
                  <p className="text-sm">{selectedBadge.route_id || "N/A"}</p>
                </div>
                {selectedBadge.previous_badge_number && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Số phù hiệu cũ</Label>
                    <p className="text-sm">{selectedBadge.previous_badge_number}</p>
                  </div>
                )}
                {selectedBadge.renewal_due_date && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Ngày đến hạn gia hạn</Label>
                    <p className="text-sm">{formatDate(selectedBadge.renewal_due_date)}</p>
                  </div>
                )}
                {selectedBadge.renewal_reason && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Lý do gia hạn</Label>
                    <p className="text-sm">{selectedBadge.renewal_reason}</p>
                  </div>
                )}
                {selectedBadge.revocation_date && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Ngày thu hồi</Label>
                    <p className="text-sm">{formatDate(selectedBadge.revocation_date)}</p>
                  </div>
                )}
                {selectedBadge.revocation_decision && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Quyết định thu hồi</Label>
                    <p className="text-sm">{selectedBadge.revocation_decision}</p>
                  </div>
                )}
                {selectedBadge.revocation_reason && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Lý do thu hồi</Label>
                    <p className="text-sm">{selectedBadge.revocation_reason}</p>
                  </div>
                )}
                {selectedBadge.replacement_vehicle_id && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">ID Xe thay thế</Label>
                    <p className="text-sm">{selectedBadge.replacement_vehicle_id}</p>
                  </div>
                )}
                {selectedBadge.notes && (
                  <div className="space-y-2 col-span-2">
                    <Label className="text-sm font-semibold">Ghi chú</Label>
                    <p className="text-sm">{selectedBadge.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Form Dialog (Create/Edit) */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[95vh] overflow-y-auto p-6">
          <DialogClose onClose={() => setFormDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {formMode === "create" ? "Thêm phù hiệu mới" : "Chỉnh sửa phù hiệu"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="badge_number">Số phù hiệu *</Label>
                <Input
                  id="badge_number"
                  value={formData.badge_number}
                  onChange={(e) => setFormData({ ...formData, badge_number: e.target.value })}
                  placeholder="Nhập số phù hiệu"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="license_plate_sheet">Biển số xe *</Label>
                <Input
                  id="license_plate_sheet"
                  value={formData.license_plate_sheet}
                  onChange={(e) => setFormData({ ...formData, license_plate_sheet: e.target.value })}
                  placeholder="VD: 51B-12345"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="badge_type">Loại phù hiệu</Label>
                <Select
                  id="badge_type"
                  value={formData.badge_type}
                  onChange={(e) => setFormData({ ...formData, badge_type: e.target.value })}
                >
                  <option value="">Chọn loại phù hiệu</option>
                  {badgeTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                  <option value="Xe khách cố định">Xe khách cố định</option>
                  <option value="Xe hợp đồng">Xe hợp đồng</option>
                  <option value="Xe du lịch">Xe du lịch</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="badge_color">Màu phù hiệu</Label>
                <Select
                  id="badge_color"
                  value={formData.badge_color}
                  onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                >
                  <option value="">Chọn màu phù hiệu</option>
                  {badgeColors.map((color) => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                  <option value="Xanh">Xanh</option>
                  <option value="Vàng">Vàng</option>
                  <option value="Đỏ">Đỏ</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue_date">Ngày cấp</Label>
                <Input
                  id="issue_date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  placeholder="DD/MM/YYYY"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry_date">Ngày hết hạn</Label>
                <Input
                  id="expiry_date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  placeholder="DD/MM/YYYY"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Trạng thái</Label>
                <Select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Còn hiệu lực">Còn hiệu lực</option>
                  <option value="Hết hạn">Hết hạn</option>
                  <option value="Thu hồi">Thu hồi</option>
                  <option value="Cấp mới">Cấp mới</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue_type">Loại cấp</Label>
                <Select
                  id="issue_type"
                  value={formData.issue_type}
                  onChange={(e) => setFormData({ ...formData, issue_type: e.target.value })}
                >
                  <option value="Cấp mới">Cấp mới</option>
                  <option value="Cấp đổi">Cấp đổi</option>
                  <option value="Cấp lại">Cấp lại</option>
                  <option value="Gia hạn">Gia hạn</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file_code">Mã hồ sơ</Label>
                <Input
                  id="file_code"
                  value={formData.file_code}
                  onChange={(e) => setFormData({ ...formData, file_code: e.target.value })}
                  placeholder="Nhập mã hồ sơ"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_type">Loại xe</Label>
                <Input
                  id="vehicle_type"
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  placeholder="VD: Xe khách 45 chỗ"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="bus_route_ref">Tuyến đường</Label>
                <Input
                  id="bus_route_ref"
                  value={formData.bus_route_ref}
                  onChange={(e) => setFormData({ ...formData, bus_route_ref: e.target.value })}
                  placeholder="VD: Sài Gòn - Nha Trang"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="notes">Ghi chú</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Nhập ghi chú (nếu có)"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setFormDialogOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Đang lưu..." : formMode === "create" ? "Thêm mới" : "Cập nhật"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={() => setDeleteDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Bạn có chắc chắn muốn xóa phù hiệu <strong>{badgeToDelete?.badge_number}</strong>?</p>
            <p className="text-sm text-gray-500 mt-2">Biển số xe: {badgeToDelete?.license_plate_sheet}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Xóa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <DialogClose onClose={() => setImportDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle className="text-xl">Xem trước dữ liệu import</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <p className="text-sm text-gray-600 mb-4">
              Tìm thấy <strong>{importData.length}</strong> phù hiệu sẽ được import. Vui lòng kiểm tra trước khi xác nhận.
            </p>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-12">STT</TableHead>
                    <TableHead className="text-center">Số phù hiệu</TableHead>
                    <TableHead className="text-center">Biển số xe</TableHead>
                    <TableHead className="text-center">Loại PH</TableHead>
                    <TableHead className="text-center">Màu PH</TableHead>
                    <TableHead className="text-center">Ngày cấp</TableHead>
                    <TableHead className="text-center">Ngày hết hạn</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.slice(0, 100).map((badge, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center">{index + 1}</TableCell>
                      <TableCell className="text-center font-medium">{badge.badge_number}</TableCell>
                      <TableCell className="text-center">{badge.license_plate_sheet}</TableCell>
                      <TableCell className="text-center">{badge.badge_type || "-"}</TableCell>
                      <TableCell className="text-center">{badge.badge_color || "-"}</TableCell>
                      <TableCell className="text-center">{badge.issue_date || "-"}</TableCell>
                      <TableCell className="text-center">{badge.expiry_date || "-"}</TableCell>
                      <TableCell className="text-center">{badge.status || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {importData.length > 100 && (
              <p className="text-sm text-gray-500 mt-2 text-center">
                ...và {importData.length - 100} phù hiệu khác
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                setImportDialogOpen(false)
                setImportData([])
              }}
              disabled={isImporting}
            >
              Hủy
            </Button>
            <Button onClick={handleImportConfirm} disabled={isImporting}>
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Đang import...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import {importData.length} phù hiệu
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

