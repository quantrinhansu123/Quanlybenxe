/**
 * Database Performance Benchmark Script
 * Measures query performance for common operations
 */
import 'dotenv/config'
import { db } from '../db/drizzle.js'
import { dispatchRecords, vehicles, drivers, operators } from '../db/schema/index.js'
import { eq, and, gte, sql, desc } from 'drizzle-orm'

interface BenchmarkResult {
  name: string
  duration: number
  recordCount: number
}

async function runBenchmarks() {
  if (!db) {
    console.error('[Benchmark] Database not initialized. Check DATABASE_URL.')
    process.exit(1)
  }

  console.log('⚡ Running performance benchmarks...\n')
  const results: BenchmarkResult[] = []

  // Benchmark 1: Simple select all (with limit)
  let start = Date.now()
  const all = await db.select().from(dispatchRecords).limit(1000)
  results.push({
    name: 'Select dispatch_records (limit 1000)',
    duration: Date.now() - start,
    recordCount: all.length,
  })

  // Benchmark 2: Filtered query by status
  start = Date.now()
  const filtered = await db
    .select()
    .from(dispatchRecords)
    .where(eq(dispatchRecords.status, 'departed'))
    .limit(500)
  results.push({
    name: 'Filter by status (departed)',
    duration: Date.now() - start,
    recordCount: filtered.length,
  })

  // Benchmark 3: Date range query (last 30 days)
  start = Date.now()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const dateRange = await db
    .select()
    .from(dispatchRecords)
    .where(gte(dispatchRecords.entryTime, thirtyDaysAgo))
    .limit(500)
  results.push({
    name: 'Date range (last 30 days)',
    duration: Date.now() - start,
    recordCount: dateRange.length,
  })

  // Benchmark 4: Join query (Report pattern)
  start = Date.now()
  const joined = await db
    .select({
      id: dispatchRecords.id,
      vehicleId: dispatchRecords.vehicleId,
      plateNumber: vehicles.plateNumber,
      driverName: drivers.fullName,
      operatorName: operators.name,
      entryTime: dispatchRecords.entryTime,
      status: dispatchRecords.status,
    })
    .from(dispatchRecords)
    .leftJoin(vehicles, eq(dispatchRecords.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(dispatchRecords.driverId, drivers.id))
    .leftJoin(operators, eq(dispatchRecords.operatorId, operators.id))
    .orderBy(desc(dispatchRecords.entryTime))
    .limit(100)
  results.push({
    name: 'JOIN query (4 tables)',
    duration: Date.now() - start,
    recordCount: joined.length,
  })

  // Benchmark 5: Aggregation - Count by status
  start = Date.now()
  const statusCounts = await db
    .select({
      status: dispatchRecords.status,
      count: sql<number>`count(*)::int`,
    })
    .from(dispatchRecords)
    .groupBy(dispatchRecords.status)
  results.push({
    name: 'Aggregation (count by status)',
    duration: Date.now() - start,
    recordCount: statusCounts.length,
  })

  // Benchmark 6: Aggregation - Revenue by date
  start = Date.now()
  const revenueByDate = await db
    .select({
      date: sql<string>`DATE(entry_time)`,
      count: sql<number>`count(*)::int`,
      totalRevenue: sql<number>`COALESCE(sum(payment_amount), 0)::int`,
    })
    .from(dispatchRecords)
    .where(eq(dispatchRecords.status, 'departed'))
    .groupBy(sql`DATE(entry_time)`)
    .orderBy(desc(sql`DATE(entry_time)`))
    .limit(30)
  results.push({
    name: 'Revenue aggregation (30 days)',
    duration: Date.now() - start,
    recordCount: revenueByDate.length,
  })

  // Benchmark 7: Single record lookup by ID
  if (all.length > 0) {
    start = Date.now()
    const single = await db
      .select()
      .from(dispatchRecords)
      .where(eq(dispatchRecords.id, all[0].id))
      .limit(1)
    results.push({
      name: 'Single record by ID',
      duration: Date.now() - start,
      recordCount: single.length,
    })
  }

  // Benchmark 8: Complex filter (multiple conditions)
  start = Date.now()
  const complex = await db
    .select()
    .from(dispatchRecords)
    .where(and(
      eq(dispatchRecords.status, 'departed'),
      gte(dispatchRecords.entryTime, thirtyDaysAgo),
      sql`${dispatchRecords.paymentAmount} > 0`
    ))
    .orderBy(desc(dispatchRecords.entryTime))
    .limit(100)
  results.push({
    name: 'Complex filter (status + date + payment)',
    duration: Date.now() - start,
    recordCount: complex.length,
  })

  // Print results
  console.log('Results:')
  console.log('─'.repeat(70))
  console.log('| Query'.padEnd(45) + '| Time'.padEnd(12) + '| Records |')
  console.log('─'.repeat(70))

  let totalDuration = 0
  for (const r of results) {
    console.log(
      `| ${r.name.padEnd(43)}| ${(r.duration + 'ms').padEnd(10)}| ${String(r.recordCount).padEnd(7)} |`
    )
    totalDuration += r.duration
  }

  console.log('─'.repeat(70))
  console.log(`\nTotal benchmark time: ${totalDuration}ms`)
  console.log(`Average query time: ${Math.round(totalDuration / results.length)}ms`)

  // Performance targets
  console.log('\n📊 Performance Targets:')
  const targets = [
    { name: 'Simple queries', target: 100, actual: results[0]?.duration || 0 },
    { name: 'Filtered queries', target: 200, actual: results[1]?.duration || 0 },
    { name: 'JOIN queries', target: 500, actual: results[3]?.duration || 0 },
    { name: 'Single lookup', target: 50, actual: results[6]?.duration || 0 },
  ]

  for (const t of targets) {
    const status = t.actual <= t.target ? '✅' : '⚠️'
    console.log(`${status} ${t.name}: ${t.actual}ms (target: <${t.target}ms)`)
  }

  process.exit(0)
}

runBenchmarks().catch((error) => {
  console.error('Benchmark failed:', error)
  process.exit(1)
})
