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
import { ServiceDialog } from "@/components/service/ServiceDialog"
import { serviceService } from "@/services/service.service"
import type { Service } from "@/types"
import { useUIStore } from "@/store/ui.store"

export default function QuanLyDichVu() {
  const [services, setServices] = useState<Service[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"create" | "edit" | "view">("create")
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Quản lý dịch vụ")
    loadServices()
  }, [setTitle])

  const loadServices = async () => {
    setIsLoading(true)
    try {
      const data = await serviceService.getAll()
      setServices(data)
    } catch (error) {
      console.error("Failed to load services:", error)
      toast.error("Không thể tải danh sách dịch vụ. Vui lòng thử lại sau.")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredServices = services.filter((service) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        service.code.toLowerCase().includes(query) ||
        service.name.toLowerCase().includes(query) ||
        service.unit.toLowerCase().includes(query) ||
        service.materialType.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Status filter
    if (filterStatus) {
      const isActive = filterStatus === "active"
      if (service.isActive !== isActive) return false
    }

    return true
  })

  const handleCreate = () => {
    setSelectedService(null)
    setViewMode("create")
    setDialogOpen(true)
  }

  const handleEdit = async (service: Service) => {
    try {
      // Load đầy đủ thông tin dịch vụ bao gồm biểu thức đã chọn
      const fullService = await serviceService.getById(service.id)
      setSelectedService(fullService)
      setViewMode("edit")
      setDialogOpen(true)
    } catch (error) {
      console.error("Failed to load service details:", error)
      toast.error("Không thể tải thông tin dịch vụ. Vui lòng thử lại sau.")
    }
  }

  const handleView = async (service: Service) => {
    try {
      // Load đầy đủ thông tin dịch vụ bao gồm biểu thức đã chọn
      const fullService = await serviceService.getById(service.id)
      setSelectedService(fullService)
      setViewMode("view")
      setDialogOpen(true)
    } catch (error) {
      console.error("Failed to load service details:", error)
      toast.error("Không thể tải thông tin dịch vụ. Vui lòng thử lại sau.")
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa dịch vụ này?")) {
      try {
        await serviceService.delete(id)
        toast.success("Xóa dịch vụ thành công")
        loadServices()
      } catch (error: any) {
        console.error("Failed to delete service:", error)
        toast.error(error.response?.data?.error || "Không thể xóa dịch vụ. Vui lòng thử lại sau.")
      }
    }
  }

  const handleToggleStatus = async (service: Service) => {
    try {
      await serviceService.update(service.id, { isActive: !service.isActive } as any)
      toast.success(`Đã ${service.isActive ? "vô hiệu hóa" : "kích hoạt"} dịch vụ`)
      loadServices()
    } catch (error) {
      console.error("Failed to toggle service status:", error)
      toast.error("Không thể thay đổi trạng thái dịch vụ")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý dịch vụ</h1>
          <p className="text-gray-600 mt-1">Quản lý thông tin dịch vụ</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Thêm dịch vụ
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Tìm kiếm theo mã dịch vụ, tên dịch vụ, đơn vị tính..."
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center sticky left-0 bg-white z-10">Mã dịch vụ</TableHead>
                <TableHead className="text-center">Tên dịch vụ</TableHead>
                <TableHead className="text-center">Đơn vị tính</TableHead>
                <TableHead className="text-center">Phần trăm thuế</TableHead>
                <TableHead className="text-center">Loại vật tư/hàng hóa</TableHead>
                <TableHead className="text-center">Sử dụng công thức tính số lượng</TableHead>
                <TableHead className="text-center">Sử dụng công thức tính đơn giá</TableHead>
                <TableHead className="text-center">Thứ tự hiển thị</TableHead>
                <TableHead className="text-center">Mặc định chọn</TableHead>
                <TableHead className="text-center">Tự động tính số lượng</TableHead>
                <TableHead className="text-center sticky right-0 bg-white z-10">Trạng thái</TableHead>
                <TableHead className="text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : filteredServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                    Không có dữ liệu
                  </TableCell>
                </TableRow>
              ) : (
                filteredServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium text-center sticky left-0 bg-white z-10">
                      {service.code}
                    </TableCell>
                    <TableCell className="text-center">{service.name}</TableCell>
                    <TableCell className="text-center">{service.unit}</TableCell>
                    <TableCell className="text-center">{service.taxPercentage}%</TableCell>
                    <TableCell className="text-center">{service.materialType}</TableCell>
                    <TableCell className="text-center">
                      {service.useQuantityFormula ? "✓" : "✗"}
                    </TableCell>
                    <TableCell className="text-center">
                      {service.usePriceFormula ? "✓" : "✗"}
                    </TableCell>
                    <TableCell className="text-center">{service.displayOrder}</TableCell>
                    <TableCell className="text-center">
                      {service.isDefault ? "✓" : "✗"}
                    </TableCell>
                    <TableCell className="text-center">
                      {service.autoCalculateQuantity ? "✓" : "✗"}
                    </TableCell>
                    <TableCell className="text-center sticky right-0 bg-white z-10">
                      <StatusBadge
                        status={service.isActive ? "active" : "inactive"}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleView(service)}
                          aria-label="Xem"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(service)}
                          aria-label="Sửa"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleStatus(service)}
                          aria-label={service.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                          title={service.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                        >
                          {service.isActive ? (
                            <X className="h-4 w-4 text-orange-600" />
                          ) : (
                            <Plus className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(service.id)}
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
        </div>
      </Card>

      {/* Dialog */}
      <ServiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        viewMode={viewMode}
        selectedService={selectedService}
        onSuccess={loadServices}
      />
    </div>
  )
}

