# Hướng Dẫn Cho AI - Hệ Thống Quản Lý Bến Xe

File này chứa các quy ước và thông tin quan trọng để AI có thể làm việc hiệu quả với codebase này.

## ⚠️ QUY TẮC QUAN TRỌNG NHẤT: Đặt Tên Tiếng Việt

### Pages (Bắt buộc sử dụng tên tiếng Việt)

**KHÔNG BAO GIỜ** sử dụng tên tiếng Anh cho các page files. Tất cả các page files PHẢI sử dụng tên tiếng Việt không dấu:

| Tiếng Anh (CŨ - KHÔNG DÙNG) | Tiếng Việt (MỚI - PHẢI DÙNG) |
|------------------------------|------------------------------|
| `Contact.tsx` | `LienHe.tsx` |
| `Dispatch.tsx` | `DieuDo.tsx` |
| `Payment.tsx` | `ThanhToan.tsx` |
| `Vehicles.tsx` | `QuanLyXe.tsx` |
| `Drivers.tsx` | `QuanLyLaiXe.tsx` |
| `Reports.tsx` | `BaoCao.tsx` |

**Quy tắc đặt tên page:**
- Sử dụng tiếng Việt không dấu
- Viết hoa chữ cái đầu mỗi từ (PascalCase)
- Ví dụ: `LienHe`, `DieuDo`, `QuanLyXe`, `QuanLyLaiXe`, `BaoCao`, `ThanhToan`

### Routes (URL paths)

Routes trong `App.tsx` sử dụng dấu gạch ngang (kebab-case), tiếng Việt không dấu:

| Route Path | Component |
|------------|-----------|
| `/lien-he` | `LienHe` |
| `/dieu-do` | `DieuDo` |
| `/thanh-toan/:id` | `ThanhToan` |
| `/quan-ly-xe` | `QuanLyXe` |
| `/quan-ly-lai-xe` | `QuanLyLaiXe` |
| `/bao-cao` | `BaoCao` |
| `/dashboard` | `Dashboard` |
| `/profile` | `Profile` |
| `/login` | `Login` |
| `/register` | `Register` |

**Lưu ý:** Một số routes như `/dashboard`, `/login`, `/register` vẫn giữ tiếng Anh vì lý do kỹ thuật, nhưng các page mới PHẢI dùng tiếng Việt.

### Function Names

Tên function export default trong mỗi page file phải khớp với tên file:

```typescript
// ✅ ĐÚNG
// File: LienHe.tsx
export default function LienHe() { ... }

// File: DieuDo.tsx
export default function DieuDo() { ... }

// ❌ SAI
// File: LienHe.tsx
export default function Contact() { ... }
```

### Navigate và Links

Khi sử dụng `navigate()` hoặc `<Link>`, PHẢI dùng route path tiếng Việt:

```typescript
// ✅ ĐÚNG
navigate("/dieu-do")
navigate(`/thanh-toan/${id}`)
<Link to="/lien-he">Liên hệ</Link>

// ❌ SAI
navigate("/dispatch")
navigate(`/payment/${id}`)
<Link to="/contact">Contact</Link>
```

## 📁 Cấu Trúc Thư Mục

```
client/src/
├── components/
│   ├── ui/              # shadcn/ui components (Button, Input, Card, etc.)
│   ├── layout/          # Layout components
│   │   ├── MainLayout.tsx
│   │   ├── PublicLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── PublicHeader.tsx
│   │   └── UserDropdown.tsx
│   ├── dispatch/        # Dispatch-specific components
│   │   ├── VehicleEntryDialog.tsx
│   │   ├── PassengerDropDialog.tsx
│   │   ├── PermitDialog.tsx
│   │   └── ...
│   └── guide/           # Guide page components
├── pages/
│   ├── HomePage.tsx     # Trang chủ (Public)
│   ├── Login.tsx        # Đăng nhập
│   ├── Register.tsx     # Đăng ký
│   ├── Dashboard.tsx    # Tổng quan
│   ├── Profile.tsx      # Hồ sơ
│   ├── LienHe.tsx       # Liên hệ ⭐
│   ├── DieuDo.tsx       # Điều độ xe ⭐
│   ├── ThanhToan.tsx    # Thanh toán ⭐
│   ├── QuanLyXe.tsx     # Quản lý xe ⭐
│   ├── QuanLyLaiXe.tsx  # Quản lý lái xe ⭐
│   ├── BaoCao.tsx       # Báo cáo ⭐
│   ├── pricing/         # Trang bảng giá
│   └── guide/           # Trang hướng dẫn
├── services/            # API services
│   ├── auth.service.ts
│   ├── vehicle.service.ts
│   ├── driver.service.ts
│   ├── dispatch.service.ts
│   ├── report.service.ts
│   └── ...
├── store/               # Zustand stores
│   ├── auth.store.ts
│   └── dispatch.store.ts
├── types/               # TypeScript types
│   └── index.ts
├── lib/                 # Utilities
│   ├── api.ts          # Axios instance với interceptors
│   ├── utils.ts        # Helper functions
│   └── toast.ts        # Toast notification helper
├── assets/             # Images, logos
└── App.tsx             # Main app với routes
```

## 🔌 Routes và Layouts

### Public Routes (Không cần đăng nhập)
- `/` - HomePage (PublicLayout)
- `/login` - Login (không có layout)
- `/register` - Register (không có layout)
- `/lien-he` - LienHe (PublicLayout)
- `/pricing/*` - Pricing pages (PublicLayout)
- `/guide/*` - Guide pages (GuideLayout hoặc không layout)

### Protected Routes (Cần đăng nhập)
Tất cả các route được bọc trong `<ProtectedRoute>`:
- `/dashboard` - Dashboard (MainLayout)
- `/dieu-do` - DieuDo (MainLayout)
- `/thanh-toan/:id` - ThanhToan (MainLayout)
- `/quan-ly-xe` - QuanLyXe (MainLayout)
- `/quan-ly-lai-xe` - QuanLyLaiXe (MainLayout)
- `/bao-cao` - BaoCao (MainLayout)
- `/profile` - Profile (PublicLayout)

**ProtectedRoute component:** Tự động redirect đến `/login` nếu chưa đăng nhập.

## 🎨 Component Patterns

### 1. Page Component Structure

```typescript
// ✅ Mẫu chuẩn cho một page
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"

export default function TenPage() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      // API call
    } catch (error) {
      toast.error("Có lỗi xảy ra")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Page content */}
    </div>
  )
}
```

### 2. Navigation trong Pages

```typescript
// ✅ Sử dụng route tiếng Việt
import { useNavigate } from "react-router-dom"

const navigate = useNavigate()

// Navigate đến trang khác
navigate("/dieu-do")
navigate(`/thanh-toan/${recordId}`)

// Quay lại
navigate(-1)
```

### 3. Sidebar Navigation

File `components/layout/Sidebar.tsx` chứa navigation array. Khi thêm route mới, cập nhật cả:
1. Route trong `App.tsx`
2. Navigation item trong `Sidebar.tsx`

```typescript
const navigation = [
  { name: "Trang chủ", href: "/", icon: Home },
  { name: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { name: "Điều độ xe", href: "/dieu-do", icon: CalendarClock }, // ⭐
  { name: "Quản lý xe", href: "/quan-ly-xe", icon: Bus }, // ⭐
  { name: "Quản lý lái xe", href: "/quan-ly-lai-xe", icon: Users }, // ⭐
  { name: "Báo cáo", href: "/bao-cao", icon: BarChart3 }, // ⭐
]
```

## 🔧 Services và API

### API Client Setup

File `lib/api.ts` đã được cấu hình với:
- Base URL từ `import.meta.env.VITE_API_URL`
- Request interceptor: Tự động thêm `Authorization: Bearer <token>`
- Response interceptor: Xử lý lỗi và refresh token nếu cần

### Service Pattern

```typescript
// ✅ Mẫu service
import { api } from "@/lib/api"
import type { Vehicle } from "@/types"

export const vehicleService = {
  getAll: async (params?: any): Promise<Vehicle[]> => {
    const response = await api.get<Vehicle[]>("/vehicles", { params })
    return response.data
  },

  getById: async (id: string): Promise<Vehicle> => {
    const response = await api.get<Vehicle>(`/vehicles/${id}`)
    return response.data
  },

  create: async (data: any): Promise<Vehicle> => {
    const response = await api.post<Vehicle>("/vehicles", data)
    return response.data
  },

  update: async (id: string, data: any): Promise<Vehicle> => {
    const response = await api.put<Vehicle>(`/vehicles/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/vehicles/${id}`)
  },
}
```

## 📦 State Management (Zustand)

### Store Pattern

```typescript
// ✅ Mẫu Zustand store
import { create } from "zustand"

interface StoreState {
  items: Item[]
  setItems: (items: Item[]) => void
  addItem: (item: Item) => void
  removeItem: (id: string) => void
}

export const useStore = create<StoreState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter(item => item.id !== id)
  })),
}))
```

### Sử dụng trong Component

```typescript
// ✅ Selector pattern (khuyến khích)
const items = useStore((state) => state.items)
const setItems = useStore((state) => state.setItems)

// ❌ Tránh select toàn bộ store
const store = useStore() // KHÔNG khuyến khích
```

## 🎯 UI Components (shadcn/ui)

Tất cả UI components nằm trong `components/ui/`:
- `Button`, `Input`, `Card`, `Label`, `Dialog`, `Table`, `Badge`, `Tabs`, `Checkbox`, `Select`, `Textarea`

**Import pattern:**
```typescript
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
```

## 📝 TypeScript Types

Tất cả types định nghĩa trong `types/index.ts`:

```typescript
// ✅ Export types từ một file
import type { Vehicle, Driver, DispatchRecord } from "@/types"
```

## 🎨 Styling (TailwindCSS)

### Color System
- Primary: `bg-blue-500`, `text-blue-600`
- Success: `bg-green-500`, `text-green-600`
- Warning: `bg-yellow-500`, `text-yellow-600`
- Danger: `bg-red-500`, `text-red-600`
- Gray: `bg-gray-100`, `text-gray-600`

### Spacing
- Consistent: `space-y-4`, `gap-4`, `p-4`, `m-4`

### Responsive
- Mobile-first: `md:`, `lg:`, `xl:` breakpoints

## ✅ Checklist Khi Tạo Page Mới

1. **Tạo file page với tên tiếng Việt không dấu (PascalCase)**
   ```typescript
   // File: QuanLyXe.tsx
   export default function QuanLyXe() { ... }
   ```

2. **Thêm route vào `App.tsx`**
   ```typescript
   import QuanLyXe from "@/pages/QuanLyXe"
   
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
   ```

3. **Cập nhật Sidebar navigation (nếu cần)**
   ```typescript
   { name: "Quản lý xe", href: "/quan-ly-xe", icon: Bus }
   ```

4. **Sử dụng route path tiếng Việt trong navigate/Link**
   ```typescript
   navigate("/quan-ly-xe")
   <Link to="/quan-ly-xe">Quản lý xe</Link>
   ```

## 🚨 Các Lỗi Thường Gặp

### ❌ Lỗi 1: Sử dụng tên tiếng Anh cho page
```typescript
// ❌ SAI
export default function Vehicles() { ... }
navigate("/vehicles")

// ✅ ĐÚNG
export default function QuanLyXe() { ... }
navigate("/quan-ly-xe")
```

### ❌ Lỗi 2: Import sai tên file
```typescript
// ❌ SAI
import Vehicles from "@/pages/Vehicles"

// ✅ ĐÚNG
import QuanLyXe from "@/pages/QuanLyXe"
```

### ❌ Lỗi 3: Route path không khớp
```typescript
// ❌ SAI
<Route path="/vehicles" element={<QuanLyXe />} />

// ✅ ĐÚNG
<Route path="/quan-ly-xe" element={<QuanLyXe />} />
```

## 📚 Tài Liệu Tham Khảo

- `README.md` - Hướng dẫn tổng quan
- `SETUP.md` - Hướng dẫn setup
- `LOGIN_GUIDE.md` - Hướng dẫn đăng nhập
- `src/types/index.ts` - Tất cả TypeScript types
- `src/services/` - Tất cả API services

## 🔍 Tìm Kiếm trong Codebase

Khi cần tìm code:
- Sử dụng `codebase_search` để tìm semantic matches
- Sử dụng `grep` để tìm exact strings
- Kiểm tra `App.tsx` để xem tất cả routes
- Kiểm tra `Sidebar.tsx` để xem navigation

---

**Nhớ:** Luôn sử dụng tên tiếng Việt cho pages, routes, và function names! ⭐

