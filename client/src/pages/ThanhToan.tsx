import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ChevronDown,
  RefreshCw,
  FileSpreadsheet,
  Clock,
  Receipt,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Search,
  Wallet,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { dispatchService } from "@/services/dispatch.service";
import { serviceChargeService } from "@/services/service-charge.service";
import type { DispatchRecord, ServiceCharge, ServiceType } from "@/types";
import { format } from "date-fns";
import { useUIStore } from "@/store/ui.store";
import * as XLSX from "xlsx";
import { DatePickerRange } from "@/components/DatePickerRange";
import { type DateRange } from "react-day-picker";
import {
  PaymentStatsCard,
  OrderCard,
  VehicleInfoCard,
  ServicesCard,
  PaymentSidebar,
  ZeroAmountWarningDialog,
} from "@/components/payment";
import { useCachedQuery, CACHE_TTL } from "@/lib/query-cache";

export default function ThanhToan() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setTitle = useUIStore((state) => state.setTitle);

  // Detail view state
  const [record, setRecord] = useState<DispatchRecord | null>(null);
  const [serviceCharges, setServiceCharges] = useState<ServiceCharge[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [symbol, setSymbol] = useState("QLBX");
  const [note, setNote] = useState("");
  const [printOneCopy, setPrintOneCopy] = useState(true);
  const [printTwoCopies, setPrintTwoCopies] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showZeroAmountWarning, setShowZeroAmountWarning] = useState(false);

  // List view state - use cached query for dispatch records
  const { data: allDispatchRecords, isLoading: isListLoading, refetch: refetchList } = useCachedQuery<DispatchRecord[]>(
    'thanhtoan-dispatch-list',
    () => dispatchService.getAll(),
    { ttl: CACHE_TTL.SHORT, staleTime: 30000, enabled: !id } // Only fetch when no ID (list view)
  );

  // Filter to last 7 days for list view
  const allData = useMemo(() => {
    if (!allDispatchRecords) return [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    return allDispatchRecords.filter(record => {
      const entryTime = new Date(record.entryTime);
      return entryTime >= sevenDaysAgo;
    });
  }, [allDispatchRecords]);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [orderType, setOrderType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Filtered list data
  const listData = useMemo(() => {
    let filtered = [...allData];

    if (dateRange?.from && dateRange?.to) {
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(record => {
        const entryTime = new Date(record.entryTime);
        return entryTime >= fromDate && entryTime <= toDate;
      });
    } else if (dateRange?.from) {
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(record => new Date(record.entryTime) >= fromDate);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record =>
        record.vehiclePlateNumber?.toLowerCase().includes(query) ||
        record.transportOrderCode?.toLowerCase().includes(query) ||
        record.vehicle?.operator?.name?.toLowerCase().includes(query) ||
        record.routeName?.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());
    return filtered;
  }, [allData, dateRange, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => ({
    total: listData.length,
    pending: listData.filter(i => i.currentStatus !== 'paid' && i.currentStatus !== 'departed').length,
    paid: listData.filter(i => i.currentStatus === 'paid' || i.currentStatus === 'departed').length,
    totalAmount: listData
      .filter(i => i.currentStatus === 'paid' || i.currentStatus === 'departed')
      .reduce((sum, i) => sum + (i.paymentAmount || 0), 0)
  }), [listData]);

  useEffect(() => {
    if (id) {
      setTitle("Xác nhận thanh toán");
      loadData();
    } else {
      setTitle("Quản lý đơn hàng");
      // Data is loaded via useCachedQuery
    }
  }, [id, setTitle]);

  // Clean up selected items when filtered list changes
  useEffect(() => {
    setSelectedItems(prev => {
      const newSet = new Set<string>();
      prev.forEach(itemId => {
        const item = listData.find(i => i.id === itemId);
        if (item && item.currentStatus !== 'paid' && item.currentStatus !== 'departed') {
          newSet.add(itemId);
        }
      });
      return newSet;
    });
  }, [listData]);

  const loadListData = async () => {
    await refetchList();
  };

  const handleExportExcel = () => {
    if (listData.length === 0) {
      toast.warning("Không có dữ liệu để xuất Excel");
      return;
    }

    try {
      const excelData = listData.map((item, index) => ({
        "STT": index + 1,
        "Mã đơn hàng": item.transportOrderCode || item.id.substring(0, 8),
        "Biển kiểm soát": item.vehiclePlateNumber,
        "Đơn vị vận tải": item.vehicle?.operator?.name || "-",
        "Tuyến vận chuyển": item.routeName || "-",
        "Giờ xuất bến KH": item.plannedDepartureTime
          ? format(new Date(item.plannedDepartureTime), "HH:mm")
          : "-",
        "Ngày tạo": format(new Date(item.entryTime), "dd/MM/yyyy HH:mm"),
        "Người tạo": item.entryBy || "-",
        "Tổng tiền (đồng)": item.paymentAmount || 0,
        "Trạng thái": item.currentStatus === 'paid' ? 'Đã thanh toán' :
          item.currentStatus === 'departed' ? 'Đã xuất bến' : 'Chưa thanh toán'
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh sách đơn hàng");

      const fromDateStr = dateRange?.from ? format(dateRange.from, "dd-MM-yyyy") : format(new Date(), "dd-MM-yyyy");
      const toDateStr = dateRange?.to ? format(dateRange.to, "dd-MM-yyyy") : format(new Date(), "dd-MM-yyyy");
      XLSX.writeFile(wb, `Danh-sach-don-hang_${fromDateStr}_${toDateStr}.xlsx`);
      toast.success("Đã xuất Excel thành công");
    } catch (error) {
      console.error("Failed to export Excel:", error);
      toast.error("Không thể xuất Excel");
    }
  };

  const loadData = async () => {
    if (!id) {
      console.error('[ThanhToan] No ID parameter provided');
      toast.error('Không tìm thấy mã đơn hàng');
      navigate("/dieu-do");
      return;
    }

    setIsLoading(true);
    console.log('[ThanhToan] Loading data for dispatch ID:', id);

    try {
      // Load dispatch record first - this is required
      const recordData = await dispatchService.getById(id);
      console.log('[ThanhToan] Record loaded:', recordData ? {
        id: recordData.id,
        status: recordData.currentStatus,
        permitStatus: recordData.permitStatus,
        plate: recordData.vehiclePlateNumber
      } : 'null');

      if (!recordData) {
        console.error('[ThanhToan] Record not found for ID:', id);
        toast.error('Không tìm thấy thông tin đơn hàng');
        navigate("/dieu-do");
        return;
      }

      setRecord(recordData);
      setNote(`Đơn hàng điều độ (${format(new Date(recordData.entryTime), "dd/MM/yyyy HH:mm")})`);

      // Load service charges and types - these can fail without blocking the page
      try {
        const [chargesData, typesData] = await Promise.all([
          serviceChargeService.getAll(id),
          serviceChargeService.getServiceTypes(true)
        ]);
        setServiceCharges(chargesData);
        setServiceTypes(typesData);
      } catch (chargeError) {
        console.warn('[ThanhToan] Failed to load service charges:', chargeError);
        // Don't block - show page with empty charges
        setServiceCharges([]);
        setServiceTypes([]);
      }
    } catch (error) {
      console.error("[ThanhToan] Failed to load payment data:", error);
      toast.error("Không thể tải dữ liệu thanh toán");
      navigate("/dieu-do");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotals = () => {
    const subtotal = serviceCharges.reduce((sum, charge) => sum + charge.totalAmount, 0);
    const discount = 0;
    const tax = 0;
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  };

  const processPayment = async () => {
    if (!record) return;
    const { total } = calculateTotals();

    console.log('[ThanhToan] Processing payment:', {
      recordId: record.id,
      amount: total,
      status: record.currentStatus,
      permitStatus: record.permitStatus
    });

    setIsProcessing(true);
    try {
      await dispatchService.processPayment(record.id, { paymentAmount: total, paymentMethod: 'cash' });
      console.log('[ThanhToan] Payment successful');
      toast.success("Thanh toán thành công!");
      navigate("/thanh-toan");
    } catch (error) {
      console.error("[ThanhToan] Failed to process payment:", error);
      toast.error("Không thể xử lý thanh toán");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (!record) return;
    const { total } = calculateTotals();
    if (total === 0) {
      setShowZeroAmountWarning(true);
      return;
    }
    await processPayment();
  };

  const handleCancel = async () => {
    if (!record) return;
    
    const reason = window.prompt(
      "Bạn có chắc chắn muốn hủy bỏ record này?\n\nNhập lý do hủy (bắt buộc):",
      ""
    );
    
    if (reason === null) return; // User clicked Cancel
    if (!reason.trim()) {
      toast.warning("Vui lòng nhập lý do hủy");
      return;
    }

    try {
      await dispatchService.cancel(record.id, reason.trim());
      toast.success("Đã hủy bỏ record thành công");
      navigate("/thanh-toan");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Không thể hủy bỏ record");
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      return newSet;
    });
  };

  const handleBatchPayment = () => {
    if (selectedItems.size === 0) {
      toast.warning("Vui lòng chọn ít nhất một đơn hàng");
      return;
    }
    const selectedRecord = listData.find(item => selectedItems.has(item.id));
    if (selectedRecord) navigate(`/thanh-toan/${selectedRecord.id}`);
  };

  // ========== LIST VIEW ==========
  if (!id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
        <div className="p-4 lg:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
                  <Receipt className="w-6 h-6" />
                </div>
                Quản lý đơn hàng
              </h1>
              <p className="text-gray-500 mt-1">Theo dõi và xử lý thanh toán</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadListData} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Làm mới
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
                <FileSpreadsheet className="w-4 h-4" /> Xuất Excel
              </Button>
              {selectedItems.size > 0 && (
                <Button size="sm" onClick={handleBatchPayment} className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500">
                  <Banknote className="w-4 h-4" /> Thanh toán ({selectedItems.size})
                </Button>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <PaymentStatsCard title="Tổng đơn hàng" value={stats.total} subtitle="Trong khoảng thời gian" icon={Receipt} gradient="from-blue-500 to-indigo-600" />
            <PaymentStatsCard title="Chờ thanh toán" value={stats.pending} subtitle="Cần xử lý" icon={Clock} gradient="from-amber-500 to-orange-500" />
            <PaymentStatsCard title="Đã thanh toán" value={stats.paid} subtitle="Hoàn thành" icon={CheckCircle2} gradient="from-emerald-500 to-teal-500" />
            <PaymentStatsCard title="Tổng doanh thu" value={`${(stats.totalAmount / 1000000).toFixed(1)}M`} subtitle={`${stats.totalAmount.toLocaleString('vi-VN')}đ`} icon={Wallet} gradient="from-violet-500 to-purple-600" />
          </div>

          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder="Tìm theo biển số, mã đơn, đơn vị, tuyến..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                </div>
                <div className="w-full lg:w-80">
                  <DatePickerRange range={dateRange} onRangeChange={setDateRange} placeholder="Chọn khoảng thời gian" label="" className="w-full" />
                </div>
                <div className="w-full lg:w-48">
                  <Select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="w-full">
                    <option value="all">Tất cả loại</option>
                    <option value="thanh-toan-chuyen">Thanh toán chuyến</option>
                    <option value="thanh-toan-dinh-ky">Thanh toán định kỳ</option>
                    <option value="thanh-toan-vang-lai">Vãng lai</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orders Grid */}
          {isListLoading && !allDispatchRecords ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-500 mt-4">Đang tải dữ liệu...</p>
              </div>
            </div>
          ) : listData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Receipt className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg font-medium">Không có đơn hàng nào</p>
              <p className="text-gray-400 text-sm mt-1">Thay đổi bộ lọc để xem thêm</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {listData.map(item => (
                <OrderCard key={item.id} item={item} isSelected={selectedItems.has(item.id)} onSelect={() => toggleItemSelection(item.id)} onNavigate={() => navigate(`/thanh-toan/${item.id}`)} />
              ))}
            </div>
          )}

          {/* Footer Summary */}
          {listData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Hiển thị <strong>{listData.length}</strong> đơn hàng</span>
                  {selectedItems.size > 0 && <span className="text-blue-600">| Đã chọn <strong>{selectedItems.size}</strong></span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Tổng:</span>
                  <span className="text-2xl font-bold text-emerald-600">{stats.totalAmount.toLocaleString('vi-VN')}đ</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== DETAIL VIEW ==========
  const { subtotal, discount, tax, total } = calculateTotals();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 mt-4">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-gray-600 text-lg">Không tìm thấy thông tin thanh toán</p>
          <Button onClick={() => navigate("/dieu-do")} className="mt-4">Quay lại</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <button onClick={() => navigate("/thanh-toan")} className="hover:text-blue-600 transition-colors">Quản lý đơn hàng</button>
          <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
          <span className="text-gray-900 font-medium">Thanh toán</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="xl:col-span-2 space-y-6">
            <VehicleInfoCard record={record} />
            <ServicesCard record={record} serviceCharges={serviceCharges} serviceTypes={serviceTypes} onChargesUpdate={setServiceCharges} />

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleCancel} className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
                <X className="w-4 h-4" /> Hủy bỏ record
              </Button>
              <Button variant="outline" onClick={() => navigate(`/bao-cao/xe-tra-khach?vehiclePlateNumber=${encodeURIComponent(record.vehiclePlateNumber)}&returnTo=/thanh-toan/${id}`)} className="gap-2">
                <FileText className="w-4 h-4" /> Lịch sử trả khách
              </Button>
              <Button variant="outline" onClick={() => navigate(`/bao-cao/xe-ra-vao-ben?vehiclePlateNumber=${encodeURIComponent(record.vehiclePlateNumber)}&returnTo=/thanh-toan/${id}`)} className="gap-2">
                <FileText className="w-4 h-4" /> Lịch sử ra vào
              </Button>
            </div>
          </div>

          {/* Right Column - Payment Sidebar */}
          <div className="space-y-6">
            <PaymentSidebar
              record={record}
              total={total}
              subtotal={subtotal}
              discount={discount}
              tax={tax}
              symbol={symbol}
              setSymbol={setSymbol}
              note={note}
              setNote={setNote}
              printOneCopy={printOneCopy}
              setPrintOneCopy={setPrintOneCopy}
              printTwoCopies={printTwoCopies}
              setPrintTwoCopies={setPrintTwoCopies}
              isProcessing={isProcessing}
              onPayment={handlePayment}
            />
          </div>
        </div>
      </div>

      <ZeroAmountWarningDialog
        open={showZeroAmountWarning}
        onOpenChange={setShowZeroAmountWarning}
        onConfirm={async () => {
          setShowZeroAmountWarning(false);
          await processPayment();
        }}
        isProcessing={isProcessing}
      />
    </div>
  );
}
