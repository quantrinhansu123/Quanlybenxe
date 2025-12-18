import { useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { useAuthStore } from "@/store/auth.store"
import { useUIStore } from "@/store/ui.store"
import { MainLayout } from "@/components/layout/MainLayout"
import { PublicLayout } from "@/components/layout/PublicLayout"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import HomePage from "@/pages/HomePage"
import Dashboard from "@/pages/Dashboard"
import DieuDo from "@/pages/DieuDo"
import ThanhToan from "@/pages/ThanhToan"
import TaoMoiDonHang from "@/pages/TaoMoiDonHang"
import QuanLyXe from "@/pages/QuanLyXe"
import QuanLyLaiXe from "@/pages/QuanLyLaiXe"
import QuanLyDonViVanTai from "@/pages/QuanLyDonViVanTai"
import QuanLyTuyen from "@/pages/QuanLyTuyen"
import QuanLyBenDen from "@/pages/QuanLyBenDen"
import QuanLyDichVu from "@/pages/QuanLyDichVu"
import QuanLyBieuThuc from "@/pages/QuanLyBieuThuc"
import QuanLyPhuHieuXe from "@/pages/QuanLyPhuHieuXe"
import DanhSachCaTruc from "@/pages/DanhSachCaTruc"
import BaoCao from "@/pages/BaoCao"
import Profile from "@/pages/Profile"
import BangGiaVeDienTu from "@/pages/pricing/BangGiaVeDienTu"
import BangGiaLenhVanChuyen from "@/pages/pricing/BangGiaLenhVanChuyen"
import BangGiaChuKySo from "@/pages/pricing/BangGiaChuKySo"
import BangGiaHoaDonDienTu from "@/pages/pricing/BangGiaHoaDonDienTu"
import HuongDanBanVeUyThac from "@/pages/guide/HuongDanBanVeUyThac"
import LienHe from "@/pages/LienHe"
import XeXuatBen from "@/pages/XeXuatBen"
import XeTraKhach from "@/pages/XeTraKhach"
import XeKhongDuDieuKien from "@/pages/XeKhongDuDieuKien"
import BaoCaoXeTraKhach from "@/pages/BaoCaoXeTraKhach"
import BaoCaoTheoDoiLenhXuatBen from "@/pages/BaoCaoTheoDoiLenhXuatBen"
import BaoCaoTongHopTuyen from "@/pages/BaoCaoTongHopTuyen"
import BaoCaoTongHop from "@/pages/BaoCaoTongHop"
import BaoCaoDoanhThuBenBanVe from "@/pages/BaoCaoDoanhThuBenBanVe"
import BaoCaoCapPhepRaBen from "@/pages/BaoCaoCapPhepRaBen"
import BaoCaoTheoDoiLenhTraKhach from "@/pages/BaoCaoTheoDoiLenhTraKhach"
import BaoCaoNhatTrinhXe from "@/pages/BaoCaoNhatTrinhXe"
import BaoCaoXeDiThay from "@/pages/BaoCaoXeDiThay"
import BaoCaoXeKhongDuDieuKien from "@/pages/BaoCaoXeKhongDuDieuKien"
import BaoCaoXeRaVaoBen from "@/pages/BaoCaoXeRaVaoBen"
import BaoCaoXeTangCuong from "@/pages/BaoCaoXeTangCuong"
import BaoCaoChamCongDangTai from "@/pages/BaoCaoChamCongDangTai"
import BaoCaoLichSuGiayTo from "@/pages/BaoCaoLichSuGiayTo"
import LapBaoCao from "@/pages/LapBaoCao"
import BaoCaoTinhHinhHoatDongMau1 from "@/pages/BaoCaoTinhHinhHoatDongMau1"
import BaoCaoTinhHinhHoatDongMau3 from "@/pages/BaoCaoTinhHinhHoatDongMau3"
import BangKeDoanhThu from "@/pages/BangKeDoanhThu"
import BangKeDoanhThu02 from "@/pages/BangKeDoanhThu02"
import BangKeHoaDon from "@/pages/BangKeHoaDon"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()
  const { initializeShiftIfNeeded } = useUIStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Tự động set shift theo giờ hiện tại khi đăng nhập lần đầu
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      initializeShiftIfNeeded()
    }
  }, [isAuthenticated, isLoading, initializeShiftIfNeeded])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <PublicLayout>
              <HomePage />
            </PublicLayout>
          }
        />
        <Route
          path="/home"
          element={<Navigate to="/" replace />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dieu-do"
          element={
            <ProtectedRoute>
              <MainLayout disablePadding>
                <DieuDo />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/thanh-toan"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ThanhToan />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/thanh-toan/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ThanhToan />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/thanh-toan/tao-moi"
          element={
            <ProtectedRoute>
              <MainLayout>
                <TaoMoiDonHang />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/truyen-tai/xe-xuat-ben"
          element={
            <ProtectedRoute>
              <MainLayout>
                <XeXuatBen />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/truyen-tai/xe-tra-khach"
          element={
            <ProtectedRoute>
              <MainLayout>
                <XeTraKhach />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/truyen-tai/xe-khong-du-dieu-kien"
          element={
            <ProtectedRoute>
              <MainLayout>
                <XeKhongDuDieuKien />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quan-ly-xe"
          element={
            <ProtectedRoute>
              <MainLayout>
                <QuanLyXe />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quan-ly-lai-xe"
          element={
            <ProtectedRoute>
              <MainLayout>
                <QuanLyLaiXe />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quan-ly-don-vi-van-tai"
          element={
            <ProtectedRoute>
              <MainLayout>
                <QuanLyDonViVanTai />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quan-ly-tuyen"
          element={
            <ProtectedRoute>
              <MainLayout>
                <QuanLyTuyen />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quan-ly-ben-den"
          element={
            <ProtectedRoute>
              <MainLayout>
                <QuanLyBenDen />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quan-ly-dich-vu"
          element={
            <ProtectedRoute>
              <MainLayout>
                <QuanLyDichVu />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quan-ly-bieu-thuc"
          element={
            <ProtectedRoute>
              <MainLayout>
                <QuanLyBieuThuc />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quan-ly-phu-hieu-xe"
          element={
            <ProtectedRoute>
              <MainLayout>
                <QuanLyPhuHieuXe />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/danh-sach-ca-truc"
          element={
            <ProtectedRoute>
              <MainLayout>
                <DanhSachCaTruc />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCao />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/xe-tra-khach"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoXeTraKhach />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/theo-doi-lenh-xuat-ben"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoTheoDoiLenhXuatBen />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/tong-hop-tuyen"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoTongHopTuyen />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/tong-hop"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoTongHop />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/doanh-thu-ben-ban-ve"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoDoanhThuBenBanVe />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/cap-phep-ra-ben"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoCapPhepRaBen />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/theo-doi-lenh-tra-khach"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoTheoDoiLenhTraKhach />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/nhat-trinh-xe"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoNhatTrinhXe />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/xe-di-thay"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoXeDiThay />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/xe-khong-du-dieu-kien"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoXeKhongDuDieuKien />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/xe-ra-vao-ben"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoXeRaVaoBen />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/xe-tang-cuong"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoXeTangCuong />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/cham-cong-dang-tai"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoChamCongDangTai />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/lich-su-giay-to"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BaoCaoLichSuGiayTo />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/lap-bao-cao"
          element={
            <ProtectedRoute>
              <MainLayout>
                <LapBaoCao />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/tinh-hinh-hoat-dong-mau-1"
          element={
            <ProtectedRoute>
              <MainLayout disablePadding>
                <BaoCaoTinhHinhHoatDongMau1 />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/tinh-hinh-hoat-dong-mau-3"
          element={
            <ProtectedRoute>
              <MainLayout disablePadding>
                <BaoCaoTinhHinhHoatDongMau3 />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/bang-ke-doanh-thu"
          element={
            <ProtectedRoute>
              <MainLayout disablePadding>
                <BangKeDoanhThu />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/bang-ke-doanh-thu-02-rut-gon"
          element={
            <ProtectedRoute>
              <MainLayout disablePadding>
                <BangKeDoanhThu02 />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bao-cao/bang-ke-hoa-don"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BangKeHoaDon />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <PublicLayout>
                <Profile />
              </PublicLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pricing/electronic-ticket"
          element={
            <PublicLayout>
              <BangGiaVeDienTu />
            </PublicLayout>
          }
        />
        <Route
          path="/pricing/dispatch-order"
          element={
            <PublicLayout>
              <BangGiaLenhVanChuyen />
            </PublicLayout>
          }
        />
        <Route
          path="/pricing/icorp-signature"
          element={
            <PublicLayout>
              <BangGiaChuKySo />
            </PublicLayout>
          }
        />
        <Route
          path="/pricing/icorp-invoice"
          element={
            <PublicLayout>
              <BangGiaHoaDonDienTu />
            </PublicLayout>
          }
        />
        <Route
          path="/guide/bus-station/consignment"
          element={<HuongDanBanVeUyThac />}
        />
        <Route
          path="/lien-he"
          element={
            <PublicLayout>
              <LienHe />
            </PublicLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

