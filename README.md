# QuanLyBenXe - Bus Station Management System

**A comprehensive bus station management platform for Vietnamese transportation operators.**

QuanLyBenXe (Bus Management) is a full-stack web application designed to streamline operations at bus stations, including dispatch management, fleet tracking, driver management, financial reporting, and route planning.

---

## Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Supabase account with PostgreSQL database enabled

### Installation

```bash
# Clone repository
git clone https://github.com/your-repo/quanlybenxe.git
cd Quanlybenxe

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Start development servers
npm run dev
```

The app runs on `http://localhost:5173` (client) and backend API on configured port.

---

## Project Structure

```
quanlybenxe/
├── client/                 # React 18 frontend (Vite)
│   └── src/
│       ├── features/       # Feature modules (auth, dispatch, fleet)
│       ├── pages/          # 47 lazy-loaded page components
│       ├── components/     # 117 shared UI components (ui/, dispatch/, fleet/, dashboard/, etc.)
│       ├── services/       # 20 API client services
│       ├── hooks/          # 8 custom React hooks
│       ├── store/          # Zustand global stores
│       ├── types/          # TypeScript definitions
│       └── lib/            # Utilities and helpers
│
├── server/                 # Express.js backend
│   └── src/
│       ├── modules/        # 11 feature modules (auth, billing, chat, common, dispatch, fleet, operator, report, route)
│       ├── controllers/    # 27 HTTP request handlers
│       ├── services/       # Business logic layer
│       ├── repositories/   # Data access layer
│       ├── middleware/     # Auth, error handling, validation
│       ├── config/         # Database and external service config
│       └── types/          # Shared TypeScript types
│
└── docs/                   # Technical documentation
```

---

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast builds and HMR
- **React Router v6** for navigation
- **Zustand** for state management
- **React Hook Form** for form handling
- **Tailwind CSS** + **shadcn/ui** for styling
- **Recharts** for data visualization
- **SheetJS** for Excel export

### Backend
- **Express.js** with TypeScript
- **Supabase PostgreSQL** for primary storage (Drizzle ORM)
- **Firebase Realtime Database** (legacy - being phased out)
- **JWT** for authentication
- **Cloudinary** for image storage

---

## Key Features

### 1. Dispatch Management (Điều Độ)
- Create and manage dispatch orders with multi-step workflow
- Vehicle and driver assignment with optimization
- Passenger manifest and real-time tracking
- Status workflow: entered → passengers_dropped → permit_issued → paid → departure_ordered → departed → exited
- Settlement calculation and payment processing
- Driver performance metrics

### 2. Fleet Management (Quản Lý Xe)
- Vehicle registry with maintenance history and operational status
- Driver profiles with qualifications and license management
- Operator (company) management and configuration
- Vehicle badges (Buýt, Tuyến cố định) with type definitions
- Real-time vehicle location tracking via GPS
- Badge vehicle support for specialized routes

### 3. Financial Reporting (Báo Cáo Tài Chính)
- 20+ specialized report pages with export capability
- Revenue, expense, and cash flow tracking
- Driver salary and commission calculations
- Trip metrics and mileage analytics
- Period-based financial summaries
- Excel export for analysis and external tools

### 4. Route & Location Management (Tuyến Đường)
- Route creation with stop management
- Pickup/drop-off location management
- Geographic mapping integration
- Schedule coordination and optimization

### 5. Shift Management (Ca Làm Việc)
- Shift scheduling and assignment
- Driver shift allocation and tracking
- Shift history and performance analytics
- Shift-based reporting

### 6. Chat Integration
- AI-powered chat widget with semantic understanding
- Intent classification and context awareness
- Semantic data queries across operational data
- Multi-turn conversation support
- Real-time response generation

---

## Architecture Overview

### Data Flow

```
Client Request
    ↓
Routes (URL routing)
    ↓
Controller (HTTP handling)
    ↓
Validation (Input validation)
    ↓
Service (Business logic)
    ↓
Repository (Database layer)
    ↓
Supabase PostgreSQL (Primary)
Firebase (Legacy - being phased out)
```

### State Management

**Frontend:**
- **Zustand stores** for feature-local state
- **React Query** patterns for async data
- **Context API** for UI-wide settings

**Backend:**
- Service layer handles complex workflows
- Repository pattern for data access
- Drizzle ORM for type-safe database queries
- Firebase legacy support (being phased out)

---

## Development Workflow

### Running Locally

```bash
# Terminal 1: Start client (Vite dev server)
cd client && npm run dev

# Terminal 2: Start backend (Node.js)
cd server && npm run dev

# Terminal 3: Run tests (optional)
npm run test
```

### Code Organization

- **Features** are organized by business domain (auth, dispatch, fleet)
- **Components** follow feature-based structure
- **Services** handle API calls and business logic
- **Types** are TypeScript-first with strict checking

### Making Changes

1. Create a feature branch: `git checkout -b feature/feature-name`
2. Make changes following code standards in `docs/code-standards.md`
3. Run tests: `npm run test`
4. Commit with conventional messages: `feat: add new feature`
5. Push and create pull request

---

## Documentation

- **[Code Standards](./docs/code-standards.md)** - Coding conventions and patterns
- **[Codebase Summary](./docs/codebase-summary.md)** - Complete codebase structure
- **[System Architecture](./docs/system-architecture.md)** - Architecture decisions
- **[Project Roadmap](./docs/project-roadmap.md)** - Current status and roadmap
- **[Troubleshooting](./docs/troubleshoot_tips.md)** - Common issues and solutions

---

## Deployment

### Backend
- Deployed to Render.com
- Environment: Node.js with Express.js
- Database: Supabase PostgreSQL (primary), Firebase (legacy)

### Frontend
- Deployed to Vercel or similar
- Automatic builds on main branch push
- Environment variables configured in deployment platform

See `DEPLOYMENT_CONFIG.md` for detailed setup.

---

## Contributing

1. Read `docs/code-standards.md` for conventions
2. Check `docs/project-roadmap.md` for active features
3. Follow commit message format: `feat|fix|docs|refactor: description`
4. Ensure all tests pass before pushing
5. Create detailed pull requests with context

---

## Performance Metrics

### Frontend Bundle
- **React vendor**: ~163KB
- **UI components (Radix)**: ~68KB
- **Utilities**: ~89KB
- **Icons**: ~38KB
- **Charts**: ~382KB
- **Excel export**: ~283KB

### Code Quality
- TypeScript strict mode enabled
- No `any` types policy (496 found - needs cleanup)
- Controller max: 300 lines (current max: 263)
- Service/Helper functions: <50 lines average

---

**Last Updated:** 2026-01-11
**Maintainers:** Development Team
**Status:** Phase 4 Complete - Firebase to Supabase Migration Complete - Phase 5 Delayed 10 Days
