# Phase 01: Firebase RTDB Denormalization Optimization

**Plan:** [../plan.md](../plan.md)
**Dependencies:** None
**Estimate:** 5-7 hours
**Status:** Pending

---

## Phase Objectives

Optimize the Firebase Realtime Database by implementing denormalization for `DispatchRecord` to reduce the current 5 queries to a single query while maintaining data consistency.

---

## Current State Analysis

### Current DispatchRecord Query Flow

```typescript
// dispatch.controller.ts - getAllDispatchRecords (lines 25-175)

// Query 1: Get dispatch records
const { data: records } = await firebase.from('dispatch_records').select('*')

// Query 2: Get vehicles with operators
const { data: vehicles } = await firebase.from('vehicles')
  .select('id, plate_number, operator_id, operators:operator_id(id, name, code)')
  .in('id', vehicleIds)

// Query 3: Get drivers
const { data: drivers } = await firebase.from('drivers')
  .select('id, full_name')
  .in('id', driverIds)

// Query 4: Get routes with destinations
const { data: routes } = await firebase.from('routes')
  .select('id, route_name, route_type, destination:destination_id(id, name, code)')
  .in('id', routeIds)

// Query 5: Get users for audit trail
const { data: users } = await firebase.from('users')
  .select('id, full_name')
  .in('id', userIds)
```

### Fields Currently Joined at Runtime

| Field | Source Collection | Frequency of Change |
|-------|------------------|---------------------|
| `vehiclePlateNumber` | vehicles | Rarely |
| `operatorName`, `operatorCode` | operators | Rarely |
| `driverName` | drivers | Rarely |
| `routeName`, `routeType` | routes | Rarely |
| `destinationName`, `destinationCode` | locations | Rarely |
| `entryByName`, `paymentByName`, etc. | users | Never |

---

## TODO Checklist

### 1. Design Denormalized Schema

- [ ] Define new denormalized fields for `dispatch_records`
- [ ] Create TypeScript interface for denormalized DispatchRecord
- [ ] Document update triggers needed

### 2. Update Database Schema

- [ ] Add denormalized fields to `dispatch_records` collection
- [ ] Create Firebase RTDB indexing rules
- [ ] Test new schema with sample data

### 3. Update Create/Update Logic

- [ ] Modify `createDispatchRecord` to embed denormalized data
- [ ] Update workflow functions to maintain denormalized data
- [ ] Create helper function for fetching denormalized data

### 4. Implement Data Sync Triggers

- [ ] Create update propagation for vehicle changes
- [ ] Create update propagation for driver changes
- [ ] Create update propagation for route changes
- [ ] Create update propagation for user name changes

### 5. Migration Script for Existing Data

- [ ] Create migration script to populate denormalized fields
- [ ] Test migration on sample data
- [ ] Create rollback script

### 6. Update Read Queries

- [ ] Simplify `getAllDispatchRecords` to single query
- [ ] Simplify `getDispatchRecordById` to single query
- [ ] Verify API response format unchanged

### 7. Testing & Verification

- [ ] Unit tests for denormalized data consistency
- [ ] Integration tests for full CRUD operations
- [ ] Performance benchmarking (before/after)

---

## Implementation Details

### Step 1: Denormalized Schema Design

**New Denormalized Fields for `dispatch_records`:**

```typescript
interface DenormalizedDispatchRecord {
  // Existing fields
  id: string
  vehicle_id: string
  driver_id: string
  schedule_id: string | null
  route_id: string | null

  // === NEW DENORMALIZED FIELDS ===

  // Vehicle denormalized data
  vehicle_plate_number: string
  vehicle_operator_id: string | null
  vehicle_operator_name: string | null
  vehicle_operator_code: string | null

  // Driver denormalized data
  driver_full_name: string

  // Route denormalized data
  route_name: string | null
  route_type: string | null
  route_destination_id: string | null
  route_destination_name: string | null
  route_destination_code: string | null

  // User denormalized data (audit trail)
  entry_by_name: string | null
  passenger_drop_by_name: string | null
  boarding_permit_by_name: string | null
  payment_by_name: string | null
  departure_order_by_name: string | null
  exit_by_name: string | null

  // Rest of existing fields...
  entry_time: string
  current_status: DispatchStatus
  // ...
}
```

**Acceptance Criteria:**
- [ ] Schema supports single-query reads
- [ ] No breaking changes to existing API response format
- [ ] TypeScript types updated

---

### Step 2: Firebase RTDB Index Rules

**File:** Firebase Console -> Realtime Database -> Rules

```json
{
  "rules": {
    "dispatch_records": {
      ".indexOn": [
        "current_status",
        "vehicle_id",
        "driver_id",
        "route_id",
        "entry_time",
        "vehicle_plate_number",
        "driver_full_name"
      ]
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Indexes cover all common query patterns
- [ ] Query performance validated with Firebase Profiler

---

### Step 3: Update createDispatchRecord Function

**File:** `job-ben-xe-new/server/src/controllers/dispatch.controller.ts`

```typescript
export const createDispatchRecord = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId, driverId, scheduleId, routeId, entryTime, notes, entryShiftId } = dispatchSchema.parse(req.body)
    const userId = req.user?.id

    // Fetch denormalized data in parallel
    const [vehicleResult, driverResult, routeResult, userResult] = await Promise.all([
      firebase.from('vehicles')
        .select('id, plate_number, operator_id, operators:operator_id(id, name, code)')
        .eq('id', vehicleId)
        .single(),
      firebase.from('drivers')
        .select('id, full_name')
        .eq('id', driverId)
        .single(),
      routeId ? firebase.from('routes')
        .select('id, route_name, route_type, destination:destination_id(id, name, code)')
        .eq('id', routeId)
        .single() : { data: null },
      userId ? firebase.from('users')
        .select('id, full_name')
        .eq('id', userId)
        .single() : { data: null }
    ])

    const vehicle = vehicleResult.data
    const driver = driverResult.data
    const route = routeResult.data
    const user = userResult.data

    // Build operator data
    const operatorData = vehicle?.operators

    const insertData = {
      vehicle_id: vehicleId,
      driver_id: driverId,
      schedule_id: scheduleId || null,
      route_id: routeId || null,
      entry_time: convertVietnamISOToUTCForStorage(entryTime),
      entry_by: userId || null,
      current_status: 'entered',
      notes: notes || null,
      entry_shift_id: entryShiftId || null,

      // Denormalized vehicle data
      vehicle_plate_number: vehicle?.plate_number || '',
      vehicle_operator_id: vehicle?.operator_id || null,
      vehicle_operator_name: operatorData?.name || null,
      vehicle_operator_code: operatorData?.code || null,

      // Denormalized driver data
      driver_full_name: driver?.full_name || '',

      // Denormalized route data
      route_name: route?.route_name || null,
      route_type: route?.route_type || null,
      route_destination_id: route?.destination?.id || null,
      route_destination_name: route?.destination?.name || null,
      route_destination_code: route?.destination?.code || null,

      // Denormalized user data
      entry_by_name: user?.full_name || null,
    }

    const { data, error } = await firebase
      .from('dispatch_records')
      .insert(insertData)
      .select('*')
      .single()

    // ... rest of function (format response)
  } catch (error) {
    // ... error handling
  }
}
```

**Acceptance Criteria:**
- [ ] All denormalized fields populated on create
- [ ] Response format unchanged
- [ ] No increase in create latency beyond 50ms

---

### Step 4: Helper Function for Denormalized Data Fetching

**File:** `job-ben-xe-new/server/src/utils/denormalization.ts` (new file)

```typescript
import { firebase } from '../config/database.js'

interface DenormalizedData {
  vehicle: {
    plateNumber: string
    operatorId: string | null
    operatorName: string | null
    operatorCode: string | null
  }
  driver: {
    fullName: string
  }
  route: {
    name: string | null
    type: string | null
    destinationId: string | null
    destinationName: string | null
    destinationCode: string | null
  } | null
  user: {
    fullName: string | null
  } | null
}

export async function fetchDenormalizedData(params: {
  vehicleId: string
  driverId: string
  routeId?: string | null
  userId?: string | null
}): Promise<DenormalizedData> {
  const [vehicleResult, driverResult, routeResult, userResult] = await Promise.all([
    firebase.from('vehicles')
      .select('id, plate_number, operator_id, operators:operator_id(id, name, code)')
      .eq('id', params.vehicleId)
      .single(),
    firebase.from('drivers')
      .select('id, full_name')
      .eq('id', params.driverId)
      .single(),
    params.routeId ? firebase.from('routes')
      .select('id, route_name, route_type, destination:destination_id(id, name, code)')
      .eq('id', params.routeId)
      .single() : Promise.resolve({ data: null }),
    params.userId ? firebase.from('users')
      .select('id, full_name')
      .eq('id', params.userId)
      .single() : Promise.resolve({ data: null })
  ])

  const vehicle = vehicleResult.data
  const driver = driverResult.data
  const route = routeResult.data
  const user = userResult.data
  const operatorData = vehicle?.operators

  return {
    vehicle: {
      plateNumber: vehicle?.plate_number || '',
      operatorId: vehicle?.operator_id || null,
      operatorName: operatorData?.name || null,
      operatorCode: operatorData?.code || null,
    },
    driver: {
      fullName: driver?.full_name || '',
    },
    route: route ? {
      name: route.route_name || null,
      type: route.route_type || null,
      destinationId: route.destination?.id || null,
      destinationName: route.destination?.name || null,
      destinationCode: route.destination?.code || null,
    } : null,
    user: user ? {
      fullName: user.full_name || null,
    } : null,
  }
}

export function buildDenormalizedFields(data: DenormalizedData) {
  return {
    vehicle_plate_number: data.vehicle.plateNumber,
    vehicle_operator_id: data.vehicle.operatorId,
    vehicle_operator_name: data.vehicle.operatorName,
    vehicle_operator_code: data.vehicle.operatorCode,
    driver_full_name: data.driver.fullName,
    route_name: data.route?.name || null,
    route_type: data.route?.type || null,
    route_destination_id: data.route?.destinationId || null,
    route_destination_name: data.route?.destinationName || null,
    route_destination_code: data.route?.destinationCode || null,
  }
}
```

**Acceptance Criteria:**
- [ ] Helper function reusable across all workflow functions
- [ ] Parallel fetching for performance
- [ ] Proper null handling

---

### Step 5: Update Workflow Functions for User Name Denormalization

Each workflow function needs to update the corresponding `*_by_name` field:

**recordPassengerDrop:**
```typescript
const updateData = {
  // ... existing fields
  passenger_drop_by_name: userName, // Add this
}
```

**issuePermit:**
```typescript
const updateData = {
  // ... existing fields
  boarding_permit_by_name: userName, // Add this
}
```

**processPayment:**
```typescript
const updateData = {
  // ... existing fields
  payment_by_name: userName, // Add this
}
```

**issueDepartureOrder:**
```typescript
const updateData = {
  // ... existing fields
  departure_order_by_name: userName, // Add this
}
```

**recordExit:**
```typescript
const updateData = {
  // ... existing fields
  exit_by_name: userName, // Add this
}
```

**Acceptance Criteria:**
- [ ] All 6 workflow functions update user names
- [ ] User name fetched only when userId provided

---

### Step 6: Migration Script for Existing Data

**File:** `job-ben-xe-new/server/src/scripts/migrate-denormalize-dispatch.ts`

```typescript
import { firebase, firebaseDb } from '../config/database.js'

async function migrateDispatchRecords() {
  console.log('Starting dispatch records denormalization migration...')

  // Fetch all dispatch records
  const { data: records, error } = await firebase.from('dispatch_records').select('*')

  if (error) {
    console.error('Failed to fetch records:', error)
    return
  }

  console.log(`Found ${records.length} records to migrate`)

  // Fetch all reference data
  const [vehicles, drivers, routes, users] = await Promise.all([
    firebase.from('vehicles').select('id, plate_number, operator_id, operators:operator_id(id, name, code)'),
    firebase.from('drivers').select('id, full_name'),
    firebase.from('routes').select('id, route_name, route_type, destination:destination_id(id, name, code)'),
    firebase.from('users').select('id, full_name'),
  ])

  // Create lookup maps
  const vehicleMap = new Map(vehicles.data?.map((v: any) => [v.id, v]) || [])
  const driverMap = new Map(drivers.data?.map((d: any) => [d.id, d]) || [])
  const routeMap = new Map(routes.data?.map((r: any) => [r.id, r]) || [])
  const userMap = new Map(users.data?.map((u: any) => [u.id, u]) || [])

  // Process in batches of 50
  const batchSize = 50
  let processed = 0
  let failed = 0

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)

    await Promise.all(batch.map(async (record: any) => {
      try {
        const vehicle = vehicleMap.get(record.vehicle_id)
        const driver = driverMap.get(record.driver_id)
        const route = record.route_id ? routeMap.get(record.route_id) : null

        const operatorData = vehicle?.operators
        const destination = route?.destination

        const updateData = {
          // Vehicle denormalized data
          vehicle_plate_number: vehicle?.plate_number || '',
          vehicle_operator_id: vehicle?.operator_id || null,
          vehicle_operator_name: operatorData?.name || null,
          vehicle_operator_code: operatorData?.code || null,

          // Driver denormalized data
          driver_full_name: driver?.full_name || '',

          // Route denormalized data
          route_name: route?.route_name || null,
          route_type: route?.route_type || null,
          route_destination_id: destination?.id || null,
          route_destination_name: destination?.name || null,
          route_destination_code: destination?.code || null,

          // User denormalized data
          entry_by_name: record.entry_by ? userMap.get(record.entry_by)?.full_name || null : null,
          passenger_drop_by_name: record.passenger_drop_by ? userMap.get(record.passenger_drop_by)?.full_name || null : null,
          boarding_permit_by_name: record.boarding_permit_by ? userMap.get(record.boarding_permit_by)?.full_name || null : null,
          payment_by_name: record.payment_by ? userMap.get(record.payment_by)?.full_name || null : null,
          departure_order_by_name: record.departure_order_by ? userMap.get(record.departure_order_by)?.full_name || null : null,
          exit_by_name: record.exit_by ? userMap.get(record.exit_by)?.full_name || null : null,
        }

        await firebaseDb.update(`dispatch_records/${record.id}`, updateData)
        processed++
      } catch (err) {
        console.error(`Failed to migrate record ${record.id}:`, err)
        failed++
      }
    }))

    console.log(`Progress: ${processed}/${records.length} (${failed} failed)`)
  }

  console.log(`Migration complete: ${processed} processed, ${failed} failed`)
}

// Run migration
migrateDispatchRecords().catch(console.error)
```

**Acceptance Criteria:**
- [ ] All existing records updated with denormalized data
- [ ] Script handles errors gracefully
- [ ] Progress logging for monitoring

---

### Step 7: Update getAllDispatchRecords - Simplified Query

**File:** `job-ben-xe-new/server/src/controllers/dispatch.controller.ts`

**BEFORE (5 queries):**
```typescript
export const getAllDispatchRecords = async (req: Request, res: Response) => {
  // Query 1: dispatch_records
  // Query 2: vehicles
  // Query 3: drivers
  // Query 4: routes
  // Query 5: users
  // ... complex mapping logic
}
```

**AFTER (1 query):**
```typescript
export const getAllDispatchRecords = async (req: Request, res: Response) => {
  try {
    const { status, vehicleId, driverId, routeId } = req.query

    let query = firebase
      .from('dispatch_records')
      .select('*')
      .order('entry_time', { ascending: false })

    if (status) {
      query = query.eq('current_status', status as string)
    }
    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId as string)
    }
    if (driverId) {
      query = query.eq('driver_id', driverId as string)
    }
    if (routeId) {
      query = query.eq('route_id', routeId as string)
    }

    const { data: records, error } = await query

    if (error) throw error

    // Simple mapping - no additional queries needed!
    const result = records.map((record: any) => ({
      id: record.id,
      vehicleId: record.vehicle_id,
      vehicle: {
        id: record.vehicle_id,
        plateNumber: record.vehicle_plate_number,
        operatorId: record.vehicle_operator_id,
        operator: record.vehicle_operator_name ? {
          id: record.vehicle_operator_id,
          name: record.vehicle_operator_name,
          code: record.vehicle_operator_code,
        } : undefined,
      },
      vehiclePlateNumber: record.vehicle_plate_number,
      driverId: record.driver_id,
      driverName: record.driver_full_name,
      scheduleId: record.schedule_id,
      routeId: record.route_id,
      route: record.route_name ? {
        id: record.route_id,
        routeName: record.route_name,
        routeType: record.route_type,
        destination: record.route_destination_name ? {
          id: record.route_destination_id,
          name: record.route_destination_name,
          code: record.route_destination_code,
        } : undefined,
      } : undefined,
      routeName: record.route_name || '',
      entryTime: record.entry_time,
      entryBy: record.entry_by_name || record.entry_by,
      passengerDropTime: record.passenger_drop_time,
      passengersArrived: record.passengers_arrived,
      passengerDropBy: record.passenger_drop_by_name || record.passenger_drop_by,
      boardingPermitTime: record.boarding_permit_time,
      plannedDepartureTime: record.planned_departure_time,
      transportOrderCode: record.transport_order_code,
      seatCount: record.seat_count,
      permitStatus: record.permit_status,
      rejectionReason: record.rejection_reason,
      boardingPermitBy: record.boarding_permit_by_name || record.boarding_permit_by,
      paymentTime: record.payment_time,
      paymentAmount: record.payment_amount ? parseFloat(record.payment_amount) : null,
      paymentMethod: record.payment_method,
      invoiceNumber: record.invoice_number,
      paymentBy: record.payment_by_name || record.payment_by,
      departureOrderTime: record.departure_order_time,
      passengersDeparting: record.passengers_departing,
      departureOrderBy: record.departure_order_by_name || record.departure_order_by,
      exitTime: record.exit_time,
      exitBy: record.exit_by_name || record.exit_by,
      currentStatus: record.current_status,
      notes: record.notes,
      metadata: record.metadata,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }))

    return res.json(result)
  } catch (error) {
    console.error('Error fetching dispatch records:', error)
    return res.status(500).json({ error: 'Failed to fetch dispatch records' })
  }
}
```

**Acceptance Criteria:**
- [ ] Single query fetches all data
- [ ] API response format identical to before
- [ ] 60-80% performance improvement

---

### Step 8: Data Consistency - Update Propagation

When source data changes (vehicle, driver, route), we need to update denormalized fields in `dispatch_records`.

**Option A: Server-side triggers (recommended for RTDB)**

Create update functions that run when source data changes:

**File:** `job-ben-xe-new/server/src/utils/denormalization-sync.ts`

```typescript
import { firebase, firebaseDb } from '../config/database.js'

/**
 * Update all dispatch records when a vehicle's plate number or operator changes
 */
export async function syncVehicleChanges(vehicleId: string, changes: {
  plateNumber?: string
  operatorId?: string | null
  operatorName?: string | null
  operatorCode?: string | null
}) {
  const { data: records } = await firebase
    .from('dispatch_records')
    .select('id')
    .eq('vehicle_id', vehicleId)

  if (!records || records.length === 0) return

  const updates: Record<string, any> = {}
  if (changes.plateNumber !== undefined) updates.vehicle_plate_number = changes.plateNumber
  if (changes.operatorId !== undefined) updates.vehicle_operator_id = changes.operatorId
  if (changes.operatorName !== undefined) updates.vehicle_operator_name = changes.operatorName
  if (changes.operatorCode !== undefined) updates.vehicle_operator_code = changes.operatorCode

  if (Object.keys(updates).length === 0) return

  // Batch update
  await Promise.all(records.map((r: any) =>
    firebaseDb.update(`dispatch_records/${r.id}`, updates)
  ))

  console.log(`Updated ${records.length} dispatch records for vehicle ${vehicleId}`)
}

/**
 * Update all dispatch records when a driver's name changes
 */
export async function syncDriverChanges(driverId: string, fullName: string) {
  const { data: records } = await firebase
    .from('dispatch_records')
    .select('id')
    .eq('driver_id', driverId)

  if (!records || records.length === 0) return

  await Promise.all(records.map((r: any) =>
    firebaseDb.update(`dispatch_records/${r.id}`, { driver_full_name: fullName })
  ))

  console.log(`Updated ${records.length} dispatch records for driver ${driverId}`)
}

/**
 * Update all dispatch records when a route's name or destination changes
 */
export async function syncRouteChanges(routeId: string, changes: {
  routeName?: string
  routeType?: string
  destinationId?: string | null
  destinationName?: string | null
  destinationCode?: string | null
}) {
  const { data: records } = await firebase
    .from('dispatch_records')
    .select('id')
    .eq('route_id', routeId)

  if (!records || records.length === 0) return

  const updates: Record<string, any> = {}
  if (changes.routeName !== undefined) updates.route_name = changes.routeName
  if (changes.routeType !== undefined) updates.route_type = changes.routeType
  if (changes.destinationId !== undefined) updates.route_destination_id = changes.destinationId
  if (changes.destinationName !== undefined) updates.route_destination_name = changes.destinationName
  if (changes.destinationCode !== undefined) updates.route_destination_code = changes.destinationCode

  if (Object.keys(updates).length === 0) return

  await Promise.all(records.map((r: any) =>
    firebaseDb.update(`dispatch_records/${r.id}`, updates)
  ))

  console.log(`Updated ${records.length} dispatch records for route ${routeId}`)
}
```

**Integration with existing update functions:**

In `vehicle.controller.ts` -> `updateVehicle`:
```typescript
// At the end of successful update:
import { syncVehicleChanges } from '../utils/denormalization-sync.js'

// After vehicle update succeeds:
if (updateData.plate_number || updateData.operator_id) {
  await syncVehicleChanges(id, {
    plateNumber: vehicle.plate_number,
    operatorId: vehicle.operator_id,
    operatorName: vehicle.operators?.name,
    operatorCode: vehicle.operators?.code,
  })
}
```

**Acceptance Criteria:**
- [ ] Vehicle changes propagate to dispatch records
- [ ] Driver name changes propagate to dispatch records
- [ ] Route changes propagate to dispatch records
- [ ] Sync is async and non-blocking

---

## Phase Completion Criteria

Before marking this phase complete, ensure:

- [ ] All TODO items checked
- [ ] Migration script run successfully on all existing data
- [ ] getAllDispatchRecords uses single query
- [ ] getDispatchRecordById uses single query
- [ ] API response format unchanged (backward compatible)
- [ ] Data sync triggers integrated into update functions
- [ ] Performance benchmarks show 60-80% improvement
- [ ] No console errors/warnings
- [ ] Code reviewed and tested

---

## Performance Benchmarks

Run before and after to measure improvement:

```typescript
// Benchmark script
async function benchmarkDispatchQueries() {
  const iterations = 10
  const times: number[] = []

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fetch('/api/dispatch?limit=100')
    times.push(performance.now() - start)
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length
  console.log(`Average response time: ${avg.toFixed(2)}ms`)
  console.log(`Min: ${Math.min(...times).toFixed(2)}ms`)
  console.log(`Max: ${Math.max(...times).toFixed(2)}ms`)
}
```

**Expected Results:**
- Before: 800-1200ms (5 sequential queries)
- After: 150-300ms (1 query)
- Improvement: 60-80%

---

## Handover to Next Phase

**Phase 02 Prerequisites:**
- Denormalization pattern established and working
- Performance improvement validated
- Data sync mechanism tested

**Files Created/Modified:**
- `job-ben-xe-new/server/src/utils/denormalization.ts` (new)
- `job-ben-xe-new/server/src/utils/denormalization-sync.ts` (new)
- `job-ben-xe-new/server/src/scripts/migrate-denormalize-dispatch.ts` (new)
- `job-ben-xe-new/server/src/controllers/dispatch.controller.ts` (modified)
- `job-ben-xe-new/server/src/controllers/vehicle.controller.ts` (modified)
- `job-ben-xe-new/server/src/controllers/driver.controller.ts` (modified)
- `job-ben-xe-new/server/src/controllers/route.controller.ts` (modified)

**Decisions Made:**
- Embed frequently-read, rarely-changed data directly in dispatch_records
- Use server-side sync instead of Cloud Functions (simpler for RTDB)
- Maintain backward compatibility with existing API contracts

---

## Known Issues / Technical Debt

- [ ] Sync triggers run synchronously - consider background queue for large updates
- [ ] No automatic cleanup for orphaned denormalized data
- [ ] User name updates require manual propagation (users rarely change names)
