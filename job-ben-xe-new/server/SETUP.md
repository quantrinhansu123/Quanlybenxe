# Hướng dẫn thiết lập Backend

Backend sử dụng **Node.js + Express.js + Firebase Realtime Database**.

## Bước 1: Cài đặt Dependencies

```bash
cd server
npm install
```

## Bước 2: Tạo file .env

Tạo file `.env` trong thư mục `server/`:

```env
PORT=3000
NODE_ENV=development

# Firebase Realtime Database
FIREBASE_DATABASE_URL=https://webbenxe-default-rtdb.asia-southeast1.firebasedatabase.app/

# JWT Authentication
JWT_SECRET=your_very_secure_random_secret_key_here
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:5173

# Cloudinary (for image uploads - optional)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Lưu ý:** 
- `JWT_SECRET` nên là chuỗi ngẫu nhiên mạnh (tạo bằng: `openssl rand -base64 32`)
- `CORS_ORIGIN` phải khớp với URL frontend
- `FIREBASE_DATABASE_URL` đã được cấu hình sẵn

## Bước 3: Seed dữ liệu mẫu

Tạo dữ liệu mẫu trong Firebase:

```bash
npm run seed
```

Script sẽ tạo:
- 3 users (admin, dieudo, ketoan) với password `123456`
- Operators, drivers, vehicles, routes, locations
- Dispatch records, services và các dữ liệu mẫu khác

## Bước 4: Chạy server

### Development mode:
```bash
npm run dev
```

### Production mode:
```bash
npm run build
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## Thông tin đăng nhập mặc định

Sau khi seed, sử dụng:
- **Admin**: `admin` / `123456`
- **Dispatcher**: `dieudo` / `123456`
- **Accountant**: `ketoan` / `123456`

## Tạo Admin user thủ công (nếu cần)

```bash
npm run create-admin [username] [password] [fullName]
```

Ví dụ:
```bash
npm run create-admin admin admin123 "Administrator"
```

## Kiểm tra

### Health check:
```bash
curl http://localhost:3000/health
```

### Login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"admin","password":"123456"}'
```

## Firebase Database

Firebase Realtime Database tự động tạo collections khi sử dụng. Không cần chạy migration.

Các collections chính:
- `users` - Người dùng hệ thống
- `operators` - Đơn vị vận tải
- `drivers` - Lái xe
- `vehicles` - Xe
- `vehicle_documents` - Giấy tờ xe
- `dispatch_records` - Bản ghi điều độ
- `routes` - Tuyến đường
- `locations` - Bến xe
- `shifts` - Ca trực
- `services` - Dịch vụ
- `invoices` - Hóa đơn

## Cấu trúc thư mục

```
server/
├── src/
│   ├── config/          # Firebase database config
│   ├── controllers/     # Business logic
│   ├── db/              # Seed scripts
│   ├── middleware/      # Auth, error handling
│   ├── routes/          # API routes
│   ├── scripts/         # Utility scripts
│   ├── types/           # TypeScript types
│   └── index.ts         # Entry point
├── .env                 # Environment variables
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Lỗi kết nối Firebase
- Kiểm tra `FIREBASE_DATABASE_URL` trong `.env`
- Đảm bảo Firebase Realtime Database đã được tạo và có quyền truy cập
- Nếu sử dụng service account, kiểm tra đường dẫn `FIREBASE_SERVICE_ACCOUNT_PATH`

### Lỗi JWT
- Kiểm tra `JWT_SECRET` đã được set trong `.env`
- Đảm bảo secret key đủ mạnh

### Lỗi CORS
- Kiểm tra `CORS_ORIGIN` trong `.env` khớp với URL frontend
- Nếu frontend chạy trên port khác, cập nhật `CORS_ORIGIN`

### Lỗi database
- Database sẽ được tạo tự động khi bạn bắt đầu sử dụng API
- Kiểm tra Firebase Console để xem dữ liệu đã được lưu chưa
- Đảm bảo Firebase Realtime Database rules cho phép đọc/ghi

