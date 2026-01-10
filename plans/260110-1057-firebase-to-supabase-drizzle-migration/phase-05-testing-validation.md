---
title: "Phase 5: Testing & Validation"
status: done
priority: P1
effort: 2w
phase: 5
last_updated: 2026-01-10
---

# Phase 5: Testing & Validation

> **Previous**: [Phase 4: Storage & Cleanup](./phase-04-storage-and-cleanup.md) | **Next**: [Phase 6: Deployment](./phase-06-deployment-cutover.md)

## Overview

- **Date**: 2026-01-10
- **Priority**: P1 (Critical)
- **Effort**: 2 weeks
- **Status**: ✅ Completed
- **Prerequisite**: Phase 4 completed (Storage migrated, cleanup done)

---

## Key Insights từ Analysis

1. **Existing Tests**: Jest configured, some unit tests exist
2. **Test Scripts**: `npm run test`, `npm run test:coverage`
3. **Current Coverage**: Limited - mainly dispatch validation tests
4. **API Endpoints**: ~50+ endpoints need integration testing

---

## Requirements

### Functional
- [ ] Unit tests for Drizzle repository layer
- [ ] Integration tests for API endpoints
- [ ] Data consistency validation
- [ ] End-to-end workflow tests

### Non-Functional
- [ ] 80%+ code coverage for critical paths
- [ ] Load testing with realistic data
- [ ] Performance benchmarks
- [ ] Response time targets

---

## Test Categories

```
┌─────────────────────────────────────────────────────────────┐
│                    Testing Pyramid                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    ┌───────────┐                            │
│                    │   E2E     │  (Few - Slow)              │
│                    │  Tests    │  Dispatch workflow         │
│                    └─────┬─────┘                            │
│                          │                                   │
│               ┌──────────┴──────────┐                       │
│               │   Integration       │  (Medium)             │
│               │   Tests             │  API endpoints        │
│               └──────────┬──────────┘                       │
│                          │                                   │
│         ┌────────────────┴────────────────┐                 │
│         │         Unit Tests              │  (Many - Fast)  │
│         │  Repositories, Services, Utils  │                 │
│         └─────────────────────────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Week 1: Unit & Integration Tests

#### Step 1: Setup Test Database (Day 1)

```typescript
// server/src/__tests__/setup/test-db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../db/schema'

// Use separate test database
const testConnectionString = process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/quanlybenxe_test'

const testClient = postgres(testConnectionString)
export const testDb = drizzle(testClient, { schema })

// Setup/teardown helpers
export async function setupTestDb() {
  // Run migrations on test DB
  // or use drizzle-kit push for test env
}

export async function teardownTestDb() {
  // Clean up test data
  const tables = [
    'invoices',
    'dispatch_records',
    'vehicle_badges',
    'vehicles',
    'drivers',
    'routes',
    'operators',
    'users',
  ]

  for (const table of tables) {
    await testDb.execute(sql.raw(`TRUNCATE TABLE ${table} CASCADE`))
  }
}

export async function seedTestData() {
  // Insert minimal test data
  await testDb.insert(schema.operators).values({
    id: 'test-operator-1',
    code: 'TEST01',
    name: 'Test Operator',
  })

  await testDb.insert(schema.vehicles).values({
    id: 'test-vehicle-1',
    plateNumber: 'TEST-001',
    operatorId: 'test-operator-1',
    seatCount: 45,
  })

  await testDb.insert(schema.drivers).values({
    id: 'test-driver-1',
    fullName: 'Test Driver',
    operatorId: 'test-operator-1',
  })
}
```

```typescript
// server/jest.setup.ts
import { setupTestDb, teardownTestDb, seedTestData } from './src/__tests__/setup/test-db'

beforeAll(async () => {
  await setupTestDb()
})

beforeEach(async () => {
  await teardownTestDb()
  await seedTestData()
})

afterAll(async () => {
  await teardownTestDb()
})
```

#### Step 2: Repository Unit Tests (Day 2-3)

```typescript
// server/src/__tests__/repositories/dispatch.repository.test.ts
import { testDb } from '../setup/test-db'
import { dispatchRepository } from '../../modules/dispatch/dispatch.repository'
import { dispatchRecords } from '../../db/schema'

describe('DispatchRepository', () => {
  describe('create', () => {
    it('should create a new dispatch record', async () => {
      const input = {
        vehicleId: 'test-vehicle-1',
        driverId: 'test-driver-1',
        currentStatus: 'entered',
        entryTime: new Date(),
      }

      const result = await dispatchRepository.create(input)

      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(result.vehicleId).toBe(input.vehicleId)
      expect(result.currentStatus).toBe('entered')
    })

    it('should auto-generate timestamps', async () => {
      const result = await dispatchRepository.create({
        vehicleId: 'test-vehicle-1',
        currentStatus: 'entered',
        entryTime: new Date(),
      })

      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
    })
  })

  describe('findById', () => {
    it('should return null for non-existent ID', async () => {
      const result = await dispatchRepository.findById('non-existent-id')
      expect(result).toBeNull()
    })

    it('should return record for valid ID', async () => {
      // Create first
      const created = await dispatchRepository.create({
        vehicleId: 'test-vehicle-1',
        currentStatus: 'entered',
        entryTime: new Date(),
      })

      const result = await dispatchRepository.findById(created.id)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(created.id)
    })
  })

  describe('findAll with filters', () => {
    beforeEach(async () => {
      // Create test data
      await dispatchRepository.create({
        vehicleId: 'test-vehicle-1',
        currentStatus: 'entered',
        entryTime: new Date('2026-01-01'),
      })
      await dispatchRepository.create({
        vehicleId: 'test-vehicle-1',
        currentStatus: 'departed',
        entryTime: new Date('2026-01-02'),
      })
    })

    it('should filter by status', async () => {
      const result = await dispatchRepository.findAll({ status: 'entered' })
      expect(result.length).toBe(1)
      expect(result[0].currentStatus).toBe('entered')
    })

    it('should filter by date range', async () => {
      const result = await dispatchRepository.findAll({
        startDate: '2026-01-01',
        endDate: '2026-01-01',
      })
      expect(result.length).toBe(1)
    })
  })

  describe('update', () => {
    it('should update record and timestamp', async () => {
      const created = await dispatchRepository.create({
        vehicleId: 'test-vehicle-1',
        currentStatus: 'entered',
        entryTime: new Date(),
      })

      const originalUpdatedAt = created.updatedAt

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100))

      const updated = await dispatchRepository.update(created.id, {
        currentStatus: 'passengers_dropped',
      })

      expect(updated?.currentStatus).toBe('passengers_dropped')
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })
  })

  describe('delete', () => {
    it('should delete record', async () => {
      const created = await dispatchRepository.create({
        vehicleId: 'test-vehicle-1',
        currentStatus: 'entered',
        entryTime: new Date(),
      })

      await dispatchRepository.delete(created.id)

      const result = await dispatchRepository.findById(created.id)
      expect(result).toBeNull()
    })
  })
})
```

#### Step 3: Controller Integration Tests (Day 4-6)

```typescript
// server/src/__tests__/controllers/dispatch.controller.test.ts
import request from 'supertest'
import { app } from '../../app'
import { testDb, seedTestData, teardownTestDb } from '../setup/test-db'
import { generateTestToken } from '../utils/auth-helper'

describe('Dispatch Controller', () => {
  let authToken: string

  beforeAll(async () => {
    authToken = await generateTestToken({ id: 'test-user', role: 'admin' })
  })

  beforeEach(async () => {
    await teardownTestDb()
    await seedTestData()
  })

  describe('POST /api/dispatch', () => {
    it('should create dispatch record with valid data', async () => {
      const response = await request(app)
        .post('/api/dispatch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vehicleId: 'test-vehicle-1',
          driverId: 'test-driver-1',
          entryTime: new Date().toISOString(),
        })

      expect(response.status).toBe(201)
      expect(response.body.id).toBeDefined()
      expect(response.body.currentStatus).toBe('entered')
    })

    it('should return 400 for missing vehicleId', async () => {
      const response = await request(app)
        .post('/api/dispatch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          driverId: 'test-driver-1',
        })

      expect(response.status).toBe(400)
    })

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/dispatch')
        .send({
          vehicleId: 'test-vehicle-1',
        })

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/dispatch', () => {
    beforeEach(async () => {
      // Create test dispatches
      await request(app)
        .post('/api/dispatch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vehicleId: 'test-vehicle-1',
          entryTime: new Date().toISOString(),
        })
    })

    it('should return dispatch records', async () => {
      const response = await request(app)
        .get('/api/dispatch')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
    })

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/dispatch?status=entered')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.every((r: any) => r.currentStatus === 'entered')).toBe(true)
    })
  })

  describe('POST /api/dispatch/:id/passenger-drop', () => {
    let dispatchId: string

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/dispatch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vehicleId: 'test-vehicle-1',
          entryTime: new Date().toISOString(),
        })

      dispatchId = createResponse.body.id
    })

    it('should record passenger drop', async () => {
      const response = await request(app)
        .post(`/api/dispatch/${dispatchId}/passenger-drop`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          passengersArrived: 30,
        })

      expect(response.status).toBe(200)
      expect(response.body.dispatch.currentStatus).toBe('passengers_dropped')
    })
  })

  // Test full workflow
  describe('Dispatch Workflow (E2E)', () => {
    it('should complete full dispatch cycle', async () => {
      // 1. Create (Entry)
      const createRes = await request(app)
        .post('/api/dispatch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vehicleId: 'test-vehicle-1',
          driverId: 'test-driver-1',
          entryTime: new Date().toISOString(),
        })

      expect(createRes.status).toBe(201)
      const dispatchId = createRes.body.id

      // 2. Passenger Drop
      const dropRes = await request(app)
        .post(`/api/dispatch/${dispatchId}/passenger-drop`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ passengersArrived: 25 })

      expect(dropRes.body.dispatch.currentStatus).toBe('passengers_dropped')

      // 3. Issue Permit
      const permitRes = await request(app)
        .post(`/api/dispatch/${dispatchId}/permit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          permitStatus: 'approved',
          seatCount: 45,
        })

      expect(permitRes.body.dispatch.currentStatus).toBe('permit_issued')

      // 4. Payment
      const paymentRes = await request(app)
        .post(`/api/dispatch/${dispatchId}/payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentAmount: 50000,
          paymentMethod: 'cash',
        })

      expect(paymentRes.body.dispatch.currentStatus).toBe('paid')

      // 5. Exit
      const exitRes = await request(app)
        .post(`/api/dispatch/${dispatchId}/exit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})

      expect(exitRes.body.dispatch.currentStatus).toBe('departed')
    })
  })
})
```

#### Step 4: Report Query Tests (Day 7)

```typescript
// server/src/__tests__/repositories/report.repository.test.ts
import { reportRepository } from '../../modules/report/report.repository'
import { seedTestData, teardownTestDb } from '../setup/test-db'
import { dispatchRepository } from '../../modules/dispatch/dispatch.repository'

describe('ReportRepository', () => {
  beforeEach(async () => {
    await teardownTestDb()
    await seedTestData()

    // Create test dispatch records
    await dispatchRepository.create({
      vehicleId: 'test-vehicle-1',
      currentStatus: 'departed',
      entryTime: new Date('2026-01-15T10:00:00Z'),
      paymentAmount: 50000,
    })

    await dispatchRepository.create({
      vehicleId: 'test-vehicle-1',
      currentStatus: 'departed',
      entryTime: new Date('2026-01-15T14:00:00Z'),
      paymentAmount: 60000,
    })
  })

  describe('getVehicleLogs', () => {
    it('should return logs with joined data', async () => {
      const result = await reportRepository.getVehicleLogs({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      })

      expect(result.length).toBe(2)
      expect(result[0].vehiclePlateNumber).toBeDefined()
    })
  })

  describe('getRevenueSummary', () => {
    it('should aggregate revenue by date', async () => {
      const result = await reportRepository.getRevenueSummary(
        '2026-01-01',
        '2026-01-31'
      )

      expect(result.length).toBeGreaterThan(0)

      const jan15 = result.find(r => r.date === '2026-01-15')
      expect(jan15?.totalRevenue).toBe(110000) // 50000 + 60000
      expect(jan15?.transactionCount).toBe(2)
    })
  })
})
```

### Week 2: Load Testing & Validation

#### Step 5: Data Consistency Validation (Day 1-2)

```typescript
// server/src/scripts/validate-data-consistency.ts
import { db } from '../db/drizzle'
import { dispatchRecords, vehicles, drivers, operators } from '../db/schema'
import { eq, isNull, and, sql } from 'drizzle-orm'

async function validateDataConsistency() {
  console.log('Running data consistency checks...\n')

  const checks: { name: string; passed: boolean; details?: string }[] = []

  // Check 1: Orphan vehicle references
  const orphanVehicleRefs = await db
    .select({ count: sql<number>`count(*)` })
    .from(dispatchRecords)
    .leftJoin(vehicles, eq(dispatchRecords.vehicleId, vehicles.id))
    .where(and(
      isNull(vehicles.id),
      sql`${dispatchRecords.vehicleId} IS NOT NULL`
    ))

  checks.push({
    name: 'No orphan vehicle references',
    passed: Number(orphanVehicleRefs[0]?.count || 0) === 0,
    details: `Found ${orphanVehicleRefs[0]?.count || 0} orphan references`,
  })

  // Check 2: Orphan driver references
  const orphanDriverRefs = await db
    .select({ count: sql<number>`count(*)` })
    .from(dispatchRecords)
    .leftJoin(drivers, eq(dispatchRecords.driverId, drivers.id))
    .where(and(
      isNull(drivers.id),
      sql`${dispatchRecords.driverId} IS NOT NULL`
    ))

  checks.push({
    name: 'No orphan driver references',
    passed: Number(orphanDriverRefs[0]?.count || 0) === 0,
    details: `Found ${orphanDriverRefs[0]?.count || 0} orphan references`,
  })

  // Check 3: Denormalized data matches source
  const mismatchedNames = await db.execute(sql`
    SELECT dr.id, dr.operator_name, o.name as actual_name
    FROM dispatch_records dr
    LEFT JOIN operators o ON dr.operator_id = o.id
    WHERE dr.operator_name != o.name
    LIMIT 10
  `)

  checks.push({
    name: 'Denormalized operator names match',
    passed: mismatchedNames.rows.length === 0,
    details: `Found ${mismatchedNames.rows.length} mismatches`,
  })

  // Check 4: Valid status values
  const invalidStatuses = await db.execute(sql`
    SELECT current_status, COUNT(*) as count
    FROM dispatch_records
    WHERE current_status NOT IN (
      'entered', 'passengers_dropped', 'permit_issued', 'permit_rejected',
      'paid', 'departure_ordered', 'departed', 'cancelled'
    )
    GROUP BY current_status
  `)

  checks.push({
    name: 'All status values are valid',
    passed: invalidStatuses.rows.length === 0,
    details: invalidStatuses.rows.length > 0
      ? `Invalid statuses: ${JSON.stringify(invalidStatuses.rows)}`
      : undefined,
  })

  // Print results
  console.log('Results:')
  console.log('--------')

  let allPassed = true
  for (const check of checks) {
    const status = check.passed ? '✓' : '✗'
    console.log(`${status} ${check.name}`)
    if (check.details) {
      console.log(`  ${check.details}`)
    }
    if (!check.passed) allPassed = false
  }

  console.log('\n' + (allPassed ? 'All checks passed!' : 'Some checks failed!'))
  process.exit(allPassed ? 0 : 1)
}

validateDataConsistency()
```

#### Step 6: Load Testing (Day 3-5)

```typescript
// server/src/__tests__/load/dispatch-load.test.ts
import request from 'supertest'
import { app } from '../../app'
import { generateTestToken } from '../utils/auth-helper'

describe('Load Tests', () => {
  let authToken: string

  beforeAll(async () => {
    authToken = await generateTestToken({ id: 'load-test-user', role: 'admin' })
  })

  describe('GET /api/dispatch (high volume)', () => {
    it('should handle 100 concurrent requests', async () => {
      const concurrency = 100
      const startTime = Date.now()

      const requests = Array(concurrency).fill(null).map(() =>
        request(app)
          .get('/api/dispatch')
          .set('Authorization', `Bearer ${authToken}`)
      )

      const responses = await Promise.all(requests)

      const endTime = Date.now()
      const duration = endTime - startTime

      // All should succeed
      const successCount = responses.filter(r => r.status === 200).length
      expect(successCount).toBe(concurrency)

      // Should complete within reasonable time
      console.log(`100 concurrent requests completed in ${duration}ms`)
      expect(duration).toBeLessThan(10000) // 10 seconds max
    })
  })

  describe('POST /api/dispatch (sequential writes)', () => {
    it('should handle 50 sequential creates', async () => {
      const count = 50
      const startTime = Date.now()

      for (let i = 0; i < count; i++) {
        const response = await request(app)
          .post('/api/dispatch')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            vehicleId: 'test-vehicle-1',
            entryTime: new Date().toISOString(),
          })

        expect(response.status).toBe(201)
      }

      const endTime = Date.now()
      const duration = endTime - startTime
      const avgTime = duration / count

      console.log(`50 sequential creates: ${duration}ms total, ${avgTime}ms avg`)
      expect(avgTime).toBeLessThan(200) // 200ms per request max
    })
  })
})
```

```bash
# Using k6 for load testing (alternative)
# k6-load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up
    { duration: '1m', target: 50 },   // Stay at 50
    { duration: '30s', target: 0 },   // Ramp down
  ],
};

const BASE_URL = 'http://localhost:3000';
const AUTH_TOKEN = 'your-test-token';

export default function () {
  const response = http.get(`${BASE_URL}/api/dispatch`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

#### Step 7: Performance Benchmarks (Day 6-7)

```typescript
// server/src/scripts/benchmark.ts
import { db } from '../db/drizzle'
import { dispatchRecords, vehicles, drivers, routes } from '../db/schema'
import { eq, and, gte, lte, sql } from 'drizzle-orm'

interface BenchmarkResult {
  name: string
  duration: number
  recordCount: number
}

async function runBenchmarks() {
  const results: BenchmarkResult[] = []

  // Benchmark 1: Simple select all
  console.log('Running benchmarks...\n')

  let start = Date.now()
  const all = await db.select().from(dispatchRecords)
  results.push({
    name: 'Select all dispatch_records',
    duration: Date.now() - start,
    recordCount: all.length,
  })

  // Benchmark 2: Filtered query
  start = Date.now()
  const filtered = await db
    .select()
    .from(dispatchRecords)
    .where(eq(dispatchRecords.currentStatus, 'departed'))
  results.push({
    name: 'Select by status (departed)',
    duration: Date.now() - start,
    recordCount: filtered.length,
  })

  // Benchmark 3: Date range query
  start = Date.now()
  const dateRange = await db
    .select()
    .from(dispatchRecords)
    .where(and(
      gte(dispatchRecords.entryTime, new Date('2026-01-01')),
      lte(dispatchRecords.entryTime, new Date('2026-01-31'))
    ))
  results.push({
    name: 'Select by date range (1 month)',
    duration: Date.now() - start,
    recordCount: dateRange.length,
  })

  // Benchmark 4: Join query (Report pattern)
  start = Date.now()
  const joined = await db
    .select()
    .from(dispatchRecords)
    .leftJoin(vehicles, eq(dispatchRecords.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(dispatchRecords.driverId, drivers.id))
    .limit(1000)
  results.push({
    name: 'Join query (dispatch + vehicle + driver)',
    duration: Date.now() - start,
    recordCount: joined.length,
  })

  // Benchmark 5: Aggregation
  start = Date.now()
  const aggregated = await db
    .select({
      date: sql`DATE(entry_time)`,
      count: sql<number>`count(*)`,
      total: sql<number>`sum(payment_amount)`,
    })
    .from(dispatchRecords)
    .where(eq(dispatchRecords.currentStatus, 'departed'))
    .groupBy(sql`DATE(entry_time)`)
  results.push({
    name: 'Aggregation (revenue by date)',
    duration: Date.now() - start,
    recordCount: aggregated.length,
  })

  // Print results
  console.log('Results:')
  console.log('-'.repeat(60))
  console.log('| Query'.padEnd(45) + '| Time'.padEnd(10) + '| Records |')
  console.log('-'.repeat(60))

  for (const r of results) {
    console.log(
      `| ${r.name.padEnd(43)}| ${(r.duration + 'ms').padEnd(8)}| ${String(r.recordCount).padEnd(7)} |`
    )
  }

  console.log('-'.repeat(60))
}

runBenchmarks()
```

#### Step 8: Test Coverage Report (Day 8)

```bash
# Run tests with coverage
npm run test:coverage

# Expected output structure:
# ----------------------|---------|----------|---------|---------|
# File                  | % Stmts | % Branch | % Funcs | % Lines |
# ----------------------|---------|----------|---------|---------|
# All files             |   80.00 |    75.00 |   85.00 |   80.00 |
#  dispatch/            |   90.00 |    85.00 |   95.00 |   90.00 |
#  fleet/               |   85.00 |    80.00 |   90.00 |   85.00 |
#  report/              |   75.00 |    70.00 |   80.00 |   75.00 |
# ----------------------|---------|----------|---------|---------|
```

#### Step 9: API Response Validation (Day 9-10)

```typescript
// server/src/__tests__/api/response-format.test.ts
import request from 'supertest'
import { app } from '../../app'
import Ajv from 'ajv'

const ajv = new Ajv()

// Define expected response schemas
const dispatchSchema = {
  type: 'object',
  required: ['id', 'vehicleId', 'currentStatus', 'entryTime'],
  properties: {
    id: { type: 'string' },
    vehicleId: { type: 'string' },
    driverId: { type: ['string', 'null'] },
    currentStatus: { type: 'string' },
    entryTime: { type: 'string' },
    vehiclePlateNumber: { type: ['string', 'null'] },
    driverFullName: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
}

const dispatchListSchema = {
  type: 'array',
  items: dispatchSchema,
}

describe('API Response Format Validation', () => {
  let authToken: string

  beforeAll(async () => {
    authToken = await generateTestToken()
  })

  describe('GET /api/dispatch', () => {
    it('should match expected schema', async () => {
      const response = await request(app)
        .get('/api/dispatch')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)

      const validate = ajv.compile(dispatchListSchema)
      const valid = validate(response.body)

      if (!valid) {
        console.error('Validation errors:', validate.errors)
      }

      expect(valid).toBe(true)
    })
  })

  describe('GET /api/dispatch/:id', () => {
    it('should match expected schema', async () => {
      // Create a dispatch first
      const createRes = await request(app)
        .post('/api/dispatch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vehicleId: 'test-vehicle-1',
          entryTime: new Date().toISOString(),
        })

      const response = await request(app)
        .get(`/api/dispatch/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)

      const validate = ajv.compile(dispatchSchema)
      const valid = validate(response.body)

      expect(valid).toBe(true)
    })
  })
})
```

---

## Todo Checklist

### Week 1
- [ ] Setup test database
- [ ] Configure Jest with test helpers
- [ ] Write DispatchRepository unit tests
- [ ] Write VehicleRepository unit tests
- [ ] Write DriverRepository unit tests
- [ ] Write ReportRepository unit tests
- [ ] Write Dispatch Controller integration tests
- [ ] Write full workflow E2E test
- [ ] Achieve 80%+ coverage on critical paths

### Week 2
- [ ] Create data consistency validation script
- [ ] Run consistency checks on production data
- [ ] Setup load testing environment
- [ ] Run load tests (100 concurrent, 50 sequential)
- [ ] Create performance benchmark script
- [ ] Document benchmark results
- [ ] API response schema validation
- [ ] Generate final test coverage report
- [ ] Fix any failing tests
- [ ] Document known issues

---

## Success Criteria

1. **80%+ code coverage** on repositories and controllers
2. **All integration tests passing**
3. **Data consistency checks passing**
4. **Load test targets met** (< 500ms response, 100 concurrent)
5. **No performance regressions** vs Firebase
6. **API response schemas validated**

---

## Performance Targets

| Metric | Target | Current (Firebase) |
|--------|--------|-------------------|
| GET /api/dispatch | < 200ms | ~300ms |
| GET /api/dispatch/:id | < 50ms | ~80ms |
| POST /api/dispatch | < 150ms | ~200ms |
| Report queries (JOIN) | < 500ms | ~1200ms (N+1) |
| Concurrent requests (100) | < 10s total | Unknown |

---

## Next Steps

Sau khi hoàn thành Phase 5:
1. Proceed to [Phase 6: Deployment & Cutover](./phase-06-deployment-cutover.md)
2. Prepare rollback procedures
3. Schedule deployment window
