---
title: "Firebase to Supabase Migration với Drizzle ORM"
description: "Kế hoạch di chuyển toàn diện từ Firebase RTDB/Firestore sang Supabase PostgreSQL sử dụng Drizzle ORM"
status: done
priority: P1
effort: 12w
branch: master
tags: [migration, supabase, drizzle, postgresql, database]
created: 2026-01-10
completed: 2026-01-10
---

# Firebase to Supabase Migration Plan

## Executive Summary

Di chuyển hệ thống QuanLyBenXe từ Firebase (RTDB + Firestore) sang Supabase PostgreSQL sử dụng Drizzle ORM. Drizzle được chọn vì:

- **API tương tự** `firebase.from()` hiện tại
- **Lightweight** (~50KB), không bloat như Prisma
- **Migration tools** tích hợp sẵn (drizzle-kit)
- **Type-safe** 100% với TypeScript inference

**Scope**: 143 files server, ~187 Firebase integration points, 33.5 MB data

---

## Phase Overview

| Phase | Tên | Effort | Status | Progress |
|-------|-----|--------|--------|----------|
| 1 | [Supabase & Drizzle Setup](./phase-01-supabase-drizzle-setup.md) | 1.5w | ✅ done | 100% |
| 2 | [Data Migration ETL](./phase-02-data-migration-etl.md) | 2w | ✅ done | 100% |
| 3 | [Backend Drizzle Migration](./phase-03-backend-drizzle-migration.md) | 4w | ✅ done | 100% |
| 4 | [Storage & Cleanup](./phase-04-storage-and-cleanup.md) | 1.5w | ✅ done | 100% |
| 5 | [Testing & Validation](./phase-05-testing-validation.md) | 2w | ✅ done | 100% |
| 6 | [Deployment & Cutover](./phase-06-deployment-cutover.md) | 1w | ✅ done | 100% |

**Total: 12 weeks** - ✅ MIGRATION COMPLETE

---

## Key Metrics

| Metric | Current (Firebase) | Target (Supabase) |
|--------|-------------------|-------------------|
| Data size | 33.5 MB | < 500 MB (free tier) |
| Server files | 143 | ~120 (cleanup) |
| Integration points | 187 | Unified Drizzle |
| Google Sheets sync | 4 services | 0 (removed) |
| Transaction support | None | Full ACID |
| Query patterns | Client-side filter | Server-side SQL |

---

## Risk Summary

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Dual-write period, backup verification |
| API breaking changes | Medium | Parallel running, feature flags |
| Performance regression | Medium | Load testing, benchmarks |
| Rollback complexity | High | Keep Firebase read-only 2 weeks |

---

## Dependencies

- Supabase account (free tier to start)
- Drizzle ORM packages (`drizzle-orm`, `drizzle-kit`)
- PostgreSQL knowledge for schema design
- Staging environment for testing

---

## Decisions Made

1. **Migrate first, fix after** - PostgreSQL tự fix nhiều issues (transactions, proper queries)
2. **Remove Google Sheets sync** - 4 services to delete, data import via admin UI
3. **Keep denormalized fields** - Maintain for reporting performance
4. **UUID primary keys** - Map Firebase string IDs to PostgreSQL UUIDs

---

## Next Steps

1. Read [Phase 1: Supabase & Drizzle Setup](./phase-01-supabase-drizzle-setup.md)
2. Create Supabase project
3. Design normalized schema from current NoSQL structure
