import { useState, useEffect } from "react"
import { toast } from "react-toastify"
import { Plus, Search, Edit, Eye, Trash2, X } from "lucide-react"
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
import { StatusBadge } from "@/components/layout/StatusBadge"
import { RouteDialog } from "@/components/route/RouteDialog"
import { routeService } from "@/services/route.service"
import { locationService } from "@/services/location.service"
import { scheduleService } from "@/services/schedule.service"
import type { Route, Location } from "@/types"
import { useUIStore } from "@/store/ui.store"

export default function QuanLyTuyen() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [scheduleCounts, setScheduleCounts] = useState<Map<string, number>>(new Map())
  const [searchQuery, setSearchQuery] = useState("")
  const [filterOrigin, setFilterOrigin] = useState("")
  const [filterDestination, setFilterDestination] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"create" | "edit" | "view">("create")
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Quản lý tuyến xe")
    loadRoutes()
    loadLocations()
  }, [setTitle])

  const loadRoutes = async () => {
    setIsLoading(true)
    try {
      const data = await routeService.getAll()
      setRoutes(data)
      
      // Load schedule counts for all routes
      await loadScheduleCounts(data)
    } catch (error) {
      console.error("Failed to load routes:", error)
      toast.error("Không thể tải danh sách tuyến. Vui lòng thử lại sau.")
    } finally {
      setIsLoading(false)
    }
  }

  const loadScheduleCounts = async (routesData: Route[]) => {
    try {
      const counts = new Map<string, number>()
      
      // Load schedules for all routes in parallel
      const schedulePromises = routesData.map(async (route) => {
        try {
          const schedules = await scheduleService.getAll(route.id, undefined, true)
          counts.set(route.id, schedules.length)
        } catch (error) {
          console.error(`Failed to load schedules for route ${route.id}:`, error)
          counts.set(route.id, 0)
        }
      })
      
      await Promise.all(schedulePromises)
      setScheduleCounts(counts)
    } catch (error) {
      console.error("Failed to load schedule counts:", error)
    }
  }

  const loadLocations = async () => {
    try {
      const data = await locationService.getAll(true)
      // Remove duplicates by ID
      const uniqueLocations = Array.from(
        new Map(data.map(loc => [loc.id, loc])).values()
      )
      setLocations(uniqueLocations)
    } catch (error) {
      console.error("Failed to load locations:", error)
    }
  }

  const filteredRoutes = routes.filter((route) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        route.routeCode.toLowerCase().includes(query) ||
        route.routeName.toLowerCase().includes(query) ||
        route.origin?.name.toLowerCase().includes(query) ||
        route.destination?.name.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Origin filter
    if (filterOrigin && route.originId !== filterOrigin) {
      return false
    }

    // Destination filter
    if (filterDestination && route.destinationId !== filterDestination) {
      return false
    }

    // Status filter
    if (filterStatus) {
      const isActive = filterStatus === "active"
      if (route.isActive !== isActive) return false
    }

    return true
  })

  const handleCreate = () => {
    setSelectedRoute(null)
    setViewMode("create")
    setDialogOpen(true)
  }

  const handleEdit = (route: Route) => {
    setSelectedRoute(route)
    setViewMode("edit")
    setDialogOpen(true)
  }

  const handleView = (route: Route) => {
    setSelectedRoute(route)
    setViewMode("view")
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa tuyến này?")) {
      try {
        await routeService.delete(id)
        toast.success("Xóa tuyến thành công")
        loadRoutes()
      } catch (error: any) {
        console.error("Failed to delete route:", error)
        toast.error(error.response?.data?.error || "Không thể xóa tuyến. Vui lòng thử lại sau.")
      }
    }
  }

  const handleToggleStatus = async (route: Route) => {
    try {
      await routeService.update(route.id, { isActive: !route.isActive } as any)
      toast.success(`Đã ${route.isActive ? "vô hiệu hóa" : "kích hoạt"} tuyến`)
      loadRoutes()
    } catch (error) {
      console.error("Failed to toggle route status:", error)
      toast.error("Không thể thay đổi trạng thái tuyến")
    }
  }

  // Get unique origins and destinations for filters
  const uniqueOrigins = Array.from(
    new Map(
      routes
        .filter((r) => r.origin)
        .map((r) => [r.origin!.id, r.origin!])
    ).values()
  )

  const uniqueDestinations = Array.from(
    new Map(
      routes
        .filter((r) => r.destination)
        .map((r) => [r.destination!.id, r.destination!])
    ).values()
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý tuyến xe</h1>
          <p className="text-gray-600 mt-1">Quản lý thông tin tuyến vận chuyển</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Thêm tuyến
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Tìm kiếm theo mã tuyến, tên tuyến, điểm đi, điểm đến..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filterOrigin" className="text-sm font-medium">
                  Lọc theo điểm đi
                </Label>
                <Select
                  id="filterOrigin"
                  value={filterOrigin}
                  onChange={(e) => setFilterOrigin(e.target.value)}
                >
                  <option value="">Tất cả điểm đi</option>
                  {uniqueOrigins.map((origin) => (
                    <option key={origin.id} value={origin.id}>
                      {origin.name} ({origin.code})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterDestination" className="text-sm font-medium">
                  Lọc theo điểm đến
                </Label>
                <Select
                  id="filterDestination"
                  value={filterDestination}
                  onChange={(e) => setFilterDestination(e.target.value)}
                >
                  <option value="">Tất cả điểm đến</option>
                  {uniqueDestinations.map((dest) => (
                    <option key={dest.id} value={dest.id}>
                      {dest.name} ({dest.code})
                    </option>
                  ))}
                </Select>
              </div>
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
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Ngừng hoạt động</option>
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
              <TableHead className="text-center">Mã tuyến</TableHead>
              <TableHead className="text-center">Tên tuyến</TableHead>
              <TableHead className="text-center">Bến đi</TableHead>
              <TableHead className="text-center">Bến đến</TableHead>
              <TableHead className="text-center">Biểu đồ giờ XB</TableHead>
              <TableHead className="text-center">Lưu lượng quy hoạch</TableHead>
              <TableHead className="text-center">Cự ly (km)</TableHead>
              <TableHead className="text-center">Hành trình chạy</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead className="text-center">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : filteredRoutes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              filteredRoutes.map((route) => (
                <TableRow key={route.id}>
                  <TableCell className="font-medium text-center">{route.routeCode}</TableCell>
                  <TableCell className="text-center">{route.routeName}</TableCell>
                  <TableCell className="text-center">{route.origin?.name || "N/A"}</TableCell>
                  <TableCell className="text-center">{route.destination?.name || "N/A"}</TableCell>
                  <TableCell className="text-center">
                    {scheduleCounts.get(route.id) ?? 0}
                  </TableCell>
                  <TableCell className="text-center">
                    {route.plannedFrequency || "N/A"}
                  </TableCell>
                  <TableCell className="text-center">
                    {route.distanceKm ? `${route.distanceKm}` : "N/A"}
                  </TableCell>
                  <TableCell className="text-center">
                    {route.journeyDescription || 
                     (route.estimatedDurationMinutes ? `${route.estimatedDurationMinutes} phút` : "N/A")}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge
                      status={route.isActive ? "active" : "inactive"}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleView(route)}
                        aria-label="Xem"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(route)}
                        aria-label="Sửa"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleStatus(route)}
                        aria-label={route.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                        title={route.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                      >
                        {route.isActive ? (
                          <X className="h-4 w-4 text-orange-600" />
                        ) : (
                          <Plus className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(route.id)}
                        aria-label="Xóa"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog */}
      <RouteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={viewMode}
        route={selectedRoute}
        locations={locations}
        onSuccess={async () => {
          await loadRoutes()
        }}
      />
    </div>
  )
}


