import { useState, useEffect } from "react"
import { toast } from "react-toastify"
import { Plus, Search, Edit, Eye, Trash2 } from "lucide-react"
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
import { vehicleService, VehicleForm, VehicleView } from "@/features/fleet/vehicles"
import type { Vehicle } from "@/types"
import { useUIStore } from "@/store/ui.store"
import { format, isValid, parseISO } from "date-fns"

// Helper functions to extract display values
const getVehicleTypeName = (vehicle: Vehicle): string => {
  // Only return name, not ID (IDs look ugly in UI)
  return vehicle.vehicleType?.name || ""
}

const getOperatorName = (vehicle: Vehicle): string => {
  return vehicle.operator?.name || ""
}

// Helper function to format date (supports DD/MM/YYYY and ISO formats)
const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) return "N/A"
  // If already in DD/MM/YYYY format, return as is
  if (dateString.includes('/')) return dateString
  // Otherwise parse ISO format
  const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString)
  return isValid(date) ? format(date, "dd/MM/yyyy") : "N/A"
}

export default function QuanLyXe() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterVehicleType, setFilterVehicleType] = useState("")
  const [filterOperator, setFilterOperator] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"create" | "edit" | "view">("create")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null)
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Quản lý xe")
    loadVehicles()
  }, [setTitle])

  const loadVehicles = async () => {
    setIsLoading(true)
    try {
      const data = await vehicleService.getAll()
      setVehicles(data)
    } catch (error) {
      console.error("Failed to load vehicles:", error)
      toast.error("Không thể tải danh sách xe. Vui lòng thử lại sau.")
    } finally {
      setIsLoading(false)
    }
  }

  // Get unique vehicle types and operators for filter options
  const vehicleTypes = Array.from(
    new Set(vehicles.map(getVehicleTypeName).filter(Boolean))
  ).sort()
  const operatorNames = Array.from(
    new Set(vehicles.map(getOperatorName).filter(Boolean))
  ).sort()

  const filteredVehicles = vehicles.filter((vehicle: any) => {
    const vehicleTypeName = getVehicleTypeName(vehicle)
    const operatorName = getOperatorName(vehicle)

    // Search filter - search by plate number, chassis number, operator name
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        (vehicle.plateNumber?.toLowerCase() || "").includes(query) ||
        (vehicle.chassisNumber?.toLowerCase() || "").includes(query) ||
        operatorName.toLowerCase().includes(query) ||
        vehicleTypeName.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Vehicle type filter
    if (filterVehicleType && vehicleTypeName !== filterVehicleType) {
      return false
    }

    // Operator filter
    if (filterOperator && operatorName !== filterOperator) {
      return false
    }

    // Status filter (active/inactive)
    if (filterStatus) {
      const isActive = filterStatus === "active"
      if (vehicle.isActive !== isActive) return false
    }

    return true
  })

  const handleCreate = () => {
    setSelectedVehicle(null)
    setViewMode("create")
    setDialogOpen(true)
  }

  const handleEdit = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setViewMode("edit")
    setDialogOpen(true)
  }

  const handleView = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setViewMode("view")
    setDialogOpen(true)
  }

  const handleDelete = (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!vehicleToDelete) return
    
    try {
      await vehicleService.delete(vehicleToDelete.id)
      toast.success("Xóa xe thành công")
      setDeleteDialogOpen(false)
      setVehicleToDelete(null)
      loadVehicles()
    } catch (error: any) {
      console.error("Failed to delete vehicle:", error)
      toast.error(error.response?.data?.error || "Không thể xóa xe. Vui lòng thử lại.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Thêm xe
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Tìm kiếm theo biển số, số khung, đơn vị vận tải..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filterVehicleType" className="text-sm font-medium">
                  Lọc theo loại xe
                </Label>
                <Select
                  id="filterVehicleType"
                  value={filterVehicleType}
                  onChange={(e) => setFilterVehicleType(e.target.value)}
                >
                  <option value="">Tất cả loại xe</option>
                  {vehicleTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterOperator" className="text-sm font-medium">
                  Lọc theo đơn vị vận tải
                </Label>
                <Select
                  id="filterOperator"
                  value={filterOperator}
                  onChange={(e) => setFilterOperator(e.target.value)}
                >
                  <option value="">Tất cả đơn vị</option>
                  {operatorNames.map((op) => (
                    <option key={op} value={op}>
                      {op}
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
              <TableHead className="text-center">Biển kiểm soát</TableHead>
              <TableHead className="text-center">Loại xe</TableHead>
              <TableHead className="text-center">Số chỗ</TableHead>
              <TableHead className="text-center">Đơn vị vận tải</TableHead>
              <TableHead className="text-center">Hạn đăng kiểm</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead className="text-center">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : filteredVehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              filteredVehicles.map((vehicle: any) => (
                <TableRow key={vehicle.id}>
                  <TableCell className="font-medium text-center">
                    {vehicle.plateNumber}
                  </TableCell>
                  <TableCell className="text-center">
                    {getVehicleTypeName(vehicle) || "N/A"}
                  </TableCell>
                  <TableCell className="text-center">
                    {vehicle.seatCapacity || "N/A"}
                  </TableCell>
                  <TableCell className="text-center">
                    {getOperatorName(vehicle) || "N/A"}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatDate(vehicle.inspectionExpiryDate)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={vehicle.isActive ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleView(vehicle)}
                        aria-label="Xem"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(vehicle)}
                        aria-label="Sửa"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(vehicle)}
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl w-full max-h-[95vh] overflow-y-auto p-6">
          <DialogClose onClose={() => setDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {viewMode === "create" && "Thêm xe mới"}
              {viewMode === "edit" && "Sửa thông tin xe"}
              {viewMode === "view" && "Chi tiết xe"}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {viewMode === "view" && selectedVehicle ? (
              <VehicleView vehicle={selectedVehicle} />
            ) : (
              <VehicleForm
                vehicle={selectedVehicle}
                mode={viewMode === "view" ? "create" : viewMode}
                onClose={() => {
                  setDialogOpen(false)
                  loadVehicles()
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Xác nhận xóa xe</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700">
              Bạn có chắc chắn muốn xóa xe <strong>{vehicleToDelete?.plateNumber}</strong>?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Xe sẽ được chuyển sang trạng thái đã xóa và không hiển thị trong danh sách.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setVehicleToDelete(null)
              }}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
            >
              Xóa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}







