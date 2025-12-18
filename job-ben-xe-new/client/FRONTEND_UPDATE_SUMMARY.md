# Tóm tắt cập nhật Frontend

## ✅ Đã hoàn thành

### 1. Types & Interfaces
- ✅ `src/types/index.ts` - Đã cập nhật hoàn toàn với tất cả types mới
- ✅ Bao gồm: Operator, VehicleType, Location, Route, Schedule, Violation, Invoice, ServiceCharge, etc.
- ✅ Dispatch types đã cập nhật với workflow mới

### 2. Services đã tạo/cập nhật

#### Services mới:
- ✅ `operator.service.ts` - CRUD operators
- ✅ `location.service.ts` - CRUD locations
- ✅ `route.service.ts` - CRUD routes
- ✅ `schedule.service.ts` - CRUD schedules
- ✅ `vehicle-type.service.ts` - CRUD vehicle types
- ✅ `violation.service.ts` - Quản lý vi phạm
- ✅ `invoice.service.ts` - Quản lý hóa đơn
- ✅ `service-charge.service.ts` - Quản lý phí dịch vụ

#### Services đã cập nhật:
- ✅ `driver.service.ts` - Thêm filter operatorId, isActive
- ✅ `vehicle.service.ts` - Thêm filter operatorId, isActive
- ✅ `dispatch.service.ts` - Cập nhật với workflow mới:
  - `recordPassengerDrop` - Ghi nhận hành khách xuống
  - `issuePermit` - Cấp phép (approved/rejected)
  - `processPayment` - Xử lý thanh toán
  - `issueDepartureOrder` - Lệnh xuất bến
  - `recordExit` - Ghi nhận ra khỏi bến
- ✅ `report.service.ts` - Đã cập nhật

## 📋 Cần cập nhật trong Pages/Components

### 1. Drivers Page (`src/pages/Drivers.tsx`)

**Thay đổi cần thiết:**
- ✅ Schema validation cần cập nhật:
  - Thêm `operatorId` (bắt buộc)
  - Thêm `idNumber` (bắt buộc)
  - Thêm `licenseClass` (bắt buộc)
  - Thay `phoneNumber` → `phone`
  - Thay `licenseExpiry` → `licenseExpiryDate`
  - Thêm `licenseIssueDate` (tùy chọn)
  - Thêm `healthCertificateExpiry` (tùy chọn)
  - Thêm `dateOfBirth`, `address` (tùy chọn)
  - Bỏ `contractExpiry` (không có trong schema mới)
  - Thay `status` → `isActive` (boolean)

- ✅ Form fields cần thêm:
  - Operator selector (dropdown)
  - ID Number input
  - License Class input
  - License Issue Date
  - Health Certificate Expiry
  - Date of Birth
  - Address

- ✅ Display cần cập nhật:
  - Hiển thị operator name
  - Hiển thị license class
  - Hiển thị license expiry date (thay vì licenseExpiry)

### 2. Vehicles Page (`src/pages/Vehicles.tsx`)

**Thay đổi cần thiết:**
- ✅ Schema validation cần cập nhật:
  - Thay `vehicleType` (string) → `vehicleTypeId` (UUID)
  - Thay `operatorId` (string) → `operatorId` (UUID)
  - Bỏ `operatorName` (lấy từ operator relation)
  - Thay `status` → `isActive` (boolean)
  - Thêm `manufactureYear`, `chassisNumber`, `engineNumber`, `color` (tùy chọn)
  - Documents: thêm `operation_permit`, `emblem`, bỏ `permit`

- ✅ Form fields cần thêm:
  - Vehicle Type selector (dropdown)
  - Operator selector (dropdown)
  - Manufacture Year
  - Chassis Number
  - Engine Number
  - Color
  - Operation Permit document
  - Emblem document

### 3. Dispatch Page (`src/pages/Dispatch.tsx`)

**Thay đổi cần thiết:**
- ✅ Schema validation cần cập nhật:
  - Thay `route` (string) → `routeId` (UUID)
  - Thêm `scheduleId` (tùy chọn)
  - Thay `status` → `currentStatus` với các giá trị mới:
    - `entered`, `passengers_dropped`, `permit_issued`, `permit_rejected`, `paid`, `departure_ordered`, `departed`

- ✅ Workflow cần cập nhật:
  - Thêm bước "Passengers Dropped"
  - Permit có thể approved hoặc rejected
  - Thêm bước "Departure Ordered"
  - Các trường mới: `transportOrderCode`, `permitStatus`, `rejectionReason`, etc.

- ✅ Form fields cần thêm:
  - Route selector (dropdown)
  - Schedule selector (tùy chọn)
  - Transport Order Code input
  - Permit Status selector
  - Rejection Reason (nếu rejected)

### 4. Reports Page (`src/pages/Reports.tsx`)

**Thay đổi cần thiết:**
- ✅ Filter cần cập nhật:
  - Thêm `operatorId` filter
  - Thêm `routeId` filter
  - Thay `status` → `currentStatus` với các giá trị mới

### 5. Pages mới cần tạo

- ⏳ `Operators.tsx` - Quản lý nhà xe
- ⏳ `Locations.tsx` - Quản lý địa điểm
- ⏳ `Routes.tsx` - Quản lý tuyến đường
- ⏳ `Schedules.tsx` - Quản lý lịch trình
- ⏳ `Violations.tsx` - Quản lý vi phạm
- ⏳ `Invoices.tsx` - Quản lý hóa đơn

## 🔧 Migration Guide

### Thay đổi trong Driver Form

**Trước:**
```typescript
{
  fullName: string
  phoneNumber: string
  email?: string
  licenseNumber: string
  licenseExpiry: string
  contractExpiry?: string
}
```

**Sau:**
```typescript
{
  operatorId: string  // BẮT BUỘC
  fullName: string
  idNumber: string  // BẮT BUỘC
  phone?: string
  email?: string
  licenseNumber: string
  licenseClass: string  // BẮT BUỘC
  licenseExpiryDate: string
  licenseIssueDate?: string
  healthCertificateExpiry?: string
  dateOfBirth?: string
  address?: string
  imageUrl?: string
}
```

### Thay đổi trong Vehicle Form

**Trước:**
```typescript
{
  plateNumber: string
  vehicleType: string
  seatCapacity: number
  operatorId: string
  documents: {
    registration, inspection, permit, insurance
  }
}
```

**Sau:**
```typescript
{
  plateNumber: string
  vehicleTypeId?: string  // UUID
  operatorId: string  // UUID
  seatCapacity: number
  manufactureYear?: number
  chassisNumber?: string
  engineNumber?: string
  color?: string
  documents: {
    registration, inspection, insurance, operation_permit, emblem
  }
}
```

### Thay đổi trong Dispatch Form

**Trước:**
```typescript
{
  vehicleId: string
  driverId: string
  route: string
  entryTime: string
}
```

**Sau:**
```typescript
{
  vehicleId: string
  driverId: string
  routeId: string  // UUID
  scheduleId?: string  // UUID
  entryTime: string
}
```

## 📝 Notes

1. **Backward Compatibility**: Một số services vẫn giữ legacy methods để tương thích ngược
2. **API Base URL**: Đảm bảo `VITE_API_URL` trong `.env` trỏ đúng backend
3. **Authentication**: Tất cả API calls đều tự động thêm JWT token
4. **Error Handling**: API interceptor đã xử lý 401 và redirect về login

## 🚀 Next Steps

1. ⏳ Cập nhật Drivers page với form mới
2. ⏳ Cập nhật Vehicles page với form mới
3. ⏳ Cập nhật Dispatch page với workflow mới
4. ⏳ Cập nhật Reports page với filters mới
5. ⏳ Tạo các pages mới (Operators, Locations, Routes, etc.)
6. ⏳ Test tất cả các tính năng
7. ⏳ Update routing nếu cần

---

**Status: Types & Services ✅ Hoàn thành | Pages ⏳ Cần cập nhật**

