# Controller Migration Notes

## Migrated Controllers (Drizzle ORM)

✅ **operator.controller.ts** - Hoàn tất
- Tất cả CRUD operations đã migrate
- Legacy functions (getLegacyOperators, updateLegacyOperator, deleteLegacyOperator) vẫn sử dụng Firebase RTDB

✅ **shift.controller.ts** - Hoàn tất
- Tất cả CRUD operations đã migrate
- Soft delete implemented

✅ **auth.controller.ts** - Hoàn tất
- Login, register, getCurrentUser đã migrate
- Schema users sử dụng email thay vì username

## Pending Controllers (Cần Schema Bổ Sung)

❌ **route.controller.ts** - Chưa migrate
**Lý do**: Cần các schema sau:
- `route_stops` - Bảng lưu điểm dừng trên tuyến
- `locations` - Bảng địa điểm/bến xe
- Cần foreign key references trong schema routes

**Dependencies**:
```typescript
// Cần tạo schema cho:
export const locations = pgTable('locations', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  code: varchar('code', { length: 50 }),
  // ... other fields
})

export const routeStops = pgTable('route_stops', {
  id: uuid('id').primaryKey(),
  routeId: uuid('route_id').references(() => routes.id),
  locationId: uuid('location_id').references(() => locations.id),
  stopOrder: integer('stop_order'),
  distanceFromOriginKm: integer('distance_from_origin_km'),
  estimatedMinutesFromOrigin: integer('estimated_minutes_from_origin'),
  // ... other fields
})
```

❌ **schedule.controller.ts** - Chưa migrate
**Lý do**: Không có schema `schedules.ts` trong db/schema/

**Cần tạo**:
```typescript
// server/src/db/schema/schedules.ts
export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey(),
  scheduleCode: varchar('schedule_code', { length: 50 }),
  routeId: uuid('route_id').references(() => routes.id),
  operatorId: uuid('operator_id').references(() => operators.id),
  departureTime: time('departure_time'),
  frequencyType: varchar('frequency_type', { length: 20 }),
  daysOfWeek: jsonb('days_of_week'),
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

## Next Steps

1. Tạo missing schemas:
   - locations.ts
   - route-stops.ts
   - schedules.ts

2. Cập nhật routes.ts schema:
   - Thêm originId và destinationId foreign keys
   - Thêm relationship với locations

3. Migrate route.controller.ts sau khi schemas ready

4. Migrate schedule.controller.ts sau khi schema ready

5. Test tất cả migrated controllers với Drizzle ORM
