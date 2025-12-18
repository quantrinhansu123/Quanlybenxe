import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { driverService } from "@/services/driver.service";
import type { Driver } from "@/types";

interface ThemTaiXeDialogProps {
  operatorId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: (driver: Driver) => void;
}

export function ThemTaiXeDialog({
  operatorId,
  open,
  onClose,
  onSuccess,
}: ThemTaiXeDialogProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && operatorId) {
      loadDrivers();
    }
  }, [open, operatorId]);

  const loadDrivers = async () => {
    setIsLoading(true);
    try {
      const data = await driverService.getAll(operatorId, true);
      setDrivers(data);
    } catch (error) {
      console.error("Failed to load drivers:", error);
      toast.error("Không thể tải danh sách tài xế");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (driver: Driver) => {
    onSuccess(driver);
    onClose();
  };

  const filteredDrivers = drivers.filter(
    (d) =>
      d.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.phone?.includes(searchTerm)
  );

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold mb-4">Chọn tài xế</h2>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Tìm kiếm theo tên, số GPLX, SĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 font-medium sticky top-0">
              <tr>
                <th className="px-4 py-3">Họ và tên</th>
                <th className="px-4 py-3">Số GPLX</th>
                <th className="px-4 py-3">Hạng</th>
                <th className="px-4 py-3">SĐT</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Đang tải...
                  </td>
                </tr>
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Không tìm thấy tài xế nào
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{driver.fullName}</td>
                    <td className="px-4 py-3">{driver.licenseNumber}</td>
                    <td className="px-4 py-3">{driver.licenseClass}</td>
                    <td className="px-4 py-3">{driver.phone || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        onClick={() => handleSelect(driver)}
                        className="h-8"
                      >
                        Chọn
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
