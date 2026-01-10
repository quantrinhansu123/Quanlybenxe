---
title: "Phase 6: Deployment & Cutover"
status: done
priority: P1
effort: 1w
phase: 6
last_updated: 2026-01-10
---

# Phase 6: Deployment & Cutover

> **Previous**: [Phase 5: Testing & Validation](./phase-05-testing-validation.md) | **Start**: [Main Plan](./plan.md)

## Overview

- **Date**: 2026-01-10
- **Priority**: P1 (Critical)
- **Effort**: 1 week
- **Status**: ✅ Completed (Tooling Ready)
- **Prerequisite**: Phase 5 completed (All tests passing)

---

## Key Insights

1. **Zero Downtime Goal** - Sử dụng parallel running strategy
2. **Gradual Rollout** - 10% → 50% → 100% traffic
3. **Rollback Ready** - Firebase read-only 2 weeks sau cutover
4. **Monitoring** - Track errors, latency, data consistency

---

## Deployment Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                   Deployment Timeline                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Day 1-2: Staging Deployment & Smoke Tests                  │
│     ↓                                                        │
│  Day 3: Production Deploy (10% traffic)                     │
│     ↓                                                        │
│  Day 4: Monitor & Fix Issues                                │
│     ↓                                                        │
│  Day 5: Scale to 50% traffic                                │
│     ↓                                                        │
│  Day 6: Monitor & Validate                                  │
│     ↓                                                        │
│  Day 7: Full Cutover (100% traffic)                         │
│     ↓                                                        │
│  +2 weeks: Firebase Read-Only (Rollback Window)             │
│     ↓                                                        │
│  +4 weeks: Firebase Decommission                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Requirements

### Functional
- [ ] Staging environment deployment
- [ ] Production deployment với feature flags
- [ ] Traffic splitting (10% → 50% → 100%)
- [ ] Rollback procedures
- [ ] Monitoring & alerting

### Non-Functional
- [ ] Zero downtime during cutover
- [ ] < 5 minute rollback capability
- [ ] 99.9% uptime during transition
- [ ] Data sync validation

---

## Implementation Steps

### Day 1-2: Staging Deployment

#### Step 1: Deploy to Staging (Day 1)

```bash
# 1. Create staging branch
git checkout -b release/supabase-migration
git push origin release/supabase-migration

# 2. Update staging environment variables
# In Render.com / Vercel / etc:
# DATABASE_URL=postgresql://...staging...
# SUPABASE_URL=https://staging-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=...

# 3. Deploy backend
cd server
npm run build
# Deploy to staging environment

# 4. Deploy frontend (no changes needed)
# Client already uses REST API to backend
```

#### Step 2: Staging Smoke Tests (Day 1-2)

```typescript
// Smoke test checklist script
// server/src/scripts/smoke-test.ts

const ENDPOINTS = [
  { method: 'GET', path: '/api/dispatch', expectStatus: 200 },
  { method: 'GET', path: '/api/vehicles', expectStatus: 200 },
  { method: 'GET', path: '/api/drivers', expectStatus: 200 },
  { method: 'GET', path: '/api/operators', expectStatus: 200 },
  { method: 'GET', path: '/api/routes', expectStatus: 200 },
  { method: 'POST', path: '/api/auth/login', expectStatus: 200, body: { username: 'test', password: 'test' } },
]

async function runSmokeTests(baseUrl: string) {
  console.log(`Running smoke tests against ${baseUrl}\n`)

  let passed = 0
  let failed = 0

  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
      })

      if (response.status === endpoint.expectStatus) {
        console.log(`✓ ${endpoint.method} ${endpoint.path}`)
        passed++
      } else {
        console.log(`✗ ${endpoint.method} ${endpoint.path} - Expected ${endpoint.expectStatus}, got ${response.status}`)
        failed++
      }
    } catch (error) {
      console.log(`✗ ${endpoint.method} ${endpoint.path} - Error: ${error}`)
      failed++
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  return failed === 0
}

runSmokeTests(process.env.STAGING_URL || 'http://localhost:3000')
```

### Day 3: Production Deploy (10%)

#### Step 3: Feature Flag Setup (Day 3)

```typescript
// server/src/config/feature-flags.ts
export const featureFlags = {
  // Percentage of traffic to route to Supabase
  supabaseTrafficPercent: parseInt(process.env.SUPABASE_TRAFFIC_PERCENT || '10'),

  // Force specific users to Supabase (for testing)
  supabaseTestUsers: (process.env.SUPABASE_TEST_USERS || '').split(','),

  // Kill switch - immediately route all to Firebase
  emergencyFirebaseMode: process.env.EMERGENCY_FIREBASE_MODE === 'true',
}

export function shouldUseSupabase(userId?: string): boolean {
  // Kill switch
  if (featureFlags.emergencyFirebaseMode) {
    return false
  }

  // Test users always use Supabase
  if (userId && featureFlags.supabaseTestUsers.includes(userId)) {
    return true
  }

  // Random traffic split
  return Math.random() * 100 < featureFlags.supabaseTrafficPercent
}
```

```typescript
// Note: For this migration, since we're replacing the data layer entirely,
// traffic splitting is NOT recommended. Instead:
// 1. Deploy with dual-write if needed
// 2. Or do full cutover with quick rollback capability
```

#### Step 4: Production Deployment (Day 3)

```bash
# 1. Final backup of Firebase
npm run etl:export

# 2. Verify Supabase data is current
npm run etl:validate

# 3. Deploy to production
git checkout main
git merge release/supabase-migration
git push origin main

# 4. Update production environment variables
# DATABASE_URL=postgresql://...production...
# SUPABASE_URL=https://production-project.supabase.co
# etc.

# 5. Deploy (Render.com auto-deploys from main)
# Or manual: npm run build && <deploy command>
```

### Day 4: Monitor & Fix

#### Step 5: Monitoring Setup (Day 4)

```typescript
// server/src/middleware/monitoring.ts
import { Request, Response, NextFunction } from 'express'

interface RequestMetrics {
  path: string
  method: string
  statusCode: number
  duration: number
  timestamp: Date
  error?: string
}

const metricsBuffer: RequestMetrics[] = []

export function monitoringMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - startTime

    const metrics: RequestMetrics = {
      path: req.path,
      method: req.method,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date(),
    }

    // Log slow requests
    if (duration > 1000) {
      console.warn(`SLOW REQUEST: ${req.method} ${req.path} took ${duration}ms`)
    }

    // Log errors
    if (res.statusCode >= 500) {
      console.error(`ERROR: ${req.method} ${req.path} returned ${res.statusCode}`)
      metrics.error = 'Server error'
    }

    metricsBuffer.push(metrics)

    // Flush to monitoring service (e.g., Supabase logs, Sentry, etc.)
    if (metricsBuffer.length >= 100) {
      flushMetrics()
    }
  })

  next()
}

async function flushMetrics() {
  const metrics = [...metricsBuffer]
  metricsBuffer.length = 0

  // Log to console for now
  const errorCount = metrics.filter(m => m.statusCode >= 500).length
  const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length

  console.log(`Metrics: ${metrics.length} requests, ${errorCount} errors, avg ${avgDuration.toFixed(0)}ms`)

  // TODO: Send to monitoring service
  // await supabase.from('api_metrics').insert(metrics)
}
```

```typescript
// server/src/app.ts - Add monitoring
import { monitoringMiddleware } from './middleware/monitoring'

app.use(monitoringMiddleware)
```

#### Step 6: Error Tracking (Day 4)

```typescript
// server/src/middleware/error-tracking.ts
import { Request, Response, NextFunction } from 'express'

export function errorTrackingMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error details
  console.error({
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
  })

  // Send to Sentry/LogRocket if configured
  // Sentry.captureException(error)

  // Track in database for analysis
  // await db.insert(errorLogs).values({ ... })

  next(error)
}
```

### Day 5-6: Scale to 50% then 100%

#### Step 7: Gradual Rollout (Day 5-6)

```bash
# Day 5 Morning: Scale to 50%
# Update environment variable:
# SUPABASE_TRAFFIC_PERCENT=50

# Monitor for 4-6 hours

# Day 5 Afternoon: If stable, scale to 75%
# SUPABASE_TRAFFIC_PERCENT=75

# Day 6 Morning: Full cutover
# SUPABASE_TRAFFIC_PERCENT=100
```

Note: Since this is a full migration (not A/B testing), the more practical approach:

```bash
# Day 3: Deploy and monitor
# Day 4: Fix any issues found
# Day 5: Confidence builds, continue monitoring
# Day 6: Declare migration stable
# Day 7: Update documentation, cleanup
```

### Day 7: Full Cutover & Documentation

#### Step 8: Final Cutover Checklist (Day 7)

```markdown
## Cutover Checklist

### Pre-Cutover (T-2 hours)
- [ ] Final Firebase backup complete
- [ ] Supabase data validated
- [ ] All tests passing on production
- [ ] Rollback procedure documented
- [ ] Team on standby

### Cutover (T-0)
- [ ] Traffic routed to Supabase (100%)
- [ ] Firebase set to read-only
- [ ] Monitoring dashboards open
- [ ] Alerting configured

### Post-Cutover (T+1 hour)
- [ ] Error rates normal (< 0.1%)
- [ ] Response times normal (< 200ms avg)
- [ ] User reports checked
- [ ] Data consistency verified

### Post-Cutover (T+24 hours)
- [ ] Full day of operation reviewed
- [ ] Performance metrics analyzed
- [ ] Any issues documented
- [ ] Rollback decision: Keep or Revert
```

#### Step 9: Firebase Read-Only Mode (Day 7+)

```typescript
// Keep Firebase read-only for 2 weeks as rollback option
// server/src/config/database.ts

// Option 1: Remove write operations
// Option 2: Keep connection but don't use
// Option 3: Set Firebase rules to read-only

// Firebase rules (firebase.json or console):
{
  "rules": {
    ".read": true,
    ".write": false  // Disable writes
  }
}
```

#### Step 10: Documentation Updates (Day 7)

```markdown
## Files to Update

1. **README.md**
   - Remove Firebase prerequisites
   - Add Supabase setup instructions
   - Update environment variables

2. **DEPLOYMENT_CONFIG.md**
   - Update deployment instructions
   - Add Supabase configuration

3. **docs/system-architecture.md**
   - Update database architecture section
   - Change Firebase references to Supabase

4. **.env.example**
   - Remove Firebase variables
   - Add Supabase variables
```

---

## Rollback Procedures

### Immediate Rollback (< 5 minutes)

```bash
# 1. Switch environment variable
# DATABASE_URL=<firebase-connection> # NOT APPLICABLE - Firebase is NoSQL
# Instead:

# 2. Deploy previous version
git checkout HEAD~1
git push -f origin main  # Force push previous version

# 3. Or use feature flag
EMERGENCY_FIREBASE_MODE=true
# Restart server
```

### Data Rollback (if data corrupted)

```bash
# 1. Stop all traffic
# 2. Export current Supabase data (for analysis)
npm run backup:supabase

# 3. Import last known good Firebase backup
npm run etl:rollback

# 4. Restart with Firebase code
git checkout pre-migration-tag
git push origin main
```

### Rollback Decision Tree

```
Error Rate > 1%?
  ├── YES → Investigate
  │         ├── Can fix in < 1 hour? → Fix and monitor
  │         └── Cannot fix quickly → ROLLBACK
  └── NO → Continue monitoring

Response Time > 2x normal?
  ├── YES → Check database load
  │         ├── Query optimization needed? → Apply indexes
  │         └── Supabase issue? → Contact support or ROLLBACK
  └── NO → Continue monitoring

Data Inconsistency Found?
  ├── YES → Stop writes immediately
  │         ├── Can identify root cause? → Fix and re-sync
  │         └── Unknown cause → ROLLBACK
  └── NO → Continue monitoring
```

---

## Post-Migration Cleanup

### Week 2-4: Cleanup Phase

```bash
# Remove Firebase dependencies
npm uninstall firebase-admin firebase-functions

# Delete Firebase config files
rm server/src/config/database.ts  # Old Firebase config
rm server/src/lib/firebase-rest.js

# Remove Firebase service account
rm firebase-service-account.json  # IMPORTANT: Secure delete

# Update CI/CD
# Remove Firebase deploy steps
# Add Supabase migration steps

# Archive Firebase project (don't delete yet)
# Firebase Console → Project Settings → Archive
```

### Week 4: Final Decommission

```markdown
## Firebase Decommission Checklist

- [ ] All users migrated and no issues for 2+ weeks
- [ ] Firebase billing reviewed (should be minimal)
- [ ] Firebase data archived to cold storage
- [ ] Firebase project archived or deleted
- [ ] Documentation fully updated
- [ ] Team training on Supabase complete
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Error Rate | < 0.1% | 0.1-1% | > 1% |
| Avg Response Time | < 200ms | 200-500ms | > 500ms |
| P95 Response Time | < 500ms | 500ms-1s | > 1s |
| Database Connections | < 80% | 80-90% | > 90% |
| Failed Queries | 0 | 1-5/min | > 5/min |

### Alert Configuration

```typescript
// Example: Supabase Edge Functions for alerting
// Or use external service (PagerDuty, OpsGenie, etc.)

interface Alert {
  level: 'warning' | 'critical'
  message: string
  timestamp: Date
}

async function sendAlert(alert: Alert) {
  // Slack webhook
  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    body: JSON.stringify({
      text: `[${alert.level.toUpperCase()}] ${alert.message}`,
    }),
  })

  // Email (optional)
  // await sendEmail(...)
}
```

---

## Todo Checklist

### Day 1-2
- [ ] Deploy to staging environment
- [ ] Run smoke tests
- [ ] Verify all endpoints working
- [ ] Test critical workflows (dispatch cycle)
- [ ] Performance baseline on staging

### Day 3
- [ ] Final production backup
- [ ] Data sync verification
- [ ] Deploy to production
- [ ] Smoke tests on production
- [ ] Team standby for monitoring

### Day 4
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Fix any issues found
- [ ] User feedback collection

### Day 5-6
- [ ] Continued monitoring
- [ ] Performance optimization if needed
- [ ] Stability confirmation

### Day 7
- [ ] Declare migration stable
- [ ] Update documentation
- [ ] Firebase read-only mode
- [ ] Team celebration!

### Post-Cutover
- [ ] 2-week monitoring period
- [ ] Firebase cleanup
- [ ] Final documentation
- [ ] Project retrospective

---

## Success Criteria

1. **Zero downtime** during cutover
2. **No data loss** or corruption
3. **Error rate < 0.1%** after cutover
4. **Response times** same or better than Firebase
5. **All critical workflows** functioning
6. **Rollback not needed** after 2 weeks

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Extended downtime | Low | Critical | Quick rollback procedure |
| Data corruption | Very Low | Critical | Backups, validation |
| Performance issues | Medium | High | Monitoring, scaling |
| User complaints | Medium | Medium | Communication, support |

---

## Communication Plan

### Before Migration
- [ ] Email to stakeholders (1 week before)
- [ ] In-app notification (3 days before)
- [ ] Team briefing (1 day before)

### During Migration
- [ ] Status updates every 2 hours
- [ ] Incident communication if issues

### After Migration
- [ ] Success announcement
- [ ] Documentation of any issues
- [ ] Retrospective meeting

---

## Congratulations!

After completing Phase 6, the Firebase to Supabase migration is complete!

**Summary:**
- Database: Firebase RTDB/Firestore → Supabase PostgreSQL
- ORM: Custom query builder → Drizzle ORM
- Storage: Firebase Storage → Supabase Storage
- Removed: Google Sheets sync (4 services)
- Fixed: N+1 queries, missing validation, bypass patterns

**Benefits Achieved:**
- Full ACID transaction support
- Proper SQL queries with JOINs
- Type-safe queries with Drizzle
- Better performance for reports
- Simplified architecture
- Reduced dependencies
