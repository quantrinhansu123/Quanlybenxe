import { useState, useEffect } from "react"
import { toast } from "react-toastify"
import { Plus, Search, Edit, Eye, Trash2, RefreshCw, ChevronDown, ChevronUp, Filter } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { StatusBadge } from "@/components/layout/StatusBadge"
import { serviceFormulaService } from "@/services/service-formula.service"
import type { ServiceFormula } from "@/types"
import { useUIStore } from "@/store/ui.store"
import { FormulaDialog } from "@/components/service/FormulaDialog"

export default function QuanLyBieuThuc() {
  const [formulas, setFormulas] = useState<ServiceFormula[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFormula, setSelectedFormula] = useState<ServiceFormula | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"create" | "edit" | "view">("create")
  const [expandedSections, setExpandedSections] = useState<Set<'quantity' | 'price'>>(new Set(['quantity', 'price']))
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [createFormulaType, setCreateFormulaType] = useState<'quantity' | 'price'>('quantity')
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Quản lý biểu thức")
    loadFormulas()
  }, [setTitle])

  const loadFormulas = async () => {
    setIsLoading(true)
    try {
      const data = await serviceFormulaService.getAll()
      setFormulas(data)
    } catch (error) {
      console.error("Failed to load formulas:", error)
      toast.error("Không thể tải danh sách biểu thức. Vui lòng thử lại sau.")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSection = (type: 'quantity' | 'price') => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }

  const filteredFormulas = (type: 'quantity' | 'price') => {
    return formulas.filter((formula) => {
      if (formula.formulaType !== type) return false

      // Fulltext search - search across all fields
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const searchableText = [
          formula.code,
          formula.name,
          formula.description || '',
          formula.usedByServices || '',
        ].join(' ').toLowerCase()
        
        if (!searchableText.includes(query)) {
          return false
        }
      }

      // Status filter
      if (filterStatus) {
        const isActive = filterStatus === "active"
        if (formula.isActive !== isActive) return false
      }

      return true
    })
  }

  const handleCreate = (type: 'quantity' | 'price') => {
    setSelectedFormula(null)
    setCreateFormulaType(type)
    setViewMode("create")
    setDialogOpen(true)
  }

  const handleEdit = (formula: ServiceFormula) => {
    setSelectedFormula(formula)
    setViewMode("edit")
    setDialogOpen(true)
  }

  const handleView = (formula: ServiceFormula) => {
    setSelectedFormula(formula)
    setViewMode("view")
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa biểu thức này?")) {
      try {
        await serviceFormulaService.delete(id)
        toast.success("Xóa biểu thức thành công")
        loadFormulas()
      } catch (error: any) {
        console.error("Failed to delete formula:", error)
        toast.error(error.response?.data?.error || "Không thể xóa biểu thức. Vui lòng thử lại sau.")
      }
    }
  }

  const quantityFormulas = filteredFormulas('quantity')
  const priceFormulas = filteredFormulas('price')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý biểu thức</h1>
          <p className="text-gray-600 mt-1">Quản lý biểu thức tính số lượng và tính đơn giá</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" title="Làm mới" onClick={loadFormulas}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Lọc">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tìm kiếm</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Tìm kiếm theo mã, tên, ghi chú, dịch vụ..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Lọc theo trạng thái</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="active">Đang áp dụng</option>
                  <option value="inactive">Ngừng áp dụng</option>
                </select>
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
                <TableHead className="w-10"></TableHead>
                <TableHead>Mã biểu thức</TableHead>
                <TableHead>Tên biểu thức</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead>Đang được sử dụng bởi dịch vụ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex justify-center items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Đang tải...
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Tính số lượng Section */}
                  <TableRow className="bg-blue-50">
                    <TableCell colSpan={7} className="p-0">
                      <div className="w-full flex items-center justify-between p-4 hover:bg-blue-100">
                        <div 
                          className="flex items-center gap-2 cursor-pointer flex-1"
                          onClick={() => toggleSection('quantity')}
                        >
                          {expandedSections.has('quantity') ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                          <span className="font-semibold text-gray-900">Tính số lượng</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCreate('quantity')}
                          className="h-7"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Thêm
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedSections.has('quantity') && (
                    <>
                      {quantityFormulas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            Không có dữ liệu
                          </TableCell>
                        </TableRow>
                      ) : (
                        quantityFormulas.map((formula) => (
                          <TableRow key={formula.id} className="hover:bg-gray-50">
                            <TableCell>
                              <Checkbox />
                            </TableCell>
                            <TableCell className="font-medium">{formula.code}</TableCell>
                            <TableCell>{formula.name}</TableCell>
                            <TableCell>{formula.description || "-"}</TableCell>
                            <TableCell>
                              {formula.usedByServices || "-"}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                status={formula.isActive ? "active" : "inactive"}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleView(formula)}
                                  aria-label="Xem"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(formula)}
                                  aria-label="Sửa"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(formula.id)}
                                  aria-label="Xóa"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </>
                  )}

                  {/* Tính đơn giá Section */}
                  <TableRow className="bg-green-50">
                    <TableCell colSpan={7} className="p-0">
                      <div className="w-full flex items-center justify-between p-4 hover:bg-green-100">
                        <div 
                          className="flex items-center gap-2 cursor-pointer flex-1"
                          onClick={() => toggleSection('price')}
                        >
                          {expandedSections.has('price') ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                          <span className="font-semibold text-gray-900">Tính đơn giá</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCreate('price')}
                          className="h-7"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Thêm
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedSections.has('price') && (
                    <>
                      {priceFormulas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            Không có dữ liệu
                          </TableCell>
                        </TableRow>
                      ) : (
                        priceFormulas.map((formula) => (
                          <TableRow key={formula.id} className="hover:bg-gray-50">
                            <TableCell>
                              <Checkbox />
                            </TableCell>
                            <TableCell className="font-medium">{formula.code}</TableCell>
                            <TableCell>{formula.name}</TableCell>
                            <TableCell>{formula.description || "-"}</TableCell>
                            <TableCell>
                              {formula.usedByServices || "-"}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                status={formula.isActive ? "active" : "inactive"}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleView(formula)}
                                  aria-label="Xem"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(formula)}
                                  aria-label="Sửa"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(formula.id)}
                                  aria-label="Xóa"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Dialog */}
      <FormulaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        viewMode={viewMode}
        selectedFormula={selectedFormula}
        onSuccess={loadFormulas}
        defaultFormulaType={viewMode === "create" ? createFormulaType : undefined}
      />
    </div>
  )
}

