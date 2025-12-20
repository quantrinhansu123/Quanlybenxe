import { useState, useEffect, useMemo } from "react"
import { toast } from "react-toastify"
import { 
  Plus, 
  Search, 
  Edit, 
  Eye, 
  Trash2, 
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  RefreshCw,
  Phone,
  User,
  CheckCircle,
  AlertCircle,
  Ticket,
  TrendingUp,
  SlidersHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { operatorService } from "@/services/operator.service"
import type { Operator } from "@/types"
import { useUIStore } from "@/store/ui.store"
import { OperatorDialog } from "@/components/operator/OperatorDialog"
import { OperatorDetailDialog } from "@/components/operator/OperatorDetailDialog"

// Extended operator type with source info
interface OperatorWithSource extends Operator {
  source?: 'database' | 'legacy'
}

// Skeleton Row Component
const SkeletonRow = () => (
  <tr className="animate-pulse">
    <td className="px-6 py-4"><div className="h-8 w-20 bg-slate-200 rounded-lg" /></td>
    <td className="px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200" />
        <div className="h-4 w-48 bg-slate-200 rounded" />
      </div>
    </td>
    <td className="px-6 py-4"><div className="h-4 w-28 bg-slate-200 rounded" /></td>
    <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-200 rounded" /></td>
    <td className="px-6 py-4 text-center"><div className="h-6 w-12 bg-slate-200 rounded-full mx-auto" /></td>
    <td className="px-6 py-4 text-center"><div className="h-6 w-20 bg-slate-200 rounded-full mx-auto" /></td>
    <td className="px-6 py-4"><div className="h-8 w-24 bg-slate-200 rounded mx-auto" /></td>
  </tr>
)

// Quick Filter Chip
const QuickFilter = ({ label, count, active, onClick }: { 
  label: string; count?: number; active?: boolean; onClick: () => void 
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
      active 
        ? "bg-orange-500 text-white shadow-md shadow-orange-500/25" 
        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`}
  >
    {label}
    {count !== undefined && (
      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
        active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
      }`}>
        {count.toLocaleString()}
      </span>
    )}
  </button>
)

const ITEMS_PER_PAGE = 20

export default function QuanLyDonViVanTai() {
  const [operators, setOperators] = useState<OperatorWithSource[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterTicketDelegated, setFilterTicketDelegated] = useState("")
  const [quickFilter, setQuickFilter] = useState<"all" | "active" | "inactive">("all")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"create" | "edit" | "view">("create")
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedOperatorForDetail, setSelectedOperatorForDetail] = useState<Operator | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [displayMode, setDisplayMode] = useState<"table" | "grid">("table")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [operatorToDelete, setOperatorToDelete] = useState<OperatorWithSource | null>(null)
  const setTitle = useUIStore((state) => state.setTitle)

  useEffect(() => {
    setTitle("Quản lý Đơn vị vận tải")
    loadOperators()
  }, [setTitle])

  const loadOperators = async () => {
    setIsLoading(true)
    try {
      const data = await operatorService.getLegacy()
      setOperators(data as OperatorWithSource[])
    } catch (error) {
      console.error("Failed to load operators:", error)
      toast.error("Không thể tải danh sách đơn vị vận tải. Vui lòng thử lại sau.")
    } finally {
      setIsLoading(false)
    }
  }

  // Stats
  const stats = useMemo(() => {
    const active = operators.filter(o => o.isActive).length
    const inactive = operators.length - active
    const delegated = operators.filter(o => o.isTicketDelegated).length
    return { total: operators.length, active, inactive, delegated }
  }, [operators])

  const filteredOperators = useMemo(() => {
    return operators.filter((operator) => {
      // Quick filter
      if (quickFilter === "active" && !operator.isActive) return false
      if (quickFilter === "inactive" && operator.isActive) return false

      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = 
          operator.name.toLowerCase().includes(query) ||
          (operator.code || '').toLowerCase().includes(query) ||
          (operator.phone || '').toLowerCase().includes(query)
        if (!matchesSearch) return false
      }
      if (filterStatus) {
        const isActive = filterStatus === "active"
        if (operator.isActive !== isActive) return false
      }
      if (filterTicketDelegated) {
        const isDelegated = filterTicketDelegated === "yes"
        if (operator.isTicketDelegated !== isDelegated) return false
      }
      return true
    })
  }, [operators, searchQuery, filterStatus, filterTicketDelegated, quickFilter])

  // Pagination
  const totalPages = Math.ceil(filteredOperators.length / ITEMS_PER_PAGE)
  const paginatedOperators = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredOperators.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredOperators, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterStatus, filterTicketDelegated, quickFilter])

  const handleCreate = () => {
    setSelectedOperator(null)
    setViewMode("create")
    setDialogOpen(true)
  }

  const handleView = (operator: Operator) => {
    setSelectedOperator(operator)
    setViewMode("view")
    setDialogOpen(true)
  }

  const handleEdit = (operator: OperatorWithSource) => {
    if (operator.source === 'legacy') {
      toast.warning("Không thể chỉnh sửa đơn vị từ dữ liệu legacy")
      return
    }
    setSelectedOperator(operator)
    setViewMode("edit")
    setDialogOpen(true)
  }

  const handleDelete = (operator: OperatorWithSource) => {
    if (operator.source === 'legacy') {
      toast.warning("Không thể xóa đơn vị từ dữ liệu legacy")
      return
    }
    setOperatorToDelete(operator)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!operatorToDelete) return
    try {
      await operatorService.delete(operatorToDelete.id)
      toast.success("Xóa đơn vị vận tải thành công")
      setDeleteDialogOpen(false)
      setOperatorToDelete(null)
      loadOperators()
    } catch (error) {
      console.error("Failed to delete operator:", error)
      toast.error("Không thể xóa đơn vị vận tải. Có thể đơn vị này đang có xe hoặc lái xe hoạt động.")
    }
  }

  const handleRowClick = (operator: Operator) => {
    setSelectedOperatorForDetail(operator)
    setDetailDialogOpen(true)
  }

  const clearFilters = () => {
    setSearchQuery("")
    setFilterStatus("")
    setFilterTicketDelegated("")
    setQuickFilter("all")
  }

  const hasActiveFilters = searchQuery || filterStatus || filterTicketDelegated

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-orange-50">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-xl shadow-orange-500/30">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                Quản lý Đơn vị vận tải
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Quản lý thông tin các đơn vị vận tải hành khách
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={loadOperators}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
            <Button
              onClick={handleCreate}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30 transition-all hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4 mr-2" />
              Thêm đơn vị
            </Button>
          </div>
        </div>

        {/* Hero Stats - Asymmetric Layout */}
        <div className="grid grid-cols-12 gap-4">
          {/* Primary Stat - Hero Card */}
          <div className="col-span-12 lg:col-span-5 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 rounded-3xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-2 text-orange-100 mb-2">
                <Building2 className="h-5 w-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Tổng số đơn vị</span>
              </div>
              <p className="text-6xl font-bold tracking-tight">{stats.total.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-4 text-orange-100">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Đang quản lý trong hệ thống</span>
              </div>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="col-span-12 lg:col-span-7 grid grid-cols-3 gap-4">
            {/* Active */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-emerald-100 group-hover:bg-emerald-500 transition-colors">
                  <CheckCircle className="w-4 h-4 text-emerald-600 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-800">{stats.active.toLocaleString()}</p>
              <p className="text-sm text-slate-500 mt-1">Đang hoạt động</p>
              <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.active / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Inactive */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-rose-100 group-hover:bg-rose-500 transition-colors">
                  <AlertCircle className="w-4 h-4 text-rose-600 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-full">
                  {stats.total > 0 ? Math.round((stats.inactive / stats.total) * 100) : 0}%
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-800">{stats.inactive.toLocaleString()}</p>
              <p className="text-sm text-slate-500 mt-1">Ngừng hoạt động</p>
              <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.inactive / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Ticket Delegated */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-violet-100 group-hover:bg-violet-500 transition-colors">
                  <Ticket className="w-4 h-4 text-violet-600 group-hover:text-white transition-colors" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-800">{stats.delegated.toLocaleString()}</p>
              <p className="text-sm text-slate-500 mt-1">Ủy thác vé</p>
              <div className="mt-3 flex items-center gap-1">
                {Array.from({ length: Math.min(5, stats.delegated) }).map((_, i) => (
                  <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 border-2 border-white -ml-2 first:ml-0" />
                ))}
                {stats.delegated > 5 && (
                  <span className="text-xs text-slate-500 ml-1">+{stats.delegated - 5}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Unified Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-col lg:flex-row lg:items-center gap-2">
          {/* Search Input */}
          <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl">
            <Search className="w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm tên, mã đơn vị, số điện thoại..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Divider */}
          <div className="hidden lg:block w-px h-10 bg-slate-200" />
          
          {/* Quick Filters */}
          <div className="flex items-center gap-2 px-2">
            <QuickFilter 
              label="Tất cả" 
              count={stats.total} 
              active={quickFilter === "all"} 
              onClick={() => setQuickFilter("all")} 
            />
            <QuickFilter 
              label="Hoạt động" 
              count={stats.active} 
              active={quickFilter === "active"} 
              onClick={() => setQuickFilter("active")} 
            />
            <QuickFilter 
              label="Ngừng" 
              count={stats.inactive} 
              active={quickFilter === "inactive"} 
              onClick={() => setQuickFilter("inactive")} 
            />
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px h-10 bg-slate-200" />

          {/* View Toggle */}
          <div className="flex items-center gap-2 px-2">
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setDisplayMode("table")}
                className={`p-2.5 rounded-lg transition-all ${
                  displayMode === "table" 
                    ? "bg-white text-orange-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDisplayMode("grid")}
                className={`p-2.5 rounded-lg transition-all ${
                  displayMode === "grid" 
                    ? "bg-white text-orange-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>

            <Button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-4 py-2.5 rounded-xl border transition-all ${
                showAdvancedFilters || hasActiveFilters
                  ? "bg-orange-50 border-orange-200 text-orange-600"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Nâng cao
            </Button>
          </div>
        </div>

        {/* Advanced Filter Panel */}
        {showAdvancedFilters && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-600 mb-2 block">Trạng thái</Label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Ngừng hoạt động</option>
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600 mb-2 block">Ủy thác vé</Label>
                <select
                  value={filterTicketDelegated}
                  onChange={(e) => setFilterTicketDelegated(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                >
                  <option value="">Tất cả</option>
                  <option value="yes">Có ủy thác</option>
                  <option value="no">Không ủy thác</option>
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
                >
                  Xóa bộ lọc
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Results info */}
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Hiển thị <strong className="text-slate-700">{paginatedOperators.length}</strong> trong tổng số <strong className="text-slate-700">{filteredOperators.length.toLocaleString()}</strong> đơn vị
          </span>
          {totalPages > 1 && (
            <span>Trang {currentPage} / {totalPages}</span>
          )}
        </div>

        {/* Content - Table View */}
        {displayMode === "table" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-800 to-slate-900">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Mã ĐV
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Tên đơn vị
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                      Số điện thoại
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                      Người đại diện
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                      Ủy thác vé
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : paginatedOperators.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center">
                          <div className="relative mb-4">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                              <Building2 className="h-12 w-12 text-orange-500" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border-2 border-orange-500 flex items-center justify-center">
                              <Plus className="w-4 h-4 text-orange-500" />
                            </div>
                          </div>
                          <h3 className="text-lg font-semibold text-slate-800 mb-1">Chưa có đơn vị nào</h3>
                          <p className="text-slate-500 mb-4">Bắt đầu bằng cách thêm đơn vị đầu tiên</p>
                          {hasActiveFilters ? (
                            <Button onClick={clearFilters} className="text-orange-600 hover:text-orange-700">
                              Xóa bộ lọc
                            </Button>
                          ) : (
                            <Button onClick={handleCreate} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-6 py-2.5">
                              <Plus className="w-4 h-4 mr-2" />
                              Thêm đơn vị
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedOperators.map((operator, index) => {
                      const isLegacy = operator.source === 'legacy'
                      return (
                        <tr 
                          key={operator.id} 
                          className="group hover:bg-orange-50/50 transition-colors cursor-pointer"
                          onClick={() => handleRowClick(operator)}
                          style={{ 
                            animation: 'fadeInUp 0.3s ease forwards',
                            animationDelay: `${index * 30}ms`,
                            opacity: 0
                          }}
                        >
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm font-medium bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg">
                              {operator.code || "-"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center group-hover:from-orange-500 group-hover:to-amber-500 transition-colors">
                                <Building2 className="h-5 w-5 text-orange-600 group-hover:text-white transition-colors" />
                              </div>
                              <span className="font-semibold text-slate-800 max-w-[300px] truncate">{operator.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Phone className="h-4 w-4 text-slate-400" />
                              <span className="text-slate-600">{operator.phone || "-"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <User className="h-4 w-4 text-slate-400" />
                              <span className="text-slate-600">{operator.representativeName || "-"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {operator.isTicketDelegated ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
                                <CheckCircle className="h-3 w-3" />
                                Có
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                              operator.isActive 
                                ? "bg-emerald-100 text-emerald-700" 
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${
                                operator.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                              }`} />
                              {operator.isActive ? "Hoạt động" : "Ngừng"}
                            </span>
                          </td>
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleView(operator); }}
                                className="p-2 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-all"
                                title="Xem chi tiết"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEdit(operator); }}
                                className={`p-2 rounded-lg transition-all ${
                                  isLegacy 
                                    ? "text-slate-300 cursor-not-allowed" 
                                    : "text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                                }`}
                                title={isLegacy ? "Không thể sửa dữ liệu legacy" : "Chỉnh sửa"}
                                disabled={isLegacy}
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(operator); }}
                                className={`p-2 rounded-lg transition-all ${
                                  isLegacy 
                                    ? "text-slate-300 cursor-not-allowed" 
                                    : "text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                                }`}
                                title={isLegacy ? "Không thể xóa dữ liệu legacy" : "Xóa"}
                                disabled={isLegacy}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Content - Grid View */}
        {displayMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-200" />
                    <div className="flex-1">
                      <div className="h-5 bg-slate-200 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-100 rounded" />
                    <div className="h-3 bg-slate-100 rounded w-2/3" />
                  </div>
                </div>
              ))
            ) : paginatedOperators.length === 0 ? (
              <div className="col-span-full py-16 text-center">
                <Building2 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800">Không tìm thấy đơn vị nào</h3>
              </div>
            ) : (
              paginatedOperators.map((operator, index) => {
                const isLegacy = operator.source === 'legacy'
                return (
                  <div 
                    key={operator.id} 
                    className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-orange-200 transition-all group hover:-translate-y-1 cursor-pointer"
                    onClick={() => handleRowClick(operator)}
                    style={{ 
                      animation: 'fadeInUp 0.3s ease forwards',
                      animationDelay: `${index * 50}ms`,
                      opacity: 0
                    }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center group-hover:from-orange-500 group-hover:to-amber-500 transition-colors">
                          <Building2 className="h-6 w-6 text-orange-600 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 line-clamp-1">{operator.name}</h3>
                          <p className="text-sm text-slate-500">{operator.code || "Không có mã"}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        operator.isActive 
                          ? "bg-emerald-100 text-emerald-700" 
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          operator.isActive ? "bg-emerald-500" : "bg-slate-400"
                        }`} />
                        {operator.isActive ? "Hoạt động" : "Ngừng"}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600">{operator.phone || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600 truncate">{operator.representativeName || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Ticket className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600">
                          {operator.isTicketDelegated ? "Có ủy thác vé" : "Không ủy thác"}
                        </span>
                      </div>
                    </div>

                    <div 
                      className="flex items-center justify-end gap-1 pt-4 border-t border-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); handleView(operator); }}
                        className="p-2 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-all"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(operator); }}
                        className={`p-2 rounded-lg transition-all ${
                          isLegacy 
                            ? "text-slate-300 cursor-not-allowed" 
                            : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                        }`}
                        disabled={isLegacy}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(operator); }}
                        className={`p-2 rounded-lg transition-all ${
                          isLegacy 
                            ? "text-slate-300 cursor-not-allowed" 
                            : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        }`}
                        disabled={isLegacy}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Hiển thị {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredOperators.length)} trong tổng số {filteredOperators.length.toLocaleString()} đơn vị
              </p>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => 
                      page === 1 || 
                      page === totalPages || 
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    )
                    .map((page, index, array) => (
                      <span key={page} className="flex items-center">
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <span className="px-2 text-slate-400">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`min-w-[40px] h-10 rounded-xl text-sm font-medium transition-all ${
                            currentPage === page
                              ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {page}
                        </button>
                      </span>
                    ))}
                </div>

                <Button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

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

        {/* Delete Confirmation Dialog */}
        {deleteDialogOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-2xl bg-rose-100">
                  <AlertCircle className="h-6 w-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Xác nhận xóa đơn vị</h3>
                  <p className="text-sm text-slate-500">Thao tác này không thể hoàn tác</p>
                </div>
              </div>
              <p className="text-slate-600 mb-6">
                Bạn có chắc chắn muốn xóa đơn vị <strong className="text-slate-800">{operatorToDelete?.name}</strong>?
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => {
                    setDeleteDialogOpen(false)
                    setOperatorToDelete(null)
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Hủy
                </Button>
                <Button
                  onClick={confirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 text-white hover:from-rose-600 hover:to-red-600 shadow-lg shadow-rose-500/25 transition-all"
                >
                  Xóa đơn vị
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
