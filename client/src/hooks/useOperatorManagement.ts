import { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { operatorService } from "@/services/operator.service";
import { quanlyDataService } from "@/services/quanly-data.service";
import { useUIStore } from "@/store/ui.store";
import type { Operator } from "@/types";

export interface OperatorWithSource extends Operator {
  source?: "database" | "legacy" | "google_sheets";
  vehicleCount?: number;
}

const ITEMS_PER_PAGE = 20;

export function useOperatorManagement() {
  const [operators, setOperators] = useState<OperatorWithSource[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTicketDelegated, setFilterTicketDelegated] = useState("");
  const [filterProvince, setFilterProvince] = useState<"all" | "bac_ninh" | "ngoai_bac_ninh">("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "active" | "inactive">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"create" | "edit" | "view">("create");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOperatorForDetail, setSelectedOperatorForDetail] = useState<Operator | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [displayMode, setDisplayMode] = useState<"table" | "grid">("table");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [operatorToDelete, setOperatorToDelete] = useState<OperatorWithSource | null>(null);
  const setTitle = useUIStore((state) => state.setTitle);

  useEffect(() => {
    setTitle("Quản lý Đơn vị vận tải");
    loadOperators();
  }, [setTitle]);

  const loadOperators = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      // Use optimized unified endpoint for faster loading
      const data = await quanlyDataService.getOperators(forceRefresh);
      setOperators(data as OperatorWithSource[]);
    } catch (error) {
      console.error("Failed to load operators:", error);
      toast.error("Không thể tải danh sách đơn vị vận tải. Vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    const active = operators.filter((o) => o.isActive).length;
    const inactive = operators.length - active;
    const delegated = operators.filter((o) => o.isTicketDelegated).length;
    
    // Check if province contains "Bắc Ninh" (handles variations like "Tỉnh Bắc Ninh", "Bắc Ninh", etc.)
    const isBacNinh = (province: string | undefined) => 
      province && province.toLowerCase().includes("bắc ninh");
    
    const bacNinh = operators.filter((o) => isBacNinh(o.province)).length;
    const ngoaiBacNinh = operators.filter((o) => o.province && !isBacNinh(o.province)).length;
    return { total: operators.length, active, inactive, delegated, bacNinh, ngoaiBacNinh };
  }, [operators]);

  const filteredOperators = useMemo(() => {
    return operators.filter((operator) => {
      if (quickFilter === "active" && !operator.isActive) return false;
      if (quickFilter === "inactive" && operator.isActive) return false;

      // Province filter - check if province contains "Bắc Ninh"
      const isBacNinh = operator.province && operator.province.toLowerCase().includes("bắc ninh");
      if (filterProvince === "bac_ninh" && !isBacNinh) return false;
      if (filterProvince === "ngoai_bac_ninh") {
        if (!operator.province || isBacNinh) return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          operator.name.toLowerCase().includes(query) ||
          (operator.code || "").toLowerCase().includes(query) ||
          (operator.phone || "").toLowerCase().includes(query) ||
          (operator.address || "").toLowerCase().includes(query) ||
          (operator.province || "").toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (filterStatus) {
        const isActive = filterStatus === "active";
        if (operator.isActive !== isActive) return false;
      }
      if (filterTicketDelegated) {
        const isDelegated = filterTicketDelegated === "yes";
        if (operator.isTicketDelegated !== isDelegated) return false;
      }
      return true;
    });
  }, [operators, searchQuery, filterStatus, filterTicketDelegated, filterProvince, quickFilter]);

  const totalPages = Math.ceil(filteredOperators.length / ITEMS_PER_PAGE);

  const paginatedOperators = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOperators.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOperators, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterTicketDelegated, filterProvince, quickFilter]);

  const handleCreate = () => {
    setSelectedOperator(null);
    setViewMode("create");
    setDialogOpen(true);
  };

  const handleView = (operator: Operator) => {
    setSelectedOperator(operator);
    setViewMode("view");
    setDialogOpen(true);
  };

  const handleEdit = (operator: OperatorWithSource) => {
    setSelectedOperator(operator);
    setViewMode("edit");
    setDialogOpen(true);
  };

  const handleDelete = (operator: OperatorWithSource) => {
    setOperatorToDelete(operator);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!operatorToDelete) return;
    try {
      // Use legacy endpoint for Google Sheets data
      if (operatorToDelete.source === "legacy" || operatorToDelete.source === "google_sheets") {
        await operatorService.deleteLegacy(operatorToDelete.id);
      } else {
        await operatorService.delete(operatorToDelete.id);
      }
      toast.success("Xóa đơn vị vận tải thành công");
      setDeleteDialogOpen(false);
      setOperatorToDelete(null);
      loadOperators();
    } catch (error) {
      console.error("Failed to delete operator:", error);
      toast.error(
        "Không thể xóa đơn vị vận tải. Có thể đơn vị này đang có xe hoặc lái xe hoạt động."
      );
    }
  };

  const handleRowClick = (operator: Operator) => {
    setSelectedOperatorForDetail(operator);
    setDetailDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterStatus("");
    setFilterTicketDelegated("");
    setFilterProvince("all");
    setQuickFilter("all");
  };

  const hasActiveFilters = searchQuery || filterStatus || filterTicketDelegated || filterProvince !== "all";

  return {
    // Data
    operators,
    paginatedOperators,
    filteredOperators,
    stats,
    // Search & Filters
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    filterTicketDelegated,
    setFilterTicketDelegated,
    filterProvince,
    setFilterProvince,
    quickFilter,
    setQuickFilter,
    hasActiveFilters,
    clearFilters,
    showAdvancedFilters,
    setShowAdvancedFilters,
    // Loading
    isLoading,
    loadOperators,
    // Pagination
    currentPage,
    setCurrentPage,
    totalPages,
    ITEMS_PER_PAGE,
    // Display
    displayMode,
    setDisplayMode,
    // Dialog states
    dialogOpen,
    setDialogOpen,
    viewMode,
    selectedOperator,
    detailDialogOpen,
    setDetailDialogOpen,
    selectedOperatorForDetail,
    setSelectedOperatorForDetail,
    deleteDialogOpen,
    setDeleteDialogOpen,
    operatorToDelete,
    setOperatorToDelete,
    // Handlers
    handleCreate,
    handleView,
    handleEdit,
    handleDelete,
    confirmDelete,
    handleRowClick,
  };
}
