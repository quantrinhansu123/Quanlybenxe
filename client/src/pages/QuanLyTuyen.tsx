import { useState, useEffect } from "react"
import { toast } from "react-toastify"
import { Search, Eye, RefreshCw, ChevronLeft, ChevronRight, MapPin, FileText } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { routeService, LegacyRoute } from "@/services/route.service"
import { useUIStore } from "@/store/ui.store"

export default function QuanLyTuyen() {
  const [routes, setRoutes] = useState<LegacyRoute[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterDepartureProvince, setFilterDepartureProvince] = useState("")
  const [filterArrivalProvince, setFilterArrivalProvince] = useState("")
  const [filterRouteType, setFilterRouteType] = useState("")
  const [filterOperationStatus, setFilterOperationStatus] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<LegacyRoute | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Quản lý tuyến xe")
    loadRoutes()
  }, [setTitle])

  const loadRoutes = async (forceRefresh = false) => {
    setIsLoading(true)
    try {
      const data = await routeService.getLegacy(forceRefresh)
      setRoutes(data)
    } catch (error) {
      console.error("Failed to load routes:", error)
      toast.error("Không thể tải danh sách tuyến. Vui lòng thử lại sau.")
    } finally {
      setIsLoading(false)
    }
  }

  // Get unique values for filters
  const departureProvinces = Array.from(new Set(routes.map((r) => r.departureProvince).filter(Boolean))).sort()
  const arrivalProvinces = Array.from(new Set(routes.map((r) => r.arrivalProvince).filter(Boolean))).sort()
  const routeTypes = Array.from(new Set(routes.map((r) => r.routeType).filter(Boolean))).sort()
  const operationStatuses = Array.from(new Set(routes.map((r) => r.operationStatus).filter(Boolean))).sort()

  const filteredRoutes = routes.filter((route) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        route.routeCode.toLowerCase().includes(query) ||
        route.departureStation.toLowerCase().includes(query) ||
        route.arrivalStation.toLowerCase().includes(query) ||
        route.departureProvince.toLowerCase().includes(query) ||
        route.arrivalProvince.toLowerCase().includes(query) ||
        route.routePath.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Province filters
    if (filterDepartureProvince && route.departureProvince !== filterDepartureProvince) {
      return false
    }
    if (filterArrivalProvince && route.arrivalProvince !== filterArrivalProvince) {
      return false
    }

    // Route type filter
    if (filterRouteType && route.routeType !== filterRouteType) {
      return false
    }

    // Operation status filter
    if (filterOperationStatus && route.operationStatus !== filterOperationStatus) {
      return false
    }

    return true
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredRoutes.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedRoutes = filteredRoutes.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterDepartureProvince, filterArrivalProvince, filterRouteType, filterOperationStatus])

  const handleView = (route: LegacyRoute) => {
    setSelectedRoute(route)
    setDialogOpen(true)
  }

  const clearFilters = () => {
    setSearchQuery("")
    setFilterDepartureProvince("")
    setFilterArrivalProvince("")
    setFilterRouteType("")
    setFilterOperationStatus("")
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A"
    // Handle format "2025-04-14 00:00:00" or "dd/mm/yyyy"
    if (dateStr.includes("-")) {
      const parts = dateStr.split(" ")[0].split("-")
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`
      }
    }
    return dateStr
  }

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase()
    if (s.includes("mới") || s.includes("hoạt động")) return "bg-emerald-100 text-emerald-700"
    if (s.includes("ngừng") || s.includes("đóng")) return "bg-rose-100 text-rose-700"
    return "bg-gray-100 text-gray-700"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý tuyến xe</h1>
          <p className="text-gray-600 mt-1">
            Danh mục tuyến cố định - {routes.length.toLocaleString()} tuyến
          </p>
        </div>
        <Button onClick={() => loadRoutes(true)} disabled={isLoading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Tìm kiếm theo mã tuyến, bến đi, bến đến, tỉnh, hành trình..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filterDepartureProvince" className="text-sm font-medium">
                  Tỉnh đi
                </Label>
                <Select
                  id="filterDepartureProvince"
                  value={filterDepartureProvince}
                  onChange={(e) => setFilterDepartureProvince(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {departureProvinces.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterArrivalProvince" className="text-sm font-medium">
                  Tỉnh đến
                </Label>
                <Select
                  id="filterArrivalProvince"
                  value={filterArrivalProvince}
                  onChange={(e) => setFilterArrivalProvince(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {arrivalProvinces.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterRouteType" className="text-sm font-medium">
                  Loại tuyến
                </Label>
                <Select
                  id="filterRouteType"
                  value={filterRouteType}
                  onChange={(e) => setFilterRouteType(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {routeTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterOperationStatus" className="text-sm font-medium">
                  Tình trạng
                </Label>
                <Select
                  id="filterOperationStatus"
                  value={filterOperationStatus}
                  onChange={(e) => setFilterOperationStatus(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {operationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {(searchQuery || filterDepartureProvince || filterArrivalProvince || filterRouteType || filterOperationStatus) && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-gray-500">
                  Hiển thị {filteredRoutes.length.toLocaleString()} / {routes.length.toLocaleString()} tuyến
                </p>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center w-[120px]">Mã tuyến</TableHead>
              <TableHead className="text-center">Bến đi</TableHead>
              <TableHead className="text-center">Tỉnh đi</TableHead>
              <TableHead className="text-center">Bến đến</TableHead>
              <TableHead className="text-center">Tỉnh đến</TableHead>
              <TableHead className="text-center w-[80px]">Cự ly (km)</TableHead>
              <TableHead className="text-center w-[100px]">Chuyến/tháng</TableHead>
              <TableHead className="text-center w-[120px]">Tình trạng</TableHead>
              <TableHead className="text-center w-[80px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : paginatedRoutes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              paginatedRoutes.map((route) => (
                <TableRow key={route.id} className="hover:bg-gray-50">
                  <TableCell className="font-mono text-sm text-center">{route.routeCode}</TableCell>
                  <TableCell className="text-center">{route.departureStation || "N/A"}</TableCell>
                  <TableCell className="text-center text-gray-600">{route.departureProvince || "N/A"}</TableCell>
                  <TableCell className="text-center">{route.arrivalStation || "N/A"}</TableCell>
                  <TableCell className="text-center text-gray-600">{route.arrivalProvince || "N/A"}</TableCell>
                  <TableCell className="text-center">{route.distanceKm || "N/A"}</TableCell>
                  <TableCell className="text-center">{route.totalTripsMonth || "N/A"}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(route.operationStatus)}`}>
                      {route.operationStatus || "N/A"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleView(route)}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">
              Trang {currentPage} / {totalPages} ({filteredRoutes.length.toLocaleString()} tuyến)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Trước
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Sau
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Chi tiết tuyến xe</DialogTitle>
          </DialogHeader>
          {selectedRoute && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Mã tuyến</p>
                  <p className="text-2xl font-bold text-blue-900">{selectedRoute.routeCode}</p>
                  {selectedRoute.routeCodeOld && selectedRoute.routeCodeOld !== selectedRoute.routeCode && (
                    <p className="text-sm text-blue-500">Mã cũ: {selectedRoute.routeCodeOld}</p>
                  )}
                </div>
              </div>

              {/* Route Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-500">Bến đi</p>
                      <p className="font-medium">{selectedRoute.departureStation}</p>
                      <p className="text-sm text-gray-600">{selectedRoute.departureProvince}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-500">Bến đến</p>
                      <p className="font-medium">{selectedRoute.arrivalStation}</p>
                      <p className="text-sm text-gray-600">{selectedRoute.arrivalProvince}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Route Path */}
              {selectedRoute.routePath && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Hành trình chạy xe</p>
                  <p className="text-sm">{selectedRoute.routePath}</p>
                </div>
              )}

              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Cự ly</p>
                  <p className="text-xl font-bold">{selectedRoute.distanceKm} km</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Chuyến/tháng</p>
                  <p className="text-xl font-bold">{selectedRoute.totalTripsMonth}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Đang khai thác</p>
                  <p className="text-xl font-bold">{selectedRoute.tripsInOperation}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Giãn cách (phút)</p>
                  <p className="text-xl font-bold">{selectedRoute.minIntervalMinutes}</p>
                </div>
              </div>

              {/* Status & Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Loại tuyến</p>
                  <p className="font-medium">{selectedRoute.routeType || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tình trạng khai thác</p>
                  <span className={`inline-flex px-2 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedRoute.operationStatus)}`}>
                    {selectedRoute.operationStatus || "N/A"}
                  </span>
                </div>
              </div>

              {/* Decision Info */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <p className="font-medium">Thông tin quyết định</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Số quyết định</p>
                    <p>{selectedRoute.decisionNumber || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Ngày ban hành</p>
                    <p>{formatDate(selectedRoute.decisionDate)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Đơn vị ban hành</p>
                    <p>{selectedRoute.issuingAuthority || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedRoute.notes && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-1">Ghi chú</p>
                  <p className="text-sm">{selectedRoute.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
