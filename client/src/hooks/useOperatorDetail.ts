import { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { vehicleService } from "@/services/vehicle.service";
import { invoiceService } from "@/services/invoice.service";
import { dispatchService } from "@/services/dispatch.service";
import type { Vehicle, Invoice, DispatchRecord, Operator } from "@/types";

// Extended Operator type with source field
type OperatorWithSource = Operator & {
  source?: "database" | "legacy" | "google_sheets";
};
import { format, parseISO, isValid } from "date-fns";

export interface PaymentHistoryItem {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  paymentDate: string | null;
  totalAmount: number;
  source: "invoice" | "dispatch";
  vehiclePlateNumber?: string;
  routeName?: string;
}

// Normalize operator name for matching
const normalizeOperatorName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    // Remove common prefixes/suffixes
    .replace(/^(ông|bà|anh|chị|mr\.|mrs\.|ms\.)\s*/i, '')
    .replace(/^(công ty tnhh|công ty cổ phần|cty tnhh|cty cp|dntn|hộ kinh doanh|hkd)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Check if two names match - use exact match only (normalized)
// Note: Google Sheets XE and DONVIVANTAI have no direct reference field,
// only ~12% of operators have vehicles with matching owner_name
const namesMatch = (vehicleOwner: string, operatorName: string): boolean => {
  const n1 = normalizeOperatorName(vehicleOwner);
  const n2 = normalizeOperatorName(operatorName);
  
  if (!n1 || !n2) return false;
  
  // Exact match only (after normalization)
  return n1 === n2;
};

export function useOperatorDetail(operator: OperatorWithSource | null, open: boolean) {
  const [activeTab, setActiveTab] = useState("vehicles");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allDispatchRecords, setAllDispatchRecords] = useState<DispatchRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paidDispatchRecords, setPaidDispatchRecords] = useState<DispatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && operator) {
      loadData();
    }
  }, [open, operator]);

  const loadData = async () => {
    if (!operator) return;

    setIsLoading(true);
    setError(null);
    try {
      // Check if operator is from Google Sheets or legacy source (not from database)
      const isExternalOperator = operator.source === "google_sheets" || operator.source === "legacy" || operator.id.startsWith("legacy_");
      
      // Load all vehicles and filter by operator name for external operators
      let vehiclesData: Vehicle[] = [];
      if (isExternalOperator) {
        // For external operators, load all legacy vehicles and filter by operator name
        const allVehicles = await vehicleService.getAll(undefined, undefined, true);
        console.log('[OperatorDetail] External operator:', operator.name, '-> searching in', allVehicles.length, 'vehicles');
        
        vehiclesData = allVehicles.filter((v: Vehicle) => {
          const vehicleOwnerName = 
            (v as Vehicle & { operatorName?: string }).operatorName || 
            v.operator?.name || 
            '';
          return namesMatch(vehicleOwnerName, operator.name || '');
        });
        console.log('[OperatorDetail] Matched vehicles:', vehiclesData.length);
      } else {
        vehiclesData = await vehicleService.getAll(operator.id, undefined, false);
      }
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);

      // Get vehicle plate numbers for filtering dispatch records
      const vehiclePlates = new Set(
        vehiclesData.map((v: Vehicle) => 
          v.plateNumber?.replace(/[.\-\s]/g, '').toUpperCase()
        ).filter(Boolean)
      );

      // Load all dispatch records and invoices
      const [allDispatch, invoicesData] = await Promise.all([
        dispatchService.getAll(),
        invoiceService.getAll(operator.id).catch(() => []),
      ]);

      // Filter dispatch records by vehicle plates
      const operatorDispatch = allDispatch.filter((record: DispatchRecord) => {
        const recordPlate = record.vehiclePlateNumber?.replace(/[.\-\s]/g, '').toUpperCase();
        return recordPlate && vehiclePlates.has(recordPlate);
      });

      setAllDispatchRecords(operatorDispatch);
      
      // Filter paid dispatch records
      const paidRecords = operatorDispatch.filter(
        (record: DispatchRecord) =>
          record.paymentTime &&
          record.paymentAmount &&
          record.paymentAmount > 0
      );
      setPaidDispatchRecords(paidRecords);

      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
    } catch (err: unknown) {
      console.error("Failed to load operator details:", err);
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Không thể tải thông tin chi tiết";
      setError(errorMessage);
      toast.error(errorMessage);
      setVehicles([]);
      setInvoices([]);
      setPaidDispatchRecords([]);
      setAllDispatchRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Unpaid dispatch records (công nợ từ dispatch - chưa thanh toán)
  const unpaidDispatchRecords = useMemo(
    () => allDispatchRecords.filter(
      (record) => !record.paymentTime && record.currentStatus !== 'cancelled'
    ),
    [allDispatchRecords]
  );

  // Legacy: unpaid invoices
  const unpaidInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) => inv.paymentStatus === "pending" || inv.paymentStatus === "overdue"
      ),
    [invoices]
  );

  // Total debt from both dispatch records and invoices
  const totalDebt = useMemo(() => {
    // Sum service charges from unpaid dispatch records
    const dispatchDebt = unpaidDispatchRecords.reduce((sum, record) => {
      // Use metadata.totalServiceCharges if available, otherwise 0
      const metadata = record.metadata as { totalServiceCharges?: number } | undefined;
      return sum + (metadata?.totalServiceCharges || 0);
    }, 0);
    const invoiceDebt = unpaidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    return dispatchDebt + invoiceDebt;
  }, [unpaidDispatchRecords, unpaidInvoices]);

  const paidInvoices = useMemo(
    () => invoices.filter((inv) => inv.paymentStatus === "paid"),
    [invoices]
  );

  const allPaymentHistory = useMemo(() => {
    const paymentHistoryFromDispatch: PaymentHistoryItem[] = paidDispatchRecords
      .filter((record) => record.paymentTime && record.paymentAmount)
      .map((record) => ({
        id: record.id,
        invoiceNumber:
          record.invoiceNumber || `ĐH-${record.id.substring(0, 8).toUpperCase()}`,
        issueDate: record.entryTime,
        paymentDate: record.paymentTime || null,
        totalAmount: record.paymentAmount || 0,
        source: "dispatch" as const,
        vehiclePlateNumber: record.vehiclePlateNumber,
        routeName: record.routeName,
      }));

    const combined: PaymentHistoryItem[] = [
      ...paidInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate,
        paymentDate: inv.paymentDate || inv.issueDate,
        totalAmount: inv.totalAmount,
        source: "invoice" as const,
      })),
      ...paymentHistoryFromDispatch,
    ].sort((a, b) => {
      const dateA = a.paymentDate ? parseISO(a.paymentDate).getTime() : 0;
      const dateB = b.paymentDate ? parseISO(b.paymentDate).getTime() : 0;
      return dateB - dateA;
    });

    return combined;
  }, [paidInvoices, paidDispatchRecords]);

  const totalPaid = useMemo(
    () => allPaymentHistory.reduce((sum, item) => sum + item.totalAmount, 0),
    [allPaymentHistory]
  );

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return "N/A";
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, "dd/MM/yyyy") : "N/A";
    } catch {
      return "N/A";
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const resetTab = () => setActiveTab("vehicles");

  return {
    activeTab,
    setActiveTab,
    vehicles,
    invoices,
    allDispatchRecords,
    paidDispatchRecords,
    unpaidDispatchRecords,
    isLoading,
    error,
    loadData,
    unpaidInvoices,
    totalDebt,
    paidInvoices,
    allPaymentHistory,
    totalPaid,
    formatDate,
    formatCurrency,
    resetTab,
  };
}
