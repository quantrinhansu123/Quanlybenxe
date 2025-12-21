import { Button } from "@/components/ui/button";

interface PermitActionsProps {
  readOnly: boolean;
  isLoading: boolean;
  onClose: () => void;
  onNotEligible: () => void;
  onEligible: () => void;
}

export function PermitActions({
  readOnly,
  isLoading,
  onClose,
  onNotEligible,
  onEligible,
}: PermitActionsProps) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        onClick={onClose}
        disabled={isLoading}
        className="px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
      >
        {readOnly ? "Đóng" : "Hủy"}
      </Button>
      {!readOnly && (
        <>
          <Button
            type="button"
            onClick={onNotEligible}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 text-white font-medium hover:from-rose-600 hover:to-red-600 shadow-lg shadow-rose-500/25 transition-all"
          >
            Không đủ điều kiện
          </Button>
          <Button
            type="button"
            onClick={onEligible}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-medium hover:from-emerald-600 hover:to-green-600 shadow-lg shadow-emerald-500/25 transition-all"
          >
            Đủ điều kiện
          </Button>
        </>
      )}
    </div>
  );
}
