import { useState, useEffect } from "react"
import { toast } from "react-toastify"
import { Search, Eye, Download } from "lucide-react"
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
import { vehicleBadgeService, type VehicleBadge } from "@/services/vehicle-badge.service"
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

// Helper function to get status badge variant
const getStatusVariant = (status: string): "active" | "inactive" | "maintenance" => {
  if (status === "active") return "active"
  if (status === "expired" || status === "revoked") return "inactive"
  return "maintenance" // For pending, replaced, or unknown statuses
}

// Helper function to translate status to Vietnamese
const translateStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    active: "Hiệu lực",
    expired: "Hết hiệu lực",
    revoked: "Thu hồi",
    replaced: "Đã thay thế",
    pending: "Chờ xử lý"
  }
  return statusMap[status] || status
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
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Quản lý phù hiệu xe")
    loadBadges()
  }, [setTitle])

  const loadBadges = async () => {
    setIsLoading(true)
    try {
      const data = await vehicleBadgeService.getAll()
      setBadges(data)
    } catch (error) {
      console.error("Failed to load vehicle badges:", error)
      toast.error("Không thể tải danh sách phù hiệu xe. Vui lòng thử lại sau.")
    } finally {
      setIsLoading(false)
    }
  }

  // Get unique values for filters
  const statuses = Array.from(new Set(badges.map((b) => b.status).filter(Boolean))).sort()
  const badgeTypes = Array.from(new Set(badges.map((b) => b.badge_type).filter(Boolean))).sort()
  const badgeColors = Array.from(new Set(badges.map((b) => b.badge_color).filter(Boolean))).sort()

  const filteredBadges = badges.filter((badge) => {
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

    // Status filter
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
      badge.status,
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
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Xuất Excel
        </Button>
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
                  {statuses.map((status) => (
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
                      label={translateStatus(badge.status)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    {badge.file_code || "N/A"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleView(badge)}
                      aria-label="Xem chi tiết"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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
                    label={translateStatus(selectedBadge.status)}
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
    </div>
  )
}

