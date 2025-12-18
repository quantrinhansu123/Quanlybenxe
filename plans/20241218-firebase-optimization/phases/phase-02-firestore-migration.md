# Phase 02: Cloud Firestore Migration

**Plan:** [../plan.md](../plan.md)
**Dependencies:** Phase 1 (RTDB Optimization) should be completed first for performance baseline
**Estimate:** 6-9 hours
**Status:** Pending

---

## Phase Objectives

Migrate from Firebase Realtime Database to Cloud Firestore for improved querying capabilities, better scalability, offline support, and more flexible data modeling.

---

## Why Migrate to Firestore?

### Firebase RTDB Limitations

| Limitation | Impact on Project |
|------------|-------------------|
| No compound queries | Cannot filter by multiple fields efficiently |
| Limited indexing | Manual index management, slow queries on large datasets |
| Single JSON tree | Data structure limitations, deep nesting issues |
| No offline by default | Client-side caching requires setup |
| 32 levels max depth | Deep data nesting problematic |
| Realtime sync overhead | Performance impact for read-heavy workloads |

### Firestore Advantages

| Feature | Benefit |
|---------|---------|
| Compound queries | Filter by status + date + vehicle in single query |
| Automatic indexing | Better query performance out of box |
| Collection/Document model | Natural hierarchical structure |
| Offline support | Built-in offline persistence |
| Subcollections | Better data organization |
| Better scaling | Handles millions of documents |
| Security rules per document | Granular access control |

---

## TODO Checklist

### 1. Firestore Data Model Design

- [ ] Design collection structure
- [ ] Define document schemas with TypeScript interfaces
- [ ] Plan subcollections vs embedded documents
- [ ] Design indexes for common queries
- [ ] Document security rules

### 2. Setup & Configuration

- [ ] Enable Firestore in Firebase Console
- [ ] Install Firestore Admin SDK
- [ ] Create Firestore configuration module
- [ ] Setup Firestore emulator for local testing

### 3. Migration Planning

- [ ] Create migration order (dependency analysis)
- [ ] Design dual-write period strategy
- [ ] Plan rollback procedure
- [ ] Create data validation scripts

### 4. Collection Migration Scripts

- [ ] Migrate `users` collection
- [ ] Migrate `operators` collection
- [ ] Migrate `vehicles` collection
- [ ] Migrate `drivers` collection
- [ ] Migrate `locations` collection
- [ ] Migrate `routes` collection
- [ ] Migrate `schedules` collection
- [ ] Migrate `dispatch_records` collection
- [ ] Migrate `service_types` collection
- [ ] Migrate `service_charges` collection

### 5. API Layer Migration

- [ ] Create Firestore query builder (similar to current Firebase adapter)
- [ ] Update controllers to use Firestore
- [ ] Maintain API backward compatibility
- [ ] Add feature flag for gradual rollout

### 6. Testing & Validation

- [ ] Unit tests for Firestore operations
- [ ] Integration tests for full workflows
- [ ] Data integrity validation
- [ ] Performance comparison

### 7. Cutover & Cleanup

- [ ] Final data sync
- [ ] Switch traffic to Firestore
- [ ] Monitor for issues
- [ ] Deprecate RTDB code

---

## Implementation Details

### Step 1: Firestore Data Model Design

#### Collection Structure

```
firestore/
├── users/                          # User accounts
│   └── {userId}/
├── operators/                      # Transport operators
│   └── {operatorId}/
├── vehicles/                       # Vehicles
│   └── {vehicleId}/
│       └── documents/              # Subcollection for vehicle documents
│           └── {docId}/
├── drivers/                        # Drivers
│   └── {driverId}/
│       └── operators/              # Subcollection for driver-operator relationships
│           └── {operatorId}/
├── locations/                      # Locations/Stations
│   └── {locationId}/
├── routes/                         # Routes
│   └── {routeId}/
│       └── stops/                  # Subcollection for route stops
│           └── {stopId}/
├── schedules/                      # Schedules
│   └── {scheduleId}/
├── dispatch_records/               # Dispatch records (denormalized)
│   └── {dispatchId}/
│       └── service_charges/        # Subcollection for charges
│           └── {chargeId}/
├── service_types/                  # Service type definitions
│   └── {serviceTypeId}/
├── violations/                     # Violation records
│   └── {violationId}/
└── invoices/                       # Invoices
    └── {invoiceId}/
```

#### Document Schemas

**dispatch_records/{dispatchId}**

```typescript
interface FirestoreDispatchRecord {
  // Identifiers
  id: string
  vehicleId: string
  driverId: string
  scheduleId: string | null
  routeId: string | null

  // Denormalized vehicle data (maintained from Phase 1)
  vehicle: {
    plateNumber: string
    operatorId: string | null
    operatorName: string | null
    operatorCode: string | null
  }

  // Denormalized driver data
  driver: {
    fullName: string
  }

  // Denormalized route data
  route: {
    name: string
    type: string
    destinationId: string | null
    destinationName: string | null
    destinationCode: string | null
  } | null

  // Workflow timestamps
  entryTime: Timestamp
  entryBy: string | null
  entryByName: string | null

  passengerDropTime: Timestamp | null
  passengersArrived: number | null
  passengerDropBy: string | null
  passengerDropByName: string | null

  boardingPermitTime: Timestamp | null
  plannedDepartureTime: Timestamp | null
  transportOrderCode: string | null
  seatCount: number | null
  permitStatus: 'approved' | 'rejected' | 'pending' | null
  rejectionReason: string | null
  boardingPermitBy: string | null
  boardingPermitByName: string | null

  paymentTime: Timestamp | null
  paymentAmount: number | null
  paymentMethod: 'cash' | 'bank_transfer' | 'card' | null
  invoiceNumber: string | null
  paymentBy: string | null
  paymentByName: string | null

  departureOrderTime: Timestamp | null
  passengersDeparting: number | null
  departureOrderBy: string | null
  departureOrderByName: string | null

  exitTime: Timestamp | null
  exitBy: string | null
  exitByName: string | null

  // Status
  currentStatus: DispatchStatus
  notes: string | null
  metadata: Record<string, any> | null

  // Shift references
  entryShiftId: string | null
  permitShiftId: string | null
  paymentShiftId: string | null
  departureOrderShiftId: string | null
  exitShiftId: string | null

  // Timestamps
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**vehicles/{vehicleId}**

```typescript
interface FirestoreVehicle {
  id: string
  plateNumber: string
  vehicleTypeId: string | null
  operatorId: string | null
  seatCapacity: number
  bedCapacity: number
  manufactureYear: number | null
  chassisNumber: string | null
  engineNumber: string | null
  color: string | null
  imageUrl: string | null

  insuranceExpiryDate: Timestamp | null
  inspectionExpiryDate: Timestamp | null

  cargoLength: number | null
  cargoWidth: number | null
  cargoHeight: number | null

  gpsProvider: string | null
  gpsUsername: string | null
  gpsPassword: string | null

  province: string | null

  isActive: boolean
  notes: string | null

  // Denormalized operator (for quick reads)
  operator: {
    id: string
    name: string
    code: string
  } | null

  // Denormalized vehicle type
  vehicleType: {
    id: string
    name: string
  } | null

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Acceptance Criteria:**
- [ ] All collection schemas defined
- [ ] Denormalization strategy documented
- [ ] Subcollections identified

---

### Step 2: Firestore Configuration

**File:** `job-ben-xe-new/server/src/config/firestore.ts`

```typescript
import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import dotenv from 'dotenv'

dotenv.config()

let app: App | null = null
let db: Firestore | null = null

// Initialize Firebase Admin for Firestore
if (!getApps().length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  const googleApplicationCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS

  try {
    if (serviceAccountPath) {
      const serviceAccount = require(serviceAccountPath)
      app = initializeApp({
        credential: cert(serviceAccount),
      })
    } else if (googleApplicationCredentials) {
      app = initializeApp()
    } else {
      app = initializeApp()
      console.warn('Firestore initialized without explicit credentials')
    }
  } catch (error: any) {
    console.error('Firestore initialization error:', error)
    throw new Error(`Failed to initialize Firestore: ${error.message}`)
  }
} else {
  app = getApps()[0]
}

if (!app) {
  throw new Error('Failed to initialize Firebase app')
}

db = getFirestore(app)

// Export Firestore instance and utilities
export { db, Timestamp, FieldValue }

// Collection references
export const collections = {
  users: db.collection('users'),
  operators: db.collection('operators'),
  vehicles: db.collection('vehicles'),
  drivers: db.collection('drivers'),
  locations: db.collection('locations'),
  routes: db.collection('routes'),
  schedules: db.collection('schedules'),
  dispatchRecords: db.collection('dispatch_records'),
  serviceTypes: db.collection('service_types'),
  serviceCharges: db.collection('service_charges'),
  violations: db.collection('violations'),
  invoices: db.collection('invoices'),
}

// Helper for Firestore queries - mirrors the RTDB query builder API
export class FirestoreQueryBuilder<T = any> {
  private query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
  private collectionRef: FirebaseFirestore.CollectionReference

  constructor(collection: FirebaseFirestore.CollectionReference) {
    this.collectionRef = collection
    this.query = collection
  }

  eq(field: string, value: any) {
    this.query = this.query.where(field, '==', value)
    return this
  }

  neq(field: string, value: any) {
    this.query = this.query.where(field, '!=', value)
    return this
  }

  gt(field: string, value: any) {
    this.query = this.query.where(field, '>', value)
    return this
  }

  gte(field: string, value: any) {
    this.query = this.query.where(field, '>=', value)
    return this
  }

  lt(field: string, value: any) {
    this.query = this.query.where(field, '<', value)
    return this
  }

  lte(field: string, value: any) {
    this.query = this.query.where(field, '<=', value)
    return this
  }

  in(field: string, values: any[]) {
    // Firestore has a limit of 10 items for 'in' queries
    // For larger arrays, we need to batch queries
    if (values.length <= 10) {
      this.query = this.query.where(field, 'in', values)
    } else {
      console.warn(`Firestore 'in' query limited to 10 items. Got ${values.length}. Consider batching.`)
      this.query = this.query.where(field, 'in', values.slice(0, 10))
    }
    return this
  }

  order(field: string, options?: { ascending?: boolean }) {
    const direction = options?.ascending === false ? 'desc' : 'asc'
    this.query = this.query.orderBy(field, direction)
    return this
  }

  limit(count: number) {
    this.query = this.query.limit(count)
    return this
  }

  async get(): Promise<{ data: T[], error: any }> {
    try {
      const snapshot = await this.query.get()
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[]
      return { data, error: null }
    } catch (error) {
      return { data: [], error }
    }
  }

  async single(): Promise<{ data: T | null, error: any }> {
    try {
      const snapshot = await this.query.limit(1).get()
      if (snapshot.empty) {
        return { data: null, error: { message: 'Not found' } }
      }
      const doc = snapshot.docs[0]
      return {
        data: { id: doc.id, ...doc.data() } as T,
        error: null
      }
    } catch (error) {
      return { data: null, error }
    }
  }
}

// Firestore interface matching RTDB API
export const firestore = {
  from: (collection: string) => {
    return new FirestoreQueryBuilder(db!.collection(collection))
  },

  // Direct document operations
  doc: (path: string) => db!.doc(path),

  // Batch operations
  batch: () => db!.batch(),

  // Transaction support
  runTransaction: <T>(updateFn: (transaction: FirebaseFirestore.Transaction) => Promise<T>) =>
    db!.runTransaction(updateFn),
}
```

**Acceptance Criteria:**
- [ ] Firestore client configured
- [ ] Query builder API matches RTDB pattern
- [ ] Collections exported for direct access

---

### Step 3: Firestore Indexes

**File:** `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "dispatch_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "currentStatus", "order": "ASCENDING" },
        { "fieldPath": "entryTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatch_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "vehicleId", "order": "ASCENDING" },
        { "fieldPath": "entryTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatch_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "driverId", "order": "ASCENDING" },
        { "fieldPath": "entryTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatch_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "routeId", "order": "ASCENDING" },
        { "fieldPath": "entryTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatch_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "currentStatus", "order": "ASCENDING" },
        { "fieldPath": "vehicleId", "order": "ASCENDING" },
        { "fieldPath": "entryTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "vehicles",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "operatorId", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "drivers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "operatorId", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "schedules",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "routeId", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Deploy indexes:**
```bash
firebase deploy --only firestore:indexes
```

**Acceptance Criteria:**
- [ ] Indexes cover common query patterns
- [ ] Compound indexes for status + date queries
- [ ] Indexes deployed to Firebase

---

### Step 4: Migration Scripts

**File:** `job-ben-xe-new/server/src/scripts/migrate-to-firestore.ts`

```typescript
import { firebase as rtdb } from '../config/database.js'
import { db, Timestamp, collections } from '../config/firestore.js'

interface MigrationStats {
  collection: string
  total: number
  migrated: number
  failed: number
  errors: string[]
}

async function migrateCollection<T>(
  collectionName: string,
  transform: (doc: any) => T
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    collection: collectionName,
    total: 0,
    migrated: 0,
    failed: 0,
    errors: []
  }

  console.log(`\nMigrating ${collectionName}...`)

  // Fetch all documents from RTDB
  const { data: documents, error } = await rtdb.from(collectionName).select('*')

  if (error) {
    stats.errors.push(`Failed to fetch from RTDB: ${error.message}`)
    return stats
  }

  stats.total = documents?.length || 0

  if (!documents || documents.length === 0) {
    console.log(`No documents found in ${collectionName}`)
    return stats
  }

  // Migrate in batches of 500 (Firestore batch limit)
  const batchSize = 500
  const firestoreCollection = db!.collection(collectionName)

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = db!.batch()
    const batchDocs = documents.slice(i, i + batchSize)

    for (const doc of batchDocs) {
      try {
        const transformed = transform(doc)
        const docRef = firestoreCollection.doc(doc.id)
        batch.set(docRef, transformed)
        stats.migrated++
      } catch (err: any) {
        stats.failed++
        stats.errors.push(`Failed to transform ${doc.id}: ${err.message}`)
      }
    }

    try {
      await batch.commit()
      console.log(`  Batch ${Math.floor(i / batchSize) + 1}: ${batchDocs.length} documents`)
    } catch (err: any) {
      stats.failed += batchDocs.length
      stats.migrated -= batchDocs.length
      stats.errors.push(`Batch commit failed: ${err.message}`)
    }
  }

  return stats
}

// Transform functions for each collection
const transforms = {
  users: (doc: any) => ({
    id: doc.id,
    username: doc.username,
    passwordHash: doc.password_hash,
    fullName: doc.full_name,
    email: doc.email || null,
    phone: doc.phone || null,
    role: doc.role,
    isActive: doc.is_active,
    createdAt: Timestamp.fromDate(new Date(doc.created_at)),
    updatedAt: Timestamp.fromDate(new Date(doc.updated_at)),
  }),

  operators: (doc: any) => ({
    id: doc.id,
    name: doc.name,
    code: doc.code,
    taxCode: doc.tax_code || null,
    isTicketDelegated: doc.is_ticket_delegated || false,
    province: doc.province || null,
    district: doc.district || null,
    address: doc.address || null,
    phone: doc.phone || null,
    email: doc.email || null,
    representativeName: doc.representative_name || null,
    representativePosition: doc.representative_position || null,
    contractNumber: doc.contract_number || null,
    contractStartDate: doc.contract_start_date ?
      Timestamp.fromDate(new Date(doc.contract_start_date)) : null,
    contractEndDate: doc.contract_end_date ?
      Timestamp.fromDate(new Date(doc.contract_end_date)) : null,
    isActive: doc.is_active,
    createdAt: Timestamp.fromDate(new Date(doc.created_at)),
    updatedAt: Timestamp.fromDate(new Date(doc.updated_at)),
  }),

  vehicles: (doc: any) => ({
    id: doc.id,
    plateNumber: doc.plate_number,
    vehicleTypeId: doc.vehicle_type_id || null,
    operatorId: doc.operator_id || null,
    seatCapacity: doc.seat_capacity,
    bedCapacity: doc.bed_capacity || 0,
    chassisNumber: doc.chassis_number || null,
    engineNumber: doc.engine_number || null,
    imageUrl: doc.image_url || null,
    insuranceExpiryDate: doc.insurance_expiry_date ?
      Timestamp.fromDate(new Date(doc.insurance_expiry_date)) : null,
    inspectionExpiryDate: doc.inspection_expiry_date ?
      Timestamp.fromDate(new Date(doc.inspection_expiry_date)) : null,
    cargoLength: doc.cargo_length || null,
    cargoWidth: doc.cargo_width || null,
    cargoHeight: doc.cargo_height || null,
    gpsProvider: doc.gps_provider || null,
    gpsUsername: doc.gps_username || null,
    gpsPassword: doc.gps_password || null,
    province: doc.province || null,
    isActive: doc.is_active,
    notes: doc.notes || null,
    createdAt: Timestamp.fromDate(new Date(doc.created_at)),
    updatedAt: Timestamp.fromDate(new Date(doc.updated_at)),
  }),

  drivers: (doc: any) => ({
    id: doc.id,
    operatorId: doc.operator_id,
    fullName: doc.full_name,
    idNumber: doc.id_number,
    phone: doc.phone || null,
    province: doc.province || null,
    district: doc.district || null,
    address: doc.address || null,
    licenseNumber: doc.license_number,
    licenseClass: doc.license_class,
    licenseExpiryDate: Timestamp.fromDate(new Date(doc.license_expiry_date)),
    imageUrl: doc.image_url || null,
    isActive: doc.is_active,
    createdAt: Timestamp.fromDate(new Date(doc.created_at)),
    updatedAt: Timestamp.fromDate(new Date(doc.updated_at)),
  }),

  locations: (doc: any) => ({
    id: doc.id,
    name: doc.name,
    code: doc.code,
    stationType: doc.station_type || null,
    phone: doc.phone || null,
    email: doc.email || null,
    province: doc.province || null,
    district: doc.district || null,
    address: doc.address || null,
    latitude: doc.latitude || null,
    longitude: doc.longitude || null,
    isActive: doc.is_active,
    createdAt: Timestamp.fromDate(new Date(doc.created_at)),
  }),

  routes: (doc: any) => ({
    id: doc.id,
    routeCode: doc.route_code,
    routeName: doc.route_name,
    routeType: doc.route_type || null,
    originId: doc.origin_id,
    destinationId: doc.destination_id,
    distanceKm: doc.distance_km ? parseFloat(doc.distance_km) : null,
    estimatedDurationMinutes: doc.estimated_duration_minutes || null,
    plannedFrequency: doc.planned_frequency || null,
    boardingPoint: doc.boarding_point || null,
    journeyDescription: doc.journey_description || null,
    departureTimesDescription: doc.departure_times_description || null,
    restStops: doc.rest_stops || null,
    isActive: doc.is_active,
    createdAt: Timestamp.fromDate(new Date(doc.created_at)),
    updatedAt: Timestamp.fromDate(new Date(doc.updated_at)),
  }),

  dispatch_records: (doc: any) => ({
    id: doc.id,
    vehicleId: doc.vehicle_id,
    driverId: doc.driver_id,
    scheduleId: doc.schedule_id || null,
    routeId: doc.route_id || null,

    // Denormalized data (from Phase 1)
    vehicle: {
      plateNumber: doc.vehicle_plate_number || '',
      operatorId: doc.vehicle_operator_id || null,
      operatorName: doc.vehicle_operator_name || null,
      operatorCode: doc.vehicle_operator_code || null,
    },
    driver: {
      fullName: doc.driver_full_name || '',
    },
    route: doc.route_name ? {
      name: doc.route_name,
      type: doc.route_type || null,
      destinationId: doc.route_destination_id || null,
      destinationName: doc.route_destination_name || null,
      destinationCode: doc.route_destination_code || null,
    } : null,

    // Workflow fields
    entryTime: Timestamp.fromDate(new Date(doc.entry_time)),
    entryBy: doc.entry_by || null,
    entryByName: doc.entry_by_name || null,

    passengerDropTime: doc.passenger_drop_time ?
      Timestamp.fromDate(new Date(doc.passenger_drop_time)) : null,
    passengersArrived: doc.passengers_arrived || null,
    passengerDropBy: doc.passenger_drop_by || null,
    passengerDropByName: doc.passenger_drop_by_name || null,

    boardingPermitTime: doc.boarding_permit_time ?
      Timestamp.fromDate(new Date(doc.boarding_permit_time)) : null,
    plannedDepartureTime: doc.planned_departure_time ?
      Timestamp.fromDate(new Date(doc.planned_departure_time)) : null,
    transportOrderCode: doc.transport_order_code || null,
    seatCount: doc.seat_count || null,
    permitStatus: doc.permit_status || null,
    rejectionReason: doc.rejection_reason || null,
    boardingPermitBy: doc.boarding_permit_by || null,
    boardingPermitByName: doc.boarding_permit_by_name || null,

    paymentTime: doc.payment_time ?
      Timestamp.fromDate(new Date(doc.payment_time)) : null,
    paymentAmount: doc.payment_amount ? parseFloat(doc.payment_amount) : null,
    paymentMethod: doc.payment_method || null,
    invoiceNumber: doc.invoice_number || null,
    paymentBy: doc.payment_by || null,
    paymentByName: doc.payment_by_name || null,

    departureOrderTime: doc.departure_order_time ?
      Timestamp.fromDate(new Date(doc.departure_order_time)) : null,
    passengersDeparting: doc.passengers_departing || null,
    departureOrderBy: doc.departure_order_by || null,
    departureOrderByName: doc.departure_order_by_name || null,

    exitTime: doc.exit_time ?
      Timestamp.fromDate(new Date(doc.exit_time)) : null,
    exitBy: doc.exit_by || null,
    exitByName: doc.exit_by_name || null,

    currentStatus: doc.current_status,
    notes: doc.notes || null,
    metadata: doc.metadata || null,

    entryShiftId: doc.entry_shift_id || null,
    permitShiftId: doc.permit_shift_id || null,
    paymentShiftId: doc.payment_shift_id || null,
    departureOrderShiftId: doc.departure_order_shift_id || null,
    exitShiftId: doc.exit_shift_id || null,

    createdAt: Timestamp.fromDate(new Date(doc.created_at)),
    updatedAt: Timestamp.fromDate(new Date(doc.updated_at)),
  }),
}

// Main migration function
async function migrateToFirestore() {
  console.log('='.repeat(60))
  console.log('FIREBASE RTDB TO FIRESTORE MIGRATION')
  console.log('='.repeat(60))
  console.log(`Started at: ${new Date().toISOString()}`)

  const results: MigrationStats[] = []

  // Migration order (dependencies first)
  const migrationOrder = [
    { name: 'users', transform: transforms.users },
    { name: 'operators', transform: transforms.operators },
    { name: 'locations', transform: transforms.locations },
    { name: 'vehicles', transform: transforms.vehicles },
    { name: 'drivers', transform: transforms.drivers },
    { name: 'routes', transform: transforms.routes },
    { name: 'dispatch_records', transform: transforms.dispatch_records },
  ]

  for (const { name, transform } of migrationOrder) {
    const stats = await migrateCollection(name, transform)
    results.push(stats)
  }

  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('MIGRATION SUMMARY')
  console.log('='.repeat(60))

  let totalDocs = 0
  let totalMigrated = 0
  let totalFailed = 0

  for (const stats of results) {
    console.log(`\n${stats.collection}:`)
    console.log(`  Total: ${stats.total}`)
    console.log(`  Migrated: ${stats.migrated}`)
    console.log(`  Failed: ${stats.failed}`)
    if (stats.errors.length > 0) {
      console.log(`  Errors:`)
      stats.errors.slice(0, 5).forEach(e => console.log(`    - ${e}`))
      if (stats.errors.length > 5) {
        console.log(`    ... and ${stats.errors.length - 5} more`)
      }
    }
    totalDocs += stats.total
    totalMigrated += stats.migrated
    totalFailed += stats.failed
  }

  console.log('\n' + '-'.repeat(60))
  console.log(`TOTAL: ${totalMigrated}/${totalDocs} documents migrated (${totalFailed} failed)`)
  console.log(`Completed at: ${new Date().toISOString()}`)

  return results
}

// Run migration
migrateToFirestore()
  .then(results => {
    const failed = results.reduce((sum, r) => sum + r.failed, 0)
    process.exit(failed > 0 ? 1 : 0)
  })
  .catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
```

**Acceptance Criteria:**
- [ ] All collections migrated successfully
- [ ] Data integrity verified
- [ ] Error handling for failed documents

---

### Step 5: Dual-Write Period Strategy

During migration, implement dual-write to keep both databases in sync:

**File:** `job-ben-xe-new/server/src/config/database-dual.ts`

```typescript
import { firebase as rtdb } from './database.js'
import { firestore, db } from './firestore.js'

// Feature flag for dual-write mode
const DUAL_WRITE_ENABLED = process.env.DUAL_WRITE_ENABLED === 'true'
const USE_FIRESTORE_PRIMARY = process.env.USE_FIRESTORE_PRIMARY === 'true'

export const database = {
  async insert(collection: string, data: any) {
    if (USE_FIRESTORE_PRIMARY) {
      // Firestore is primary, optionally write to RTDB
      const result = await firestore.from(collection).insert(data)
      if (DUAL_WRITE_ENABLED) {
        await rtdb.from(collection).insert(data).catch(console.error)
      }
      return result
    } else {
      // RTDB is primary, optionally write to Firestore
      const result = await rtdb.from(collection).insert(data)
      if (DUAL_WRITE_ENABLED) {
        await db?.collection(collection).doc(data.id).set(data).catch(console.error)
      }
      return result
    }
  },

  async update(collection: string, id: string, data: any) {
    if (USE_FIRESTORE_PRIMARY) {
      await db?.collection(collection).doc(id).update(data)
      if (DUAL_WRITE_ENABLED) {
        await rtdb.from(collection).update(data).eq('id', id).catch(console.error)
      }
    } else {
      await rtdb.from(collection).update(data).eq('id', id)
      if (DUAL_WRITE_ENABLED) {
        await db?.collection(collection).doc(id).update(data).catch(console.error)
      }
    }
  },

  async read(collection: string) {
    if (USE_FIRESTORE_PRIMARY) {
      return firestore.from(collection)
    } else {
      return rtdb.from(collection)
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Dual-write mode toggleable via environment variable
- [ ] Primary database selectable
- [ ] Errors in secondary write don't fail primary

---

### Step 6: Rollback Script

**File:** `job-ben-xe-new/server/src/scripts/rollback-from-firestore.ts`

```typescript
import { db, collections } from '../config/firestore.js'
import { firebase as rtdb, firebaseDb } from '../config/database.js'

async function rollbackCollection(collectionName: string, transform: (doc: any) => any) {
  console.log(`Rolling back ${collectionName}...`)

  const snapshot = await db!.collection(collectionName).get()
  console.log(`  Found ${snapshot.size} documents`)

  let success = 0
  let failed = 0

  for (const doc of snapshot.docs) {
    try {
      const data = transform({ id: doc.id, ...doc.data() })
      await firebaseDb.set(`${collectionName}/${doc.id}`, data)
      success++
    } catch (err) {
      console.error(`  Failed to rollback ${doc.id}:`, err)
      failed++
    }
  }

  console.log(`  Rolled back: ${success}, Failed: ${failed}`)
  return { success, failed }
}

// Rollback is reverse of migration transforms
// ...

async function main() {
  console.log('FIRESTORE TO RTDB ROLLBACK')
  console.log('This will overwrite RTDB data with Firestore data')
  console.log('Press Ctrl+C to abort within 10 seconds...')

  await new Promise(resolve => setTimeout(resolve, 10000))

  // Rollback in reverse order
  await rollbackCollection('dispatch_records', /* transform */)
  await rollbackCollection('routes', /* transform */)
  // ... etc

  console.log('Rollback complete')
}
```

**Acceptance Criteria:**
- [ ] Rollback script tested
- [ ] Confirmation prompt before destructive action
- [ ] Logging for audit trail

---

## Testing Checklist

### Unit Tests

- [ ] Firestore query builder methods work correctly
- [ ] Transform functions handle null/undefined values
- [ ] Timestamp conversions are accurate

### Integration Tests

- [ ] CRUD operations work end-to-end
- [ ] Compound queries return correct results
- [ ] Batch operations complete successfully
- [ ] Transaction rollback works on error

### Data Integrity Tests

- [ ] Document counts match between RTDB and Firestore
- [ ] Field values are identical after migration
- [ ] Relationships (references) are preserved
- [ ] Timestamps are correctly converted

### Performance Tests

- [ ] Query latency measured and acceptable
- [ ] Batch import performance validated
- [ ] Compound query performance verified

---

## Cutover Plan

### Pre-Cutover (Day -7)

- [ ] Complete all migration testing
- [ ] Enable dual-write mode
- [ ] Verify data sync

### Cutover Day

1. [ ] Take full backup of both databases
2. [ ] Stop all write operations (maintenance mode)
3. [ ] Run final sync to ensure consistency
4. [ ] Verify document counts match
5. [ ] Switch `USE_FIRESTORE_PRIMARY=true`
6. [ ] Resume operations
7. [ ] Monitor for errors

### Post-Cutover (Week 1)

- [ ] Monitor error rates
- [ ] Compare performance metrics
- [ ] Keep dual-write for safety

### Cleanup (Week 2+)

- [ ] Disable dual-write
- [ ] Archive RTDB data
- [ ] Remove RTDB code

---

## Phase Completion Criteria

Before marking this phase complete, ensure:

- [ ] All collections migrated to Firestore
- [ ] Migration script tested and validated
- [ ] Rollback script tested
- [ ] API controllers updated for Firestore
- [ ] Dual-write mode implemented
- [ ] Indexes deployed
- [ ] Performance validated
- [ ] Documentation updated

---

## Handover Report Location

Create handover report: `../reports/001-planner-to-impl-firestore-migration-handover.md`

---

## Estimated Timeline

| Task | Duration | Dependencies |
|------|----------|--------------|
| Firestore setup & config | 2h | None |
| Data model design | 2h | None |
| Migration scripts | 3h | Data model |
| Controller updates | 3h | Firestore config |
| Testing | 2h | All above |
| Cutover execution | 2h | All above |

**Total:** 14 hours (spread over 2-3 days)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data loss | Full backup before migration, dual-write period |
| Performance regression | Benchmark before/after, indexes in place |
| API breaking changes | Maintain same response format |
| Extended downtime | Use dual-write for zero-downtime cutover |
