# Hướng dẫn cấu hình kết nối Frontend và Backend

## Tổng quan
- **Frontend**: Deploy trên Vercel tại `https://quan-li-ben-xe.vercel.app/`
- **Backend**: Deploy trên Render tại `https://ben-xe-backend.onrender.com`

## Bước 1: Cấu hình CORS trên Backend (Render)

Trên Render Dashboard, bạn cần thêm biến môi trường `CORS_ORIGIN`:

1. Vào Render Dashboard
2. Chọn service backend của bạn
3. Vào tab **Environment**
4. Thêm biến môi trường mới:
   - **Key**: `CORS_ORIGIN`
   - **Value**: `https://quan-li-ben-xe.vercel.app`
   - Hoặc nhiều origin (ngăn cách bởi dấu phẩy): `https://quan-li-ben-xe.vercel.app,http://localhost:5173`
5. Lưu và redeploy service

**Lưu ý**: 
- Backend đã được cập nhật để tự động xử lý dấu `/` ở cuối URL, nên bạn có thể thêm hoặc không thêm dấu `/` đều được
- Có thể cấu hình nhiều origin bằng cách ngăn cách bởi dấu phẩy (hữu ích cho dev và production)

## Bước 2: Cấu hình API URL trên Frontend (Vercel)

Trên Vercel Dashboard, bạn cần thêm biến môi trường `VITE_API_URL`:

1. Vào Vercel Dashboard
2. Chọn project frontend của bạn
3. Vào **Settings** > **Environment Variables**
4. Thêm biến môi trường mới:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://ben-xe-backend.onrender.com/api`
5. Chọn môi trường: **Production**, **Preview**, và **Development** (nếu cần)
6. Lưu và redeploy

## Bước 3: Kiểm tra kết nối

Sau khi cấu hình xong:

1. **Kiểm tra Backend Health Check**:
   ```
   https://ben-xe-backend.onrender.com/health
   ```
   Nên trả về: `{"status":"ok","timestamp":"..."}`

2. **Kiểm tra Frontend**:
   - Mở `https://quan-li-ben-xe.vercel.app/`
   - Thử đăng nhập hoặc gọi API
   - Mở Developer Tools (F12) > Network tab để xem các request

## Cấu hình cho Development (Local)

### Backend `.env`:
```env
CORS_ORIGIN=http://localhost:5173
PORT=3000
# ... các biến khác
```

### Frontend `.env`:
```env
VITE_API_URL=http://localhost:3000/api
```

## Troubleshooting

### Lỗi CORS
- ✅ **Đã sửa**: Backend đã được cập nhật để tự động xử lý dấu `/` ở cuối URL
- Kiểm tra `CORS_ORIGIN` trên Render có đúng URL frontend không
- Kiểm tra backend đã được redeploy sau khi thay đổi biến môi trường
- Nếu vẫn lỗi, thử xóa và thêm lại biến môi trường `CORS_ORIGIN` trên Render
- Kiểm tra trong Render logs xem CORS có được cấu hình đúng không

### Lỗi kết nối API
- Kiểm tra `VITE_API_URL` trên Vercel có đúng URL backend không
- Đảm bảo có `/api` ở cuối URL
- Kiểm tra frontend đã được redeploy sau khi thay đổi biến môi trường
- Kiểm tra backend có đang chạy không (health check)

### Lỗi 401 Unauthorized
- Kiểm tra token có được lưu trong localStorage không
- Kiểm tra backend có nhận được token trong header Authorization không

