import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Home,
  LayoutDashboard,
  Bus,
  Users,
  Route,
  BarChart3,
  CreditCard,
  Building2,
  LogOut,
  ChevronDown,
  ChevronRight,
  MapPin,
  Plus,
  CarFront,
  Package,
  Calculator,
  Clock,
  Wallet,
  Database,
  Send,
  CircleOff,
  ArrowRightFromLine,
  ArrowLeftFromLine,
  FileSpreadsheet,
  ClipboardList,
  Receipt,
  ShieldCheck,
  CalendarCheck,
  History,
  Award,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import logo from "@/assets/logo.png";

// Main navigation items
const navigation = [
  { name: "Trang chủ", href: "/", icon: Home },
  { name: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { name: "Điều độ xe", href: "/dieu-do", icon: ClipboardList },
  { name: "Thanh toán", href: "/thanh-toan", icon: Wallet },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const [isTruyenTaiOpen, setIsTruyenTaiOpen] = useState(false);
  const [isBaoCaoOpen, setIsBaoCaoOpen] = useState(false);
  const [isQuanLyOpen, setIsQuanLyOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const truyenTaiSubmenu = [
    { name: "Xe xuất bến", href: "/truyen-tai/xe-xuat-ben", icon: ArrowRightFromLine },
    { name: "Xe không đủ điều kiện", href: "/truyen-tai/xe-khong-du-dieu-kien", icon: CircleOff },
    { name: "Xe trả khách", href: "/truyen-tai/xe-tra-khach", icon: ArrowLeftFromLine },
  ];

  const baoCaoSubmenu = [
    { name: "Lập báo cáo", href: "/bao-cao/lap-bao-cao", icon: FileSpreadsheet },
    { name: "Bảng kê hóa đơn", href: "/bao-cao/bang-ke-hoa-don", icon: Receipt },
    { name: "Xe trả khách", href: "/bao-cao/xe-tra-khach", icon: ArrowLeftFromLine },
    { name: "Theo dõi lệnh xuất bến", href: "/bao-cao/theo-doi-lenh-xuat-ben", icon: ClipboardList },
    { name: "Theo dõi lệnh trả khách", href: "/bao-cao/theo-doi-lenh-tra-khach", icon: ClipboardList },
    { name: "Nhật trình xe", href: "/bao-cao/nhat-trinh-xe", icon: Clock },
    { name: "Xe đi thay", href: "/bao-cao/xe-di-thay", icon: Bus },
    { name: "Xe không đủ điều kiện", href: "/bao-cao/xe-khong-du-dieu-kien", icon: CircleOff },
    { name: "Xe ra vào bến", href: "/bao-cao/xe-ra-vao-ben", icon: Bus },
    { name: "Xe tăng cường", href: "/bao-cao/xe-tang-cuong", icon: BusPlusIcon },
    { name: "Báo cáo tổng hợp tuyến", href: "/bao-cao/tong-hop-tuyen", icon: Route },
    { name: "Báo cáo tổng hợp", href: "/bao-cao/tong-hop", icon: TrendingUp },
    { name: "Doanh thu bến bán vé", href: "/bao-cao/doanh-thu-ben-ban-ve", icon: CreditCard },
    { name: "Cấp phép ra bến", href: "/bao-cao/cap-phep-ra-ben", icon: ShieldCheck },
    { name: "Chấm công đăng tài", href: "/bao-cao/cham-cong-dang-tai", icon: CalendarCheck },
    { name: "Lịch sử giấy tờ", href: "/bao-cao/lich-su-giay-to", icon: History },
  ];

  const quanLySubmenu = [
    { name: "Quản lý xe", href: "/quan-ly-xe", icon: Bus },
    { name: "Quản lý lái xe", href: "/quan-ly-lai-xe", icon: Users },
    { name: "Đơn vị vận tải", href: "/quan-ly-don-vi-van-tai", icon: Building2 },
    { name: "Quản lý tuyến", href: "/quan-ly-tuyen", icon: Route },
    { name: "Bến đến", href: "/quan-ly-ben-den", icon: MapPin },
    { name: "Quản lý dịch vụ", href: "/quan-ly-dich-vu", icon: Package },
    { name: "Biểu thức", href: "/quan-ly-bieu-thuc", icon: Calculator },
    { name: "Phù hiệu xe", href: "/quan-ly-phu-hieu-xe", icon: Award },
    { name: "Danh sách ca trực", href: "/danh-sach-ca-truc", icon: Clock },
  ];

  // Check if any submenu item is active
  const isQuanLyActive = quanLySubmenu.some((item) => location.pathname === item.href);
  const isTruyenTaiActive = truyenTaiSubmenu.some((item) => location.pathname === item.href);
  const isBaoCaoActive = baoCaoSubmenu.some((item) => location.pathname === item.href);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-stone-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center justify-center border-b border-stone-100 px-6 py-4">
            <img
              src={logo}
              alt="Quản Lý Bến Xe"
              className="h-24 w-auto object-contain"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            {/* Main Navigation */}
            <div className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-stone-100 text-stone-900 border-l-2 border-orange-500 -ml-[2px] pl-[14px]"
                        : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", isActive ? "text-orange-500" : "text-stone-400")} />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Quản lý thông tin Section */}
            <div className="mt-6">
              <button
                onClick={() => setIsQuanLyOpen(!isQuanLyOpen)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isQuanLyActive
                    ? "bg-stone-100 text-stone-900"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <Database className={cn("h-5 w-5", isQuanLyActive ? "text-orange-500" : "text-stone-400")} />
                  <span>Quản lý thông tin</span>
                </div>
                {isQuanLyOpen ? (
                  <ChevronDown className="h-4 w-4 text-stone-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-stone-400" />
                )}
              </button>

              {/* Submenu */}
              {isQuanLyOpen && (
                <div className="mt-1 ml-4 space-y-0.5 border-l border-stone-200 pl-3">
                  {quanLySubmenu.map((subItem) => {
                    const isSubActive = location.pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.name}
                        to={subItem.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                          isSubActive
                            ? "bg-orange-50 text-orange-600 font-medium"
                            : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                        )}
                      >
                        <subItem.icon className={cn("h-4 w-4", isSubActive ? "text-orange-500" : "text-stone-400")} />
                        {subItem.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Truyền tải Section */}
            <div className="mt-2">
              <button
                onClick={() => setIsTruyenTaiOpen(!isTruyenTaiOpen)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isTruyenTaiActive
                    ? "bg-stone-100 text-stone-900"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <Send className={cn("h-5 w-5", isTruyenTaiActive ? "text-orange-500" : "text-stone-400")} />
                  <span>Truyền tải</span>
                </div>
                {isTruyenTaiOpen ? (
                  <ChevronDown className="h-4 w-4 text-stone-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-stone-400" />
                )}
              </button>

              {/* Submenu */}
              {isTruyenTaiOpen && (
                <div className="mt-1 ml-4 space-y-0.5 border-l border-stone-200 pl-3">
                  {truyenTaiSubmenu.map((subItem) => {
                    const isSubActive = location.pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.name}
                        to={subItem.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                          isSubActive
                            ? "bg-orange-50 text-orange-600 font-medium"
                            : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                        )}
                      >
                        <subItem.icon className={cn("h-4 w-4", isSubActive ? "text-orange-500" : "text-stone-400")} />
                        {subItem.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Báo cáo Section */}
            <div className="mt-2">
              <button
                onClick={() => setIsBaoCaoOpen(!isBaoCaoOpen)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isBaoCaoActive
                    ? "bg-stone-100 text-stone-900"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className={cn("h-5 w-5", isBaoCaoActive ? "text-orange-500" : "text-stone-400")} />
                  <span>Báo cáo</span>
                </div>
                {isBaoCaoOpen ? (
                  <ChevronDown className="h-4 w-4 text-stone-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-stone-400" />
                )}
              </button>

              {/* Submenu */}
              {isBaoCaoOpen && (
                <div className="mt-1 ml-4 space-y-0.5 border-l border-stone-200 pl-3">
                  {baoCaoSubmenu.map((subItem) => {
                    const isSubActive = location.pathname === subItem.href;
                    const IconComponent = subItem.icon;
                    return (
                      <Link
                        key={subItem.name}
                        to={subItem.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                          isSubActive
                            ? "bg-orange-50 text-orange-600 font-medium"
                            : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                        )}
                      >
                        <IconComponent className={cn("h-4 w-4", isSubActive ? "text-orange-500" : "text-stone-400")} />
                        {subItem.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Logout button */}
          <div className="border-t border-stone-100 p-3">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function BusPlusIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`relative inline-flex ${className}`}>
      <CarFront className="h-4 w-4" />
      <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full">
        <Plus className="h-2 w-2" strokeWidth={3} />
      </div>
    </div>
  );
}
