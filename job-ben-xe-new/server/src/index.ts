import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { errorHandler } from './middleware/errorHandler.js'

// Routes
import authRoutes from './routes/auth.routes.js'
import driverRoutes from './routes/driver.routes.js'
import vehicleRoutes from './routes/vehicle.routes.js'
import operatorRoutes from './routes/operator.routes.js'
import locationRoutes from './routes/location.routes.js'
import routeRoutes from './routes/route.routes.js'
import scheduleRoutes from './routes/schedule.routes.js'
import vehicleTypeRoutes from './routes/vehicle-type.routes.js'
import shiftRoutes from './routes/shift.routes.js'
import dispatchRoutes from './routes/dispatch.routes.js'
import violationRoutes from './routes/violation.routes.js'
import invoiceRoutes from './routes/invoice.routes.js'
import serviceChargeRoutes from './routes/service-charge.routes.js'
import serviceRoutes from './routes/service.routes.js'
import serviceFormulaRoutes from './routes/service-formula.routes.js'
import reportRoutes from './routes/report.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import uploadRoutes from './routes/upload.routes.js'
import vehicleBadgeRoutes from './routes/vehicle-badge.routes.js'
import provinceRoutes from './routes/province.routes.js'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 3000

// CORS Configuration
const getCorsOrigins = (): string | string[] => {
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'

  // Support multiple origins separated by comma
  if (corsOrigin.includes(',')) {
    // Normalize each origin (remove trailing slash)
    return corsOrigin.split(',').map(origin => origin.trim().replace(/\/$/, ''))
  }

  // Normalize single origin (remove trailing slash)
  return corsOrigin.trim().replace(/\/$/, '')
}

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = getCorsOrigins()
    const originsArray = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins]

    // Normalize request origin (remove trailing slash)
    const normalizedOrigin = origin ? origin.replace(/\/$/, '') : null

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!normalizedOrigin) {
      return callback(null, true)
    }

    // In development, allow all localhost origins
    const isDevMode = process.env.NODE_ENV !== 'production'
    const isLocalhost = normalizedOrigin.includes('localhost') || normalizedOrigin.includes('127.0.0.1')

    if (isDevMode && isLocalhost) {
      return callback(null, true)
    }

    // Check if origin is allowed
    if (originsArray.includes(normalizedOrigin)) {
      // Return true to allow the origin
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/drivers', driverRoutes)
app.use('/api/vehicles', vehicleRoutes)
app.use('/api/operators', operatorRoutes)
app.use('/api/locations', locationRoutes)
app.use('/api/routes', routeRoutes)
app.use('/api/schedules', scheduleRoutes)
app.use('/api/vehicle-types', vehicleTypeRoutes)
app.use('/api/shifts', shiftRoutes)
app.use('/api/dispatch', dispatchRoutes)
app.use('/api/violations', violationRoutes)
app.use('/api/invoices', invoiceRoutes)
app.use('/api/service-charges', serviceChargeRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/service-formulas', serviceFormulaRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/vehicle-badges', vehicleBadgeRoutes)
app.use('/api/provinces', provinceRoutes)

// Error handling
app.use(errorHandler)

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`)
  console.log(`📝 API available at http://localhost:${PORT}/api`)
  console.log(`🏥 Health check: http://localhost:${PORT}/health`)
})

