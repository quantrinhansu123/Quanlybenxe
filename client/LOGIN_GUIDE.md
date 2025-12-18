# Hướng dẫn đăng nhập

## Tài khoản Mock Data

Bạn có thể sử dụng bất kỳ tài khoản nào sau đây để đăng nhập vào hệ thống:

### 🔑 Tài khoản mẫu

| Tên đăng nhập | Mật khẩu | Vai trò | Mô tả |
|--------------|----------|---------|-------|
| `admin` | `admin123` | Admin | Quản trị viên - Toàn quyền |
| `manager` | `manager123` | Manager | Quản lý - Quản lý hệ thống |
| `staff` | `staff123` | Staff | Nhân viên - Thao tác cơ bản |
| `operator` | `operator123` | Operator | Điều độ - Điều độ xe |

## Cách đăng nhập

1. **Mở ứng dụng** - Chạy `npm run dev` và mở trình duyệt
2. **Vào trang đăng nhập** - Ứng dụng sẽ tự động chuyển đến `/login` nếu chưa đăng nhập
3. **Nhập thông tin**:
   - Tên đăng nhập: Ví dụ `admin`
   - Mật khẩu: Ví dụ `admin123`
   - (Tùy chọn) Tích vào "Ghi nhớ đăng nhập"
4. **Click "Đăng nhập"**
5. **Chuyển hướng** - Sau khi đăng nhập thành công, bạn sẽ được chuyển đến Dashboard

## Ví dụ đăng nhập

### Đăng nhập với quyền Admin:
```
Tên đăng nhập: admin
Mật khẩu: admin123
```

### Đăng nhập với quyền Manager:
```
Tên đăng nhập: manager
Mật khẩu: manager123
```

## Lưu ý

- ⚠️ Tất cả các tài khoản trên đều là **mock data**, không có backend thực tế
- 🔒 Token được lưu trong `localStorage` của trình duyệt
- 🔄 Để chuyển sang API thực tế, mở `src/services/auth.service.ts` và đổi `USE_MOCK_DATA = false`

## Chuyển sang API thực tế

Khi backend sẵn sàng:

1. Mở file `src/services/auth.service.ts`
2. Tìm dòng: `const USE_MOCK_DATA = true`
3. Đổi thành: `const USE_MOCK_DATA = false`
4. Đảm bảo API endpoint đúng trong file `.env`:
   ```
   VITE_API_URL=http://localhost:3000/api
   ```

## Xử lý lỗi

Nếu gặp lỗi "Tên đăng nhập hoặc mật khẩu không đúng":
- Kiểm tra lại tên đăng nhập và mật khẩu
- Đảm bảo không có khoảng trắng thừa
- Thử một tài khoản khác từ danh sách trên

## Đăng xuất

Để đăng xuất, click vào nút "Đăng xuất" ở sidebar (biểu tượng LogOut ở cuối menu).

