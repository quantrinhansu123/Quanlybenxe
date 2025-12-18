import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Home,
  LayoutDashboard,
  CalendarClock,
  Bus,
  Users,
  Route,
  BarChart3,
  CreditCard,
  Building2,
  // Settings,
  LogOut,
  ChevronDown,
  ChevronUp,
  FastForward,
  OctagonX,
  Link2,
  DollarSign,
  ShieldCheck,
  Database,
  MapPin,
  FileText,
  Plus,
  CarFront,
  Package,
  Calculator,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const navigation = [
  { name: "Trang chủ", href: "/", icon: Home },
  { name: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { name: "Điều độ xe", href: "/dieu-do", icon: CalendarClock },
  { name: "Thanh toán", href: "/thanh-toan", icon: CreditCard },
  // { name: "Cài đặt", href: "/settings", icon: Settings },
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
    { name: "Xe xuất bến", href: "/truyen-tai/xe-xuat-ben", icon: FastForward, flip: false },
    { name: "Xe không đủ điều kiện", href: "/truyen-tai/xe-khong-du-dieu-kien", icon: OctagonX, flip: false },
    { name: "Xe trả khách", href: "/truyen-tai/xe-tra-khach", icon: FastForward, flip: true },
  ];

  const baoCaoSubmenu = [
    { name: "Lập báo cáo", href: "/bao-cao/lap-bao-cao", icon: FileText, flip: false },
    { name: "Bảng kê hóa đơn", href: "/bao-cao/bang-ke-hoa-don", icon: FileText, flip: false },
    { name: "Xe trả khách", href: "/bao-cao/xe-tra-khach", icon: FastForward, flip: true },
    { name: "Theo dõi lệnh xuất bến", href: "/bao-cao/theo-doi-lenh-xuat-ben", icon: FileText, flip: false },
    { name: "Theo dõi lệnh trả khách", href: "/bao-cao/theo-doi-lenh-tra-khach", icon: FileText, flip: false },
    { name: "Nhật trình xe", href: "/bao-cao/nhat-trinh-xe", icon: FileText, flip: false },
    { name: "Xe đi thay", href: "/bao-cao/xe-di-thay", icon: Bus, flip: false },
    { name: "Xe không đủ điều kiện", href: "/bao-cao/xe-khong-du-dieu-kien", icon: OctagonX, flip: false },
    { name: "Xe ra vào bến", href: "/bao-cao/xe-ra-vao-ben", icon: Bus, flip: false },
    { name: "Xe tăng cường", href: "/bao-cao/xe-tang-cuong", icon: BusPlusIcon, flip: false },
    { name: "Báo cáo tổng hợp tuyến", href: "/bao-cao/tong-hop-tuyen", icon: Route, flip: false },
    { name: "Báo cáo tổng hợp", href: "/bao-cao/tong-hop", icon: BarChart3, flip: false },
    { name: "Doanh thu bến bán vé", href: "/bao-cao/doanh-thu-ben-ban-ve", icon: DollarSign, flip: false },
    { name: "Cấp phép ra bến", href: "/bao-cao/cap-phep-ra-ben", icon: ShieldCheck, flip: false },
    { name: "Chấm công đăng tài", href: "/bao-cao/cham-cong-dang-tai", icon: CalendarClock, flip: false },
    { name: "Lịch sử giấy tờ", href: "/bao-cao/lich-su-giay-to", icon: FileText, flip: false },
  ];

  const quanLySubmenu = [
    { name: "Quản lý xe", href: "/quan-ly-xe", icon: Bus, flip: false },
    { name: "Quản lý lái xe", href: "/quan-ly-lai-xe", icon: Users, flip: false },
    { name: "Đơn vị vận tải", href: "/quan-ly-don-vi-van-tai", icon: Building2, flip: false },
    { name: "Quản lý tuyến", href: "/quan-ly-tuyen", icon: Route, flip: false },
    { name: "Bến đến", href: "/quan-ly-ben-den", icon: MapPin, flip: false },
    { name: "Quản lý dịch vụ", href: "/quan-ly-dich-vu", icon: Package, flip: false },
    { name: "Biểu thức", href: "/quan-ly-bieu-thuc", icon: Calculator, flip: false },
    { name: "Phù hiệu xe", href: "/quan-ly-phu-hieu-xe", icon: Award, flip: false },
    { name: "Danh sách ca trực", href: "/danh-sach-ca-truc", icon: CalendarClock, flip: false },
  ];

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
          "fixed top-0 left-0 z-50 h-full w-64 bg-gradient-to-b from-blue-50 via-indigo-50 to-purple-50 border-r border-indigo-200/50 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center justify-center border-b border-indigo-200/50 px-6 py-4">
            <img
              src={logo}
              alt="Quản Lý Bến Xe"
              className="h-28 w-auto object-fit drop-shadow-lg"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 px-3 py-4 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30 scale-[1.02]"
                      : "text-gray-700 hover:bg-gradient-to-r hover:from-blue-100 hover:to-indigo-100 hover:text-indigo-700 hover:shadow-sm"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-6 w-6 transition-colors",
                      isActive ? "text-white" : "text-indigo-600"
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}

            {/* Quản lý thông tin Menu */}
            <div className="mt-2">
              <button
                onClick={() => setIsQuanLyOpen(!isQuanLyOpen)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-200",
                  "text-gray-700 hover:bg-gradient-to-r hover:from-blue-100 hover:to-indigo-100 hover:text-indigo-700 hover:shadow-sm"
                )}
              >
                <div className="flex items-center gap-3">
                  <Database className="h-6 w-6 text-indigo-600" />
                  <span>Quản lý thông tin</span>
                </div>
                {isQuanLyOpen ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </button>

              {/* Submenu */}
              {isQuanLyOpen && (
                <div className="ml-4 mt-2 space-y-1 border-l-2 border-indigo-200 pl-4">
                  {quanLySubmenu.map((subItem) => {
                    const isSubActive = location.pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.name}
                        to={subItem.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                          isSubActive
                            ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30"
                            : "text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-indigo-700"
                        )}
                      >
                        <subItem.icon
                          className={cn(
                            "h-5 w-5 transition-colors",
                            isSubActive ? "text-white" : "text-indigo-500",
                            subItem.flip && "scale-x-[-1]"
                          )}
                        />
                        {subItem.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Truyền tải Menu */}
            <div className="mt-2">
              <button
                onClick={() => setIsTruyenTaiOpen(!isTruyenTaiOpen)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-200",
                  "text-gray-700 hover:bg-gradient-to-r hover:from-blue-100 hover:to-indigo-100 hover:text-indigo-700 hover:shadow-sm"
                )}
              >
                <div className="flex items-center gap-3">
                  <Link2 className="h-6 w-6 text-indigo-600" />
                  <span>Truyền tải</span>
                </div>
                {isTruyenTaiOpen ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </button>

              {/* Submenu */}
              {isTruyenTaiOpen && (
                <div className="ml-4 mt-2 space-y-1 border-l-2 border-indigo-200 pl-4">
                  {truyenTaiSubmenu.map((subItem) => {
                    const isSubActive = location.pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.name}
                        to={subItem.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                          isSubActive
                            ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30"
                            : "text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-indigo-700"
                        )}
                      >
                        <subItem.icon
                          className={cn(
                            "h-5 w-5 transition-colors",
                            isSubActive ? "text-white" : "text-indigo-500",
                            subItem.flip && "scale-x-[-1]"
                          )}
                        />
                        {subItem.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Báo cáo Menu */}
            <div className="mt-2">
              <button
                onClick={() => setIsBaoCaoOpen(!isBaoCaoOpen)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-200",
                  "text-gray-700 hover:bg-gradient-to-r hover:from-blue-100 hover:to-indigo-100 hover:text-indigo-700 hover:shadow-sm"
                )}
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-6 w-6 text-indigo-600" />
                  <span>Báo cáo</span>
                </div>
                {isBaoCaoOpen ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </button>

              {/* Submenu */}
              {isBaoCaoOpen && (
                <div className="ml-4 mt-2 space-y-1 border-l-2 border-indigo-200 pl-4">
                  {baoCaoSubmenu.map((subItem) => {
                    const isSubActive = location.pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.name}
                        to={subItem.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                          isSubActive
                            ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30"
                            : "text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-indigo-700"
                        )}
                      >
                        <subItem.icon
                          className={cn(
                            "h-5 w-5 transition-colors",
                            isSubActive ? "text-white" : "text-indigo-500",
                            subItem.flip && "scale-x-[-1]"
                          )}
                        />
                        {subItem.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Logout button */}
          <div className="border-t border-indigo-200/50 p-4 bg-gradient-to-t from-red-50 to-transparent">
            <Button
              variant="ghost"
              className="w-full justify-start hover:bg-gradient-to-r hover:from-red-100 hover:to-rose-100 hover:text-red-600 transition-all duration-200"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-6 w-6 text-red-500" />
              <span className="font-medium">Đăng xuất</span>
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

function BusPlusIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`relative inline-flex h-5 w-5 ${className}`}>
      <CarFront className="h-5 w-5" />
      <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
        <Plus className="h-2.5 w-2.5" strokeWidth={3} />
      </div>
    </div>
  );
}