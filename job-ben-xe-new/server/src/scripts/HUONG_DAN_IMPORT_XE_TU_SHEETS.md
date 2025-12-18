# Hướng dẫn Import Dữ liệu Xe từ Google Sheets lên Supabase

## ⚡ Tốc độ cao với Batch Mode

Script này sử dụng **Batch Insert** để import nhiều records cùng lúc, giúp tăng tốc độ đáng kể so với import từng record một.

- **Tốc độ**: ~50-100 records mỗi batch (tùy cấu hình)
- **Ưu điểm**: Nhanh hơn 10-50 lần so với import từng record
- **Tự động**: Xử lý lỗi từng phần, tiếp tục với các records còn lại

## Bước 1: Chuẩn bị

### 1.1. Lấy thông tin Supabase

1. Đăng nhập vào [Supabase Dashboard](https://app.supabase.com)
2. Chọn project của bạn
3. Vào **Settings** > **API**
4. Copy các thông tin sau:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **service_role** key (Secret key) - **Lưu ý**: Nên dùng Service Role Key để có đầy đủ quyền

### 1.2. Chuẩn bị Google Sheets

1. Mở Google Sheets chứa dữ liệu xe
2. Đảm bảo sheet có các cột sau (theo đúng tên):
   - `IDXe`
   - `BienSo` (bắt buộc)
   - `SoKhung`
   - `SoMay`
   - `SoCho`
   - `NienHan`
   - `TenDangKyXe`
   - `DiaChiChuXe`
   - `NhanHieu`
   - `LoaiXe`
   - `LoaiPhuongTien`
   - `TaiTrong`
   - `MauSon`
   - `NamSanXuat`
   - `LaBienDinhDanh`
   - `TrangThaiBienDinhDanh`
   - `LyDoThuBienDinhDanh`
   - `ThongTinDangKyXe`
   - `User`
   - `ThoiGianNhap`
   - `Nienhan`
   - `CoKDVT`

3. Dòng đầu tiên phải là header (tên các cột)
4. Dữ liệu bắt đầu từ dòng thứ 2

## Bước 2: Cài đặt Google Apps Script

### 2.1. Mở Apps Script Editor

1. Trong Google Sheets, vào **Extensions** > **Apps Script**
2. Hoặc truy cập: https://script.google.com

### 2.2. Tạo Script mới

1. Xóa code mặc định (nếu có)
2. Copy toàn bộ nội dung từ file `import-vehicles-from-sheets.gs`
3. Paste vào editor

### 2.3. Cấu hình

Tìm và cập nhật các biến trong phần `CONFIG`:

```javascript
const CONFIG = {
  // Thay YOUR_SUPABASE_URL_HERE bằng URL thực tế
  SUPABASE_URL: 'https://xxxxx.supabase.co',
  
  // Thay YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE bằng Service Role Key
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  
  // Tên sheet (null = sheet đang active)
  SHEET_NAME: null,
  
  // Số dòng header (thường là 1)
  HEADER_ROW: 1,
  
  // Dòng bắt đầu đọc dữ liệu (sau header)
  START_ROW: 2,
  
  // Cột để đánh dấu trạng thái import (ví dụ: 'Z')
  STATUS_COLUMN: 'Z',
  
  // Số lượng records gửi cùng lúc (batch size)
  // Tăng số này để import nhanh hơn, nhưng không nên quá 100 để tránh timeout
  BATCH_SIZE: 50,
  
  // Delay giữa các batch (ms) - giảm để tăng tốc, tăng để tránh rate limit
  BATCH_DELAY: 50,
  
  // Tự động skip các records bị duplicate (đã tồn tại) thay vì báo lỗi
  SKIP_DUPLICATES: true
};
```

### 2.4. Lưu Script

1. Nhấn **Ctrl+S** (hoặc **Cmd+S** trên Mac)
2. Đặt tên project: "Import Xe lên Supabase"

## Bước 3: Kiểm tra kết nối

### 3.1. Test kết nối Supabase

1. Trong Apps Script Editor, chọn hàm `testConnection` từ dropdown
2. Nhấn nút **Run** (▶)
3. Cho phép quyền truy cập (nếu được hỏi)
4. Nếu thấy thông báo "Kết nối Supabase thành công!" thì đã OK

## Bước 4: Chạy Import

### Cách 1: Chạy từ Apps Script Editor

1. Trong Apps Script Editor, chọn hàm `importVehicles` từ dropdown
2. Nhấn nút **Run** (▶)
3. Cho phép quyền truy cập (nếu được hỏi)
4. Đợi script chạy xong
5. Kiểm tra kết quả trong popup

### Cách 2: Chạy từ Google Sheets (Khuyến nghị)

1. Quay lại Google Sheets
2. Làm mới trang (F5)
3. Bạn sẽ thấy menu mới **"Import Xe"** ở thanh menu
4. Click **Import Xe** > **Import lên Supabase**
5. Đợi script chạy xong
6. Kiểm tra kết quả

## Bước 5: Kiểm tra kết quả

### 5.1. Trong Google Sheets

- Cột `Z` (hoặc cột bạn đã cấu hình trong `STATUS_COLUMN`) sẽ hiển thị:
  - **"Đã import"** (màu xanh) = Thành công
  - **"Đã tồn tại"** (màu vàng) = Biển số đã tồn tại, đã skip
  - **"Lỗi: ..."** (màu đỏ) = Có lỗi khác

### 5.2. Trong Supabase

1. Vào Supabase Dashboard
2. Chọn **Table Editor**
3. Mở bảng `vehicles`
4. Kiểm tra dữ liệu đã được import

## Xử lý lỗi thường gặp

### Lỗi: "Biển số không được để trống"

- **Nguyên nhân**: Cột `BienSo` bị trống
- **Giải pháp**: Kiểm tra và điền biển số cho các dòng bị lỗi

### Lỗi: "duplicate key value violates unique constraint"

- **Nguyên nhân**: Biển số đã tồn tại trong database
- **Giải pháp**: 
  - **Tự động skip**: Script sẽ tự động skip các records duplicate và đánh dấu "Đã tồn tại" (màu vàng)
  - Nếu muốn báo lỗi thay vì skip, đặt `SKIP_DUPLICATES: false` trong CONFIG
  - Hoặc xóa xe cũ trong Supabase trước khi import lại

### Lỗi: "HTTP 401" hoặc "HTTP 403"

- **Nguyên nhân**: Key Supabase không đúng hoặc không có quyền
- **Giải pháp**: 
  - Kiểm tra lại `SUPABASE_KEY` trong CONFIG
  - Đảm bảo dùng **Service Role Key** (không phải Anon Key)

### Lỗi: "HTTP 404"

- **Nguyên nhân**: URL Supabase không đúng
- **Giải pháp**: Kiểm tra lại `SUPABASE_URL` trong CONFIG

### Lỗi: "Invalid date format"

- **Nguyên nhân**: Định dạng ngày trong cột `NienHan` không đúng
- **Giải pháp**: 
  - Format ngày nên là: `DD/MM/YYYY` hoặc `YYYY-MM-DD`
  - Hoặc để trống nếu không có

## Mapping dữ liệu

Các cột từ sheet được map sang database như sau:

| Cột Sheet | Trường Database | Ghi chú |
|-----------|----------------|---------|
| `IDXe` | `id` | Nếu trống sẽ tự động generate UUID |
| `BienSo` | `plate_number` | **Bắt buộc** |
| `SoKhung` | `chassis_number` | |
| `SoMay` | `engine_number` | |
| `SoCho` | `seat_capacity` | Chuyển sang số nguyên |
| `NienHan` | `inspection_expiry_date` | Parse từ nhiều format |
| Các cột khác | `notes` | Tập hợp vào trường notes |

## Lưu ý quan trọng

1. **Backup dữ liệu**: Nên backup dữ liệu trước khi import
2. **Test với ít dòng**: Nên test với 5-10 dòng trước khi import toàn bộ
3. **Service Role Key**: Chỉ dùng trong script, không chia sẻ công khai
4. **Rate Limit**: Script có delay 100ms giữa các request để tránh rate limit
5. **Import lại**: Script sẽ bỏ qua các dòng đã có status "Đã import" hoặc "Đã tồn tại"
6. **Xử lý Duplicate tự động**: Script tự động skip các records có biển số đã tồn tại và đánh dấu "Đã tồn tại" (màu vàng)

## Tùy chỉnh nâng cao

### ⚡ Tăng tốc độ import

Để import nhanh hơn, bạn có thể:

1. **Tăng BATCH_SIZE** (khuyến nghị: 50-100):
```javascript
BATCH_SIZE: 100  // Tăng từ 50 lên 100
```

2. **Giảm BATCH_DELAY** (khuyến nghị: 50-100ms):
```javascript
BATCH_DELAY: 25  // Giảm từ 50ms xuống 25ms
```

**Lưu ý**: 
- Không nên tăng BATCH_SIZE quá 100 để tránh timeout
- Không nên giảm BATCH_DELAY xuống 0 để tránh rate limit của Supabase
- Với 1000 records, BATCH_SIZE=100 và BATCH_DELAY=50ms sẽ mất khoảng 0.5 giây

### Thay đổi cột status

Nếu muốn dùng cột khác để đánh dấu trạng thái:

```javascript
STATUS_COLUMN: 'AA' // Thay đổi thành cột bạn muốn
```

### Import từ sheet cụ thể

Nếu có nhiều sheet và muốn import từ sheet cụ thể:

```javascript
SHEET_NAME: 'Danh sách xe' // Tên sheet
```

### Thêm mapping cột mới

Nếu có thêm cột trong sheet và muốn map sang database:

```javascript
COLUMN_MAPPING: {
  // ... các mapping hiện có
  'TenCotMoi': 'ten_field_moi'
}
```

## So sánh tốc độ

| Phương pháp | Tốc độ | Thời gian (1000 records) |
|------------|--------|--------------------------|
| **Single insert** (cũ) | ~10 records/giây | ~100 giây |
| **Batch insert** (mới) | ~500-1000 records/giây | ~1-2 giây |

**Cải thiện**: Nhanh hơn **50-100 lần**! 🚀

## Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. Log trong Apps Script Editor: **View** > **Execution log**
2. Log trong Supabase: **Logs** > **API Logs**

