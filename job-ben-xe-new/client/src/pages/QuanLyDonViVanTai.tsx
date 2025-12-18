import { useState, useEffect } from "react"
import { toast } from "react-toastify"
import { Plus, Search, Edit, Eye, Trash2, Building2 } from "lucide-react"
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
import { operatorService } from "@/services/operator.service"
import type { Operator } from "@/types"
import { useUIStore } from "@/store/ui.store"
import { OperatorDialog } from "@/components/operator/OperatorDialog"
import { OperatorDetailDialog } from "@/components/operator/OperatorDetailDialog"

export default function QuanLyDonViVanTai() {
  const [operators, setOperators] = useState<Operator[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"create" | "edit" | "view">("create")
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedOperatorForDetail, setSelectedOperatorForDetail] = useState<Operator | null>(null)
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Quản lý Đơn vị vận tải")
    loadOperators()
  }, [setTitle])

  const loadOperators = async () => {
    setIsLoading(true)
    try {
      const data = await operatorService.getAll()
      setOperators(data)
    } catch (error) {
      console.error("Failed to load operators:", error)
      toast.error("Không thể tải danh sách đơn vị vận tải. Vui lòng thử lại sau.")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredOperators = operators.filter((operator) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        operator.name.toLowerCase().includes(query) ||
        operator.code.toLowerCase().includes(query) ||
        (operator.phone || '').toLowerCase().includes(query)
      )
    }
    return true
  })

  const handleCreate = () => {
    setSelectedOperator(null)
    setViewMode("create")
    setDialogOpen(true)
  }

  const handleEdit = (operator: Operator) => {
    setSelectedOperator(operator)
    setViewMode("edit")
    setDialogOpen(true)
  }

  const handleView = (operator: Operator) => {
    setSelectedOperator(operator)
    setViewMode("view")
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa đơn vị vận tải này?")) {
      try {
        await operatorService.delete(id)
        toast.success("Xóa đơn vị vận tải thành công")
        loadOperators()
      } catch (error) {
        console.error("Failed to delete operator:", error)
        toast.error("Không thể xóa đơn vị vận tải. Có thể đơn vị này đang có xe hoặc lái xe hoạt động.")
      }
    }
  }

  const handleRowClick = (operator: Operator) => {
    setSelectedOperatorForDetail(operator)
    setDetailDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Thêm đơn vị
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Tìm kiếm theo tên, mã đơn vị, số điện thoại..."
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
              <TableHead className="text-center">Mã ĐV</TableHead>
              <TableHead className="text-center">Tên đơn vị</TableHead>
              <TableHead className="text-center">Số điện thoại</TableHead>
              <TableHead className="text-center">Người đại diện</TableHead>
              <TableHead className="text-center">Ủy thác vé</TableHead>
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
            ) : filteredOperators.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              filteredOperators.map((operator) => (
                <TableRow 
                  key={operator.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(operator)}
                >
                  <TableCell className="font-medium text-center">{operator.code}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                      {operator.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{operator.phone || 'N/A'}</TableCell>
                  <TableCell className="text-center">{operator.representativeName || 'N/A'}</TableCell>
                  <TableCell className="text-center">
                    {operator.isTicketDelegated ? (
                      <span className="text-green-600 font-medium">Có</span>
                    ) : (
                      <span className="text-gray-500">Không</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={operator.isActive ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleView(operator)}
                        aria-label="Xem"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(operator)}
                        aria-label="Sửa"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(operator.id)}
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

      {/* Operator Dialog */}
      <OperatorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={viewMode}
        operator={selectedOperator}
        onSuccess={loadOperators}
      />

      {/* Operator Detail Dialog */}
      <OperatorDetailDialog
        open={detailDialogOpen}
        onClose={() => {
          setDetailDialogOpen(false)
          setSelectedOperatorForDetail(null)
        }}
        operator={selectedOperatorForDetail}
      />
    </div>
  )
}
