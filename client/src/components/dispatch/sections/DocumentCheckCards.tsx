import { CheckCircle, Clock, AlertCircle, FileX, Shield, Pencil, ChevronRight, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, SectionHeader } from "@/components/shared/styled-components";

type DocumentStatus = 'valid' | 'expired' | 'expiring_soon' | 'missing';

interface DocumentCheckResult {
  name: string;
  status: DocumentStatus;
  expiryDate?: string;
  daysRemaining?: number;
}

interface DocumentCheckCardsProps {
  documents: DocumentCheckResult[];
  isValid: boolean;
  validCount: number;
  totalCount: number;
  onEdit: () => void;
}

export function DocumentCheckCards({ documents, isValid, validCount, totalCount, onEdit }: DocumentCheckCardsProps) {
  const allValid = documents.every(r => r.status === 'valid' || r.status === 'expiring_soon');

  return (
    <GlassCard>
      <SectionHeader
        icon={Shield}
        title="Pre-Flight Check"
        badge={
          <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${
            isValid
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
              : 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/30'
          }`}>
            {validCount}/{totalCount} OK
          </span>
        }
        action={
          <Button
            type="button"
            onClick={onEdit}
            className="h-8 w-8 p-0 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 border-0 transition-all"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        }
      />

      {/* Document Cards Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {documents.map((doc, index) => {
            const statusStyles = {
              valid: {
                bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
                border: 'border-emerald-200',
                iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
                text: 'text-emerald-700',
                badge: 'bg-emerald-100 text-emerald-700',
                glow: 'shadow-emerald-100'
              },
              expiring_soon: {
                bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
                border: 'border-amber-200',
                iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
                text: 'text-amber-700',
                badge: 'bg-amber-100 text-amber-700',
                glow: 'shadow-amber-100'
              },
              expired: {
                bg: 'bg-gradient-to-br from-rose-50 to-red-50',
                border: 'border-rose-200',
                iconBg: 'bg-gradient-to-br from-rose-500 to-red-500',
                text: 'text-rose-700',
                badge: 'bg-rose-100 text-rose-700',
                glow: 'shadow-rose-100'
              },
              missing: {
                bg: 'bg-gradient-to-br from-slate-50 to-gray-100',
                border: 'border-gray-200',
                iconBg: 'bg-gradient-to-br from-slate-400 to-gray-500',
                text: 'text-gray-500',
                badge: 'bg-gray-100 text-gray-500',
                glow: 'shadow-gray-100'
              }
            };
            const style = statusStyles[doc.status];

            return (
              <div
                key={index}
                className={`
                  relative p-4 rounded-xl border-2 transition-all duration-300
                  hover:scale-[1.02] hover:shadow-lg
                  ${style.bg} ${style.border} ${style.glow}
                `}
              >
                {/* Status Icon */}
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center mb-3
                  ${style.iconBg} shadow-lg
                `}>
                  {doc.status === 'valid' && <CheckCircle className="h-5 w-5 text-white" />}
                  {doc.status === 'expiring_soon' && <Clock className="h-5 w-5 text-white" />}
                  {doc.status === 'expired' && <AlertCircle className="h-5 w-5 text-white" />}
                  {doc.status === 'missing' && <FileX className="h-5 w-5 text-white" />}
                </div>

                {/* Document Name */}
                <p className={`text-sm font-semibold ${style.text} mb-2 line-clamp-2`}>
                  {doc.name}
                </p>

                {/* Status Badge */}
                <div className={`
                  inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold
                  ${style.badge}
                `}>
                  {doc.status === 'valid' && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {doc.daysRemaining && doc.daysRemaining < 999
                        ? `${doc.daysRemaining}d`
                        : 'OK'}
                    </>
                  )}
                  {doc.status === 'expiring_soon' && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      {doc.daysRemaining === 0 ? 'HÔM NAY!' : `${doc.daysRemaining}d`}
                    </>
                  )}
                  {doc.status === 'expired' && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      HẾT HẠN
                    </>
                  )}
                  {doc.status === 'missing' && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      THIẾU
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Footer */}
      <div className={`
        relative overflow-hidden px-5 py-4 border-t
        ${allValid
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400'
          : 'bg-gradient-to-r from-rose-500 to-red-500 border-rose-400'
        }
      `}>
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '16px 16px'
          }} />
        </div>

        <div className="relative flex items-center justify-between">
          {allValid ? (
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20 backdrop-blur">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold">CLEARED FOR PERMIT</p>
                <p className="text-white/80 text-xs">Đủ điều kiện cấp phép</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20 backdrop-blur">
                <XIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold">DOCUMENTS REQUIRED</p>
                <p className="text-white/80 text-xs">Cần bổ sung giấy tờ</p>
              </div>
            </div>
          )}
          <ChevronRight className="h-5 w-5 text-white/60" />
        </div>
      </div>
    </GlassCard>
  );
}
