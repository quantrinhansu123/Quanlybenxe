/**
 * Dispatch Records Schema (Đơn điều độ)
 * Core transactional table - Migrated from Firebase RTDB: dispatch_records
 * Contains denormalized fields for reporting performance
 */
import { pgTable, uuid, varchar, integer, decimal, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { vehicles } from './vehicles'
import { drivers } from './drivers'
import { routes } from './routes'
import { operators } from './operators'
import { users } from './users'
import { shifts } from './shifts'

export const dispatchRecords = pgTable('dispatch_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseId: varchar('firebase_id', { length: 100 }).unique(),
  // Foreign keys
  vehicleId: uuid('vehicle_id').references(() => vehicles.id),
  driverId: uuid('driver_id').references(() => drivers.id),
  routeId: uuid('route_id').references(() => routes.id),
  operatorId: uuid('operator_id').references(() => operators.id),
  userId: uuid('user_id').references(() => users.id),
  shiftId: uuid('shift_id').references(() => shifts.id),
  // Status workflow
  status: varchar('status', { length: 50 }).default('entered').notNull(),
  // Timing
  entryTime: timestamp('entry_time', { withTimezone: true }),
  exitTime: timestamp('exit_time', { withTimezone: true }),
  departureTime: timestamp('departure_time', { withTimezone: true }),
  passengerDropTime: timestamp('passenger_drop_time', { withTimezone: true }),
  permitIssuedTime: timestamp('permit_issued_time', { withTimezone: true }),
  paymentTime: timestamp('payment_time', { withTimezone: true }),
  // Passenger info
  passengers: integer('passengers').default(0),
  passengerManifest: jsonb('passenger_manifest'),
  // Financial
  fare: decimal('fare', { precision: 12, scale: 2 }),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }),
  serviceCharges: jsonb('service_charges'),
  // Permit info
  permitNumber: varchar('permit_number', { length: 50 }),
  departureOrderNumber: varchar('departure_order_number', { length: 50 }),
  // Notes
  notes: text('notes'),
  rejectionReason: text('rejection_reason'),
  // ====== DENORMALIZED FIELDS FOR REPORTING ======
  // Vehicle snapshot
  vehiclePlateNumber: varchar('vehicle_plate_number', { length: 20 }),
  vehicleSeatCount: integer('vehicle_seat_count'),
  // Driver snapshot
  driverName: varchar('driver_name', { length: 255 }),
  driverPhone: varchar('driver_phone', { length: 20 }),
  // Operator snapshot
  operatorName: varchar('operator_name', { length: 255 }),
  operatorCode: varchar('operator_code', { length: 50 }),
  // Route snapshot
  routeCode: varchar('route_code', { length: 50 }),
  routeName: varchar('route_name', { length: 255 }),
  departureStation: varchar('departure_station', { length: 255 }),
  arrivalStation: varchar('arrival_station', { length: 255 }),
  // User snapshot
  createdByName: varchar('created_by_name', { length: 255 }),
  // ====== END DENORMALIZED FIELDS ======
  // Status flags
  isActive: boolean('is_active').default(true).notNull(),
  isDeleted: boolean('is_deleted').default(false),
  // Metadata
  metadata: jsonb('metadata'),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  vehicleIdx: index('dispatch_vehicle_idx').on(table.vehicleId),
  driverIdx: index('dispatch_driver_idx').on(table.driverId),
  operatorIdx: index('dispatch_operator_idx').on(table.operatorId),
  statusIdx: index('dispatch_status_idx').on(table.status),
  entryTimeIdx: index('dispatch_entry_time_idx').on(table.entryTime),
  createdAtIdx: index('dispatch_created_at_idx').on(table.createdAt),
  plateNumberIdx: index('dispatch_plate_number_idx').on(table.vehiclePlateNumber),
}))

export const dispatchRecordsRelations = relations(dispatchRecords, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [dispatchRecords.vehicleId],
    references: [vehicles.id],
  }),
  driver: one(drivers, {
    fields: [dispatchRecords.driverId],
    references: [drivers.id],
  }),
  route: one(routes, {
    fields: [dispatchRecords.routeId],
    references: [routes.id],
  }),
  operator: one(operators, {
    fields: [dispatchRecords.operatorId],
    references: [operators.id],
  }),
  user: one(users, {
    fields: [dispatchRecords.userId],
    references: [users.id],
  }),
  shift: one(shifts, {
    fields: [dispatchRecords.shiftId],
    references: [shifts.id],
  }),
}))

export type DispatchRecord = typeof dispatchRecords.$inferSelect
export type NewDispatchRecord = typeof dispatchRecords.$inferInsert
