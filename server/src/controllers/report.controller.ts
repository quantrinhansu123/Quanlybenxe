import { Request, Response } from 'express'
import { firebase } from '../config/database.js'
import * as reportRepository from '../modules/report/report.repository.js'

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, operatorId, paymentStatus } = req.query

    let query = firebase
      .from('invoices')
      .select(`
        *,
        operators:operator_id(id, name, code)
      `)
      .gte('issue_date', startDate as string)
      .lte('issue_date', endDate as string)
      .order('issue_date', { ascending: false })

    if (operatorId) {
      query = query.eq('operator_id', operatorId as string)
    }
    if (paymentStatus) {
      query = query.eq('payment_status', paymentStatus as string)
    }

    const { data, error } = await query

    if (error) throw error

    const invoices = data.map((invoice: any) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      dispatchId: invoice.dispatch_record_id,
      operatorName: invoice.operators?.name || '',
      amount: parseFloat(invoice.total_amount) || 0,
      issueDate: invoice.issue_date,
      status: invoice.payment_status,
    }))

    return res.json(invoices)
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return res.status(500).json({ error: 'Failed to fetch invoices' })
  }
}

export const getVehicleLogs = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, vehicleId } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }

    const logs = await reportRepository.getVehicleLogs({
      startDate: startDate as string,
      endDate: endDate as string,
      vehicleId: vehicleId as string | undefined,
    })

    return res.json(logs)
  } catch (error) {
    console.error('Error fetching vehicle logs:', error)
    return res.status(500).json({ error: 'Failed to fetch vehicle logs' })
  }
}

export const getStationActivity = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }

    const activity = await reportRepository.getStationActivity({
      startDate: startDate as string,
      endDate: endDate as string,
    })

    return res.json(activity)
  } catch (error) {
    console.error('Error fetching station activity:', error)
    return res.status(500).json({ error: 'Failed to fetch station activity' })
  }
}

export const getInvalidVehicles = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }

    const invalidVehicles = await reportRepository.getInvalidVehicles({
      startDate: startDate as string,
      endDate: endDate as string,
    })

    return res.json(invalidVehicles)
  } catch (error) {
    console.error('Error fetching invalid vehicles:', error)
    return res.status(500).json({ error: 'Failed to fetch invalid vehicles' })
  }
}

export const getRevenue = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, operatorId } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }

    const revenue = await reportRepository.getRevenueSummary({
      startDate: startDate as string,
      endDate: endDate as string,
      operatorId: operatorId as string | undefined,
    })

    return res.json(revenue)
  } catch (error) {
    console.error('Error fetching revenue:', error)
    return res.status(500).json({ error: 'Failed to fetch revenue' })
  }
}

export const exportExcel = async (req: Request, res: Response) => {
  try {
    const { type: _type } = req.params
    const { startDate: _startDate, endDate: _endDate } = req.query

    // For now, return JSON. In production, you would use a library like exceljs
    // to generate actual Excel files
    return res.status(501).json({
      error: 'Excel export not yet implemented',
      message: 'This endpoint will generate Excel files in the future'
    })
  } catch (error) {
    console.error('Error exporting Excel:', error)
    return res.status(500).json({ error: 'Failed to export Excel' })
  }
}
