/**
 * Import Invoices from Firebase Export
 * Level 4: Depends on dispatch_records, operators
 */
import { db } from '../../drizzle'
import { invoices } from '../../schema'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  storeIdMapping,
  getPostgresId,
  normalizeStatus,
  parseDate,
  logProgress,
  ensureDbInitialized,
} from './etl-helpers'

interface FirebaseInvoice {
  _firebase_id: string
  id: string
  invoice_number?: string
  dispatch_id?: string
  operator_id?: string
  amount?: number
  tax_amount?: number
  total_amount?: number
  status?: string
  issued_at?: string
  paid_at?: string
  notes?: string
  metadata?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export async function importInvoices(exportDir: string): Promise<number> {
  ensureDbInitialized()

  const filePath = join(exportDir, 'invoices.json')
  let data: FirebaseInvoice[]

  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    console.log('  ⚠ invoices.json not found, skipping...')
    return 0
  }

  console.log(`  Importing ${data.length} invoices...`)

  let imported = 0
  let skipped = 0

  for (let i = 0; i < data.length; i++) {
    const item = data[i]

    try {
      const dispatchId = await getPostgresId(item.dispatch_id, 'dispatch_records')
      const operatorId = await getPostgresId(item.operator_id, 'operators')

      const [inserted] = await db!.insert(invoices).values({
        firebaseId: item._firebase_id || item.id,
        invoiceNumber: (item.invoice_number || `INV-${item.id}`).substring(0, 50),
        dispatchId,
        operatorId,
        amount: item.amount || 0,
        taxAmount: item.tax_amount || null,
        totalAmount: item.total_amount || item.amount || 0,
        status: normalizeStatus(item.status, 'pending'),
        issuedAt: parseDate(item.issued_at),
        paidAt: parseDate(item.paid_at),
        notes: item.notes || null,
        metadata: item.metadata || null,
        createdAt: parseDate(item.created_at) || new Date(),
        updatedAt: parseDate(item.updated_at) || new Date(),
      }).returning()

      await storeIdMapping(item._firebase_id || item.id, inserted.id, 'invoices')
      imported++
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (!message.includes('duplicate')) {
        console.log(`\n  ✗ Failed: ${item.id} - ${message}`)
      }
      skipped++
    }

    if (i % 100 === 0) {
      logProgress(i + 1, data.length, 'invoices')
    }
  }

  console.log(`\n  ✓ Invoices: ${imported} imported, ${skipped} skipped`)
  return imported
}
