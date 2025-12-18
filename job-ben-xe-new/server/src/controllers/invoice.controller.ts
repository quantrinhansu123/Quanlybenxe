import { Request, Response } from 'express'
import { supabase } from '../config/database.js'
import { z } from 'zod'

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  dispatchRecordId: z.string().uuid().optional(),
  operatorId: z.string().uuid('Invalid operator ID'),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().optional(),
  subtotal: z.number().nonnegative('Subtotal must be non-negative'),
  taxAmount: z.number().nonnegative('Tax amount must be non-negative').default(0),
  totalAmount: z.number().nonnegative('Total amount must be non-negative'),
  notes: z.string().optional(),
})

export const getAllInvoices = async (req: Request, res: Response) => {
  try {
    const { operatorId, paymentStatus, startDate, endDate } = req.query

    let query = supabase
      .from('invoices')
      .select(`
        *,
        operators:operator_id(id, name, code)
      `)
      .order('issue_date', { ascending: false })

    if (operatorId) {
      query = query.eq('operator_id', operatorId as string)
    }
    if (paymentStatus) {
      query = query.eq('payment_status', paymentStatus as string)
    }
    if (startDate) {
      query = query.gte('issue_date', startDate as string)
    }
    if (endDate) {
      query = query.lte('issue_date', endDate as string)
    }

    const { data, error } = await query

    if (error) throw error

    const invoices = data.map((invoice: any) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      dispatchRecordId: invoice.dispatch_record_id,
      operatorId: invoice.operator_id,
      operator: invoice.operators ? {
        id: invoice.operators.id,
        name: invoice.operators.name,
        code: invoice.operators.code,
      } : undefined,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      subtotal: parseFloat(invoice.subtotal),
      taxAmount: parseFloat(invoice.tax_amount),
      totalAmount: parseFloat(invoice.total_amount),
      paymentStatus: invoice.payment_status,
      paymentDate: invoice.payment_date,
      notes: invoice.notes,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at,
    }))

    return res.json(invoices)
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return res.status(500).json({ error: 'Failed to fetch invoices' })
  }
}

export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        operators:operator_id(id, name, code)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    return res.json({
      id: data.id,
      invoiceNumber: data.invoice_number,
      dispatchRecordId: data.dispatch_record_id,
      operatorId: data.operator_id,
      operator: data.operators ? {
        id: data.operators.id,
        name: data.operators.name,
        code: data.operators.code,
      } : undefined,
      issueDate: data.issue_date,
      dueDate: data.due_date,
      subtotal: parseFloat(data.subtotal),
      taxAmount: parseFloat(data.tax_amount),
      totalAmount: parseFloat(data.total_amount),
      paymentStatus: data.payment_status,
      paymentDate: data.payment_date,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return res.status(500).json({ error: 'Failed to fetch invoice' })
  }
}

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const validated = invoiceSchema.parse(req.body)

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: validated.invoiceNumber,
        dispatch_record_id: validated.dispatchRecordId || null,
        operator_id: validated.operatorId,
        issue_date: validated.issueDate,
        due_date: validated.dueDate || null,
        subtotal: validated.subtotal,
        tax_amount: validated.taxAmount || 0,
        total_amount: validated.totalAmount,
        payment_status: 'pending',
        notes: validated.notes || null,
      })
      .select(`
        *,
        operators:operator_id(id, name, code)
      `)
      .single()

    if (error) throw error

    return res.status(201).json({
      id: data.id,
      invoiceNumber: data.invoice_number,
      dispatchRecordId: data.dispatch_record_id,
      operatorId: data.operator_id,
      operator: data.operators ? {
        id: data.operators.id,
        name: data.operators.name,
        code: data.operators.code,
      } : undefined,
      issueDate: data.issue_date,
      dueDate: data.due_date,
      subtotal: parseFloat(data.subtotal),
      taxAmount: parseFloat(data.tax_amount),
      totalAmount: parseFloat(data.total_amount),
      paymentStatus: data.payment_status,
      paymentDate: data.payment_date,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    console.error('Error creating invoice:', error)
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Invoice with this number already exists' })
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create invoice' })
  }
}

export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const validated = invoiceSchema.partial().parse(req.body)

    const updateData: any = {}
    if (validated.invoiceNumber) updateData.invoice_number = validated.invoiceNumber
    if (validated.dispatchRecordId !== undefined) updateData.dispatch_record_id = validated.dispatchRecordId || null
    if (validated.operatorId) updateData.operator_id = validated.operatorId
    if (validated.issueDate) updateData.issue_date = validated.issueDate
    if (validated.dueDate !== undefined) updateData.due_date = validated.dueDate || null
    if (validated.subtotal !== undefined) updateData.subtotal = validated.subtotal
    if (validated.taxAmount !== undefined) updateData.tax_amount = validated.taxAmount
    if (validated.totalAmount !== undefined) updateData.total_amount = validated.totalAmount
    if (validated.notes !== undefined) updateData.notes = validated.notes || null

    const { data, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        operators:operator_id(id, name, code)
      `)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    return res.json({
      id: data.id,
      invoiceNumber: data.invoice_number,
      dispatchRecordId: data.dispatch_record_id,
      operatorId: data.operator_id,
      operator: data.operators ? {
        id: data.operators.id,
        name: data.operators.name,
        code: data.operators.code,
      } : undefined,
      issueDate: data.issue_date,
      dueDate: data.due_date,
      subtotal: parseFloat(data.subtotal),
      taxAmount: parseFloat(data.tax_amount),
      totalAmount: parseFloat(data.total_amount),
      paymentStatus: data.payment_status,
      paymentDate: data.payment_date,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    console.error('Error updating invoice:', error)
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to update invoice' })
  }
}

export const updateInvoicePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { paymentStatus, paymentDate } = req.body

    if (!paymentStatus || !['pending', 'paid', 'overdue', 'cancelled'].includes(paymentStatus)) {
      return res.status(400).json({ error: 'Invalid payment status' })
    }

    const updateData: any = {
      payment_status: paymentStatus,
    }

    if (paymentStatus === 'paid' && paymentDate) {
      updateData.payment_date = paymentDate
    } else if (paymentStatus !== 'paid') {
      updateData.payment_date = null
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        operators:operator_id(id, name, code)
      `)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    return res.json({
      id: data.id,
      invoiceNumber: data.invoice_number,
      dispatchRecordId: data.dispatch_record_id,
      operatorId: data.operator_id,
      operator: data.operators ? {
        id: data.operators.id,
        name: data.operators.name,
        code: data.operators.code,
      } : undefined,
      issueDate: data.issue_date,
      dueDate: data.due_date,
      subtotal: parseFloat(data.subtotal),
      taxAmount: parseFloat(data.tax_amount),
      totalAmount: parseFloat(data.total_amount),
      paymentStatus: data.payment_status,
      paymentDate: data.payment_date,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    console.error('Error updating invoice payment:', error)
    return res.status(500).json({ error: error.message || 'Failed to update invoice payment' })
  }
}

