# QuanLyBenXe - Bus Station Management System

**A comprehensive bus station management platform for Vietnamese transportation operators.**

QuanLyBenXe (Bus Management) is a full-stack web application designed to streamline operations at bus stations, including dispatch management, fleet tracking, driver management, financial reporting, and route planning.

---

## Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Firebase account with Realtime Database and Firestore enabled

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
│       ├── pages/          # 27 lazy-loaded page components
│       ├── components/     # 50+ shared UI components
│       ├── services/       # API client services
│       ├── store/          # Zustand global stores
│       ├── types/          # TypeScript definitions
│       └── lib/            # Utilities and helpers
│
├── server/                 # Express.js backend
│   └── src/
│       ├── modules/        # Feature modules (dispatch, fleet, operator)
│       ├── controllers/    # 23 HTTP request handlers
│       ├── services/       # Business logic layer
│       ├── middleware/     # Auth, error handling, upload
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
- **Firebase Realtime Database** for primary storage
- **Firestore** for secondary queries
- **JWT** for authentication
- **Cloudinary** for image storage

---

## Key Features

### 1. Dispatch Management (Điều Độ)
- Create and manage dispatch orders
- Vehicle assignment and optimization
- Driver and passenger tracking
- Status workflow: entered → passengers_dropped → permit_issued → paid → departed
- Settlement and payment processing

### 2. Fleet Management (Quản Lý Xe)
- Vehicle registry with maintenance history
- Driver profiles and qualifications
- Operator (company) management
- Vehicle badges (badge types, routes)
- Real-time vehicle location tracking

### 3. Financial Reporting (Báo Cáo Tài Chính)
- 20+ specialized report pages
- Revenue and expense tracking
- Driver salary calculations
- Trip and mileage analytics
- Excel export for further analysis

### 4. Route & Location Management (Tuyến Đường)
- Route creation and modification
- Pickup/drop-off location management
- Geographic mapping
- Schedule coordination

### 5. Shift Management (Ca Làm Việc)
- Shift scheduling
- Driver shift assignment
- Shift history and analytics

### 6. Chat Integration
- AI-powered chat widget
- Intent classification (what user is asking)
- Semantic data queries
- Context-aware responses

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
Firebase (RTDB + Firestore)
```

### State Management

**Frontend:**
- **Zustand stores** for feature-local state
- **React Query** patterns for async data
- **Context API** for UI-wide settings

**Backend:**
- Service layer handles complex workflows
- Repository pattern for data access
- Firebase dual-write (RTDB ↔ Firestore sync)

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
- Database: Firebase (cloud-managed)

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
- No `any` types allowed
- Controller max: 200 lines
- Service/Helper functions: <50 lines average

---

## Support & Issues

For bug reports or feature requests, please create an issue on GitHub with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)

---

## License

Proprietary - Freelance Project

---

**Last Updated:** 2025-12-21
**Maintainers:** Development Team
**Status:** Active Development
