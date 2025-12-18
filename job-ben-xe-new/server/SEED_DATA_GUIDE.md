# Hướng dẫn Seed Data vào Firebase

## Tổng quan

Script `seed-firebase-rest.ts` tạo đầy đủ dữ liệu mẫu cho hệ thống.

## Cấu trúc dữ liệu được tạo

### 1. Vehicle Types (4 loại)
- Xe khách 16 chỗ
- Xe khách 29 chỗ
- Xe khách 45 chỗ
- Xe giường nằm

### 2. Users (4 người dùng)
- `admin` / `123456` - Quản trị viên
- `dieudo` / `123456` - Điều độ viên
- `ketoan` / `123456` - Kế toán
- `baocao` / `123456` - Báo cáo

### 3. Operators (3 đơn vị vận tải)
- FUTA - Công ty CP Xe khách Phương Trang
- THANHBUOI - Công ty TNHH Thành Bưởi
- KUMHO - Công ty TNHH Vận tải Kumho Samco

### 4. Vehicles (4 xe)
- 3 xe giường nằm (FUTA, THANHBUOI)
- 1 xe khách 45 chỗ (KUMHO)

### 5. Vehicle Documents
- Giấy đăng ký, đăng kiểm, bảo hiểm cho các xe

### 6. Drivers (3 lái xe)
- Mỗi lái xe thuộc một đơn vị vận tải

### 7. Locations (5 bến xe)
- Bến xe Miền Đông Mới (HCM)
- Bến xe Đà Lạt
- Bến xe Vũng Tàu
- Bến xe Cần Thơ
- Bến xe Miền Tây (HCM)

### 8. Routes (3 tuyến)
- HCM - Đà Lạt
- HCM - Vũng Tàu
- HCM - Cần Thơ

### 9. Route Stops
- Các điểm dừng trên mỗi tuyến

### 10. Shifts (4 ca trực)
- Ca 1: 06:00 - 14:00
- Ca 2: 14:00 - 22:00
- Ca 3: 22:00 - 06:00
- Hành chính: 07:30 - 17:00

### 11. Services (3 dịch vụ)
- Phí dừng đỗ
- Phí vệ sinh
- Phí quản lý

### 12. Violation Types (3 loại vi phạm)
- Chở quá số lượng khách
- Thiếu giấy tờ
- Xuất bến trễ giờ

### 13. Schedules (2 lịch trình)
- FUTA HCM-DL 08:00
- THANHBUOI HCM-DL 09:00

### 14. Dispatch Records (3 bản ghi điều độ)
- 1 bản ghi đã xuất bến (departed)
- 1 bản ghi đã cấp phép (permit_issued)
- 1 bản ghi mới vào bến (entered)

### 15. Service Charges
- Các phí dịch vụ cho bản ghi điều độ

### 16. Invoices
- Hóa đơn thanh toán

### 17. System Settings
- Cài đặt hệ thống cơ bản

## Cách chạy

```bash
cd server
npm run seed
```

Script sử dụng Firebase REST API để tạo dữ liệu, không cần service account credentials.

## Lưu ý

- Tất cả mật khẩu mặc định: `123456`
- Dữ liệu được tạo với timestamps thực tế
- Các dispatch records có trạng thái khác nhau để test workflow

## Troubleshooting

### Lỗi kết nối
- Kiểm tra `FIREBASE_DATABASE_URL` trong `.env`
- Đảm bảo Firebase Realtime Database đã được tạo
- Kiểm tra Firebase Database Rules cho phép ghi dữ liệu

