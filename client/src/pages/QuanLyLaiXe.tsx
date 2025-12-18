import { useState, useEffect } from "react"
import { toast } from "react-toastify"
import { Plus, Search, Edit, Eye, Trash2, Image as ImageIcon } from "lucide-react"
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
import { driverService } from "@/services/driver.service"
import type { Driver } from "@/types"
import { format, isValid, parseISO } from "date-fns"
import { useUIStore } from "@/store/ui.store"
import { DriverDialog } from "@/components/driver/DriverDialog"



// Helper function to safely format dates
const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) return "N/A"
  const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString)
  return isValid(date) ? format(date, "dd/MM/yyyy") : "N/A"
}

export default function QuanLyLaiXe() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"create" | "edit" | "view">("create")
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Quản lý lái xe")
    loadDrivers()
  }, [setTitle])

  const loadDrivers = async () => {
    setIsLoading(true)
    try {
      const data = await driverService.getAll()
      setDrivers(data)
    } catch (error) {
      console.error("Failed to load drivers:", error)
      // Show error message to user
      toast.error("Không thể tải danh sách lái xe. Vui lòng thử lại sau.")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredDrivers = drivers.filter((driver) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        driver.fullName.toLowerCase().includes(query) ||
        (driver.phone || '').toLowerCase().includes(query) ||
        driver.licenseNumber.toLowerCase().includes(query)
      )
    }
    return true
  })

  const handleCreate = () => {
    setSelectedDriver(null)
    setViewMode("create")
    setDialogOpen(true)
  }

  const handleEdit = (driver: Driver) => {
    setSelectedDriver(driver)
    setViewMode("edit")
    setDialogOpen(true)
  }

  const handleView = (driver: Driver) => {
    setSelectedDriver(driver)
    setViewMode("view")
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa lái xe này?")) {
      try {
        await driverService.delete(id)
        loadDrivers()
      } catch (error) {
        console.error("Failed to delete driver:", error)
      }
    }
  }

  const handleViewImage = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl)
    setImageDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Thêm lái xe
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Tìm kiếm theo tên, số điện thoại, bằng lái..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">Họ tên</TableHead>
              <TableHead className="text-center">Số điện thoại</TableHead>
              <TableHead className="text-center">Số bằng lái</TableHead>
              <TableHead className="text-center">Ngày hết hạn bằng lái</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead className="text-center">Ảnh tài xế</TableHead>
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
            ) : filteredDrivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              filteredDrivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell className="font-medium text-center">{driver.fullName}</TableCell>
                  <TableCell className="text-center">{driver.phone || 'N/A'}</TableCell>
                  <TableCell className="text-center">{driver.licenseNumber}</TableCell>
                  <TableCell className="text-center">
                    {formatDate(driver.licenseExpiryDate)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={driver.isActive ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      {driver.imageUrl ? (
                        <div
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleViewImage(driver.imageUrl!)}
                          aria-label="Xem ảnh"
                        >
                          <img
                            src={driver.imageUrl}
                            alt={`Ảnh ${driver.fullName}`}
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect fill='%23f3f4f6' width='64' height='64'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='Arial' font-size='10'%3EN/A%3C/text%3E%3C/svg%3E"
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
                          <ImageIcon className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleView(driver)}
                        aria-label="Xem"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(driver)}
                        aria-label="Sửa"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(driver.id)}
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

      {/* Driver Dialog */}
      <DriverDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={viewMode}
        driver={selectedDriver}
        onSuccess={loadDrivers}
      />

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-4xl w-full p-6">
          <DialogClose onClose={() => setImageDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle className="text-2xl">Ảnh tài xế</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex justify-center">
            {selectedImageUrl && (
              <img
                src={selectedImageUrl}
                alt="Ảnh tài xế"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='Arial' font-size='16'%3EKhông thể tải ảnh%3C/text%3E%3C/svg%3E"
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}





