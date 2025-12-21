import { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { vehicleService } from "@/services/vehicle.service";
import { invoiceService } from "@/services/invoice.service";
import { dispatchService } from "@/services/dispatch.service";
import type { Operator, Vehicle, Invoice, DispatchRecord } from "@/types";
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

export function useOperatorDetail(operator: Operator | null, open: boolean) {
  const [activeTab, setActiveTab] = useState("vehicles");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
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
      const isLegacyOperator = operator.id.startsWith("legacy_");
      const vehiclesData = await vehicleService.getAll(
        operator.id,
        undefined,
        isLegacyOperator
      );
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);

      const vehicleIds = Array.isArray(vehiclesData)
        ? vehiclesData.map((v) => v.id)
        : [];

      const [invoicesData, allDispatchData] = await Promise.all([
        invoiceService.getAll(operator.id),
        vehicleIds.length > 0
          ? Promise.all(
              vehicleIds.map((vehicleId) =>
                dispatchService.getAll(undefined, vehicleId)
              )
            ).then((results) => {
              const allRecords = results.flat();
              return allRecords.filter(
                (record) =>
                  (record.currentStatus === "paid" ||
                    record.currentStatus === "departed") &&
                  record.paymentTime &&
                  record.paymentAmount &&
                  record.paymentAmount > 0
              );
            })
          : Promise.resolve([]),
      ]);

      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      setPaidDispatchRecords(
        Array.isArray(allDispatchData) ? allDispatchData : []
      );
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
    } finally {
      setIsLoading(false);
    }
  };

  const unpaidInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) => inv.paymentStatus === "pending" || inv.paymentStatus === "overdue"
      ),
    [invoices]
  );

  const totalDebt = useMemo(
    () => unpaidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    [unpaidInvoices]
  );

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
          record.invoiceNumber || `DISPATCH-${record.id.substring(0, 8)}`,
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
    paidDispatchRecords,
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
