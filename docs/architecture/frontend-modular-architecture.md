# Frontend Modular Architecture

## Overview

The frontend uses a feature-based modular architecture where code is organized by business domain rather than technical concern. This architecture improves maintainability, enables better code splitting, and makes the codebase easier to navigate.

## Directory Structure

```
src/
  features/                 # Business feature modules
    auth/                   # Authentication feature
      api/                  # API services
      components/           # Feature components
      hooks/                # Custom hooks
      store/                # Zustand store
      types/                # TypeScript types
      index.ts              # Public API
    dispatch/               # Dispatch management (Dieu Do)
      api/                  # dispatchApi service
      components/           # Icons, dialogs (re-exported)
      hooks/                # useDispatch hook
      store/                # dispatchStore
      types/                # Dispatch types
      index.ts              # Public API
    fleet/                  # Fleet management
      vehicles/             # Vehicle domain
      drivers/              # Driver domain
      operators/            # Operator domain
      vehicle-badges/       # Vehicle badge domain
      index.ts              # Unified public API

  components/               # Shared components
    common/                 # Common components (PageLoader, etc.)
    layout/                 # Layout components (DashboardLayout)
    ui/                     # shadcn/ui primitives
    dispatch/               # Dispatch dialogs (original location)
    vehicle/                # Vehicle components (original location)
    driver/                 # Driver components (original location)
    operator/               # Operator components (original location)

  hooks/                    # Shared custom hooks
  lib/                      # Utilities (api, utils)
  pages/                    # Page components
  services/                 # Legacy services (re-exports to features)
  store/                    # Global stores (UI, legacy re-exports)
  types/                    # Shared type definitions
```

## Feature Structure Pattern

Each feature follows this consistent structure:

```
features/{feature}/
  api/                      # API service layer
    {feature}Api.ts         # Main API service
    index.ts                # Barrel export
  components/               # Feature-specific components
    index.ts                # Barrel export
  hooks/                    # Feature-specific hooks
    use{Feature}.ts         # Main hook combining store + API
    index.ts                # Barrel export
  store/                    # Feature-specific Zustand store
    {feature}Store.ts       # Store definition
  types/                    # Feature-specific types
    index.ts                # Type definitions + re-exports
  index.ts                  # Public API exports
```

## Import Patterns

### Preferred: Import from Feature Public API

```typescript
// Auth feature
import { useAuth, ProtectedRoute, authApi } from '@/features/auth'
import type { User, LoginCredentials } from '@/features/auth'

// Dispatch feature
import { useDispatch, dispatchApi, useDispatchStore } from '@/features/dispatch'
import { ChoXeVaoBenDialog, CapPhepDialog } from '@/features/dispatch'
import type { DispatchRecord, DispatchStatus } from '@/features/dispatch'

// Fleet feature
import { vehicleService, driverService, operatorService } from '@/features/fleet'
import { VehicleForm, DriverDialog, OperatorView } from '@/features/fleet'
import type { Vehicle, Driver, Operator } from '@/features/fleet'
```

### Legacy: Still Supported via Re-exports

```typescript
// These still work via backward compatibility re-exports
import { dispatchService } from '@/services/dispatch.service'
import { vehicleService } from '@/services/vehicle.service'
import { useAuthStore } from '@/store/auth.store'
```

### Shared Components

```typescript
// UI primitives
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Common components
import { PageLoader } from '@/components/common/PageLoader'
import { StatusBadge } from '@/components/common/StatusBadge'

// Layout
import { DashboardLayout } from '@/components/layout/DashboardLayout'
```

### Shared Types

```typescript
// Import from shared types
import type { Route, Schedule, Location } from '@/types'
import type { DispatchRecord, Vehicle, Driver } from '@/types'
```

## Code Splitting Strategy

### Lazy Loading Pages

All page components are lazy loaded using React.lazy():

```typescript
const Dashboard = lazy(() => import("@/pages/Dashboard"))
const DieuDo = lazy(() => import("@/pages/DieuDo"))
const QuanLyXe = lazy(() => import("@/pages/QuanLyXe"))
```

### Vendor Bundle Splitting

Vendor splitting is configured in `vite.config.ts`:

| Chunk | Contents | Approximate Size |
|-------|----------|------------------|
| vendor-react | React, ReactDOM, React Router | ~163KB |
| vendor-radix | Radix UI components | ~68KB |
| vendor-utils | date-fns, axios, zustand | ~89KB |
| vendor-icons | Lucide icons | ~38KB |
| vendor-charts | Recharts | ~382KB |
| vendor-toast | React Toastify | ~30KB |
| xlsx | SheetJS | ~283KB |

## Feature Ownership

| Feature | Domain | Files | Status |
|---------|--------|-------|--------|
| auth | Authentication, Authorization | 7 | Migrated |
| dispatch | Dispatch workflow (Dieu Do) | 15+ | Core migrated |
| fleet/vehicles | Vehicle management | 5 | Core migrated |
| fleet/drivers | Driver management | 4 | Core migrated |
| fleet/operators | Operator management | 4 | Core migrated |
| fleet/vehicle-badges | Badge management | 3 | Core migrated |

## Migration Status

### Completed
- Feature directory structure created
- Types organized per feature
- API services created in features
- Zustand stores migrated
- Custom hooks created
- Backward compatibility re-exports in place
- Build passes successfully

### In Progress
- Gradual migration of imports from legacy paths to feature paths
- Component migration (dialogs remain in original location with re-exports)

### Future Work
- Migrate remaining features (routes, reports, pricing)
- Move components from legacy locations to features
- Remove backward compatibility re-exports after full migration

## Best Practices

### 1. Feature Encapsulation
- Each feature should be self-contained
- Export only what's needed via `index.ts`
- Use relative imports within a feature
- Use absolute imports (`@/features/...`) for cross-feature dependencies

### 2. Type Safety
- Define feature-specific types in `types/index.ts`
- Re-export shared types from `@/types` as needed
- Use strict TypeScript configuration

### 3. State Management
- Use Zustand for feature-local state
- Keep UI state in `@/store/ui.store.ts`
- Avoid prop drilling with stores/hooks

### 4. API Layer
- All API calls go through `@/lib/api` axios instance
- Feature APIs handle their own error handling
- Use consistent naming: `{entity}Api` or `{entity}Service`
