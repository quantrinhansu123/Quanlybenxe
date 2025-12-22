import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { errorHandler } from './middleware/errorHandler.js'

// Routes
import authRoutes from './routes/auth.routes.js'
import driverRoutes from './modules/fleet/driver.routes.js'
import vehicleRoutes from './modules/fleet/vehicle.routes.js'
import operatorRoutes from './routes/operator.routes.js'
import locationRoutes from './routes/location.routes.js'
import routeRoutes from './routes/route.routes.js'
import scheduleRoutes from './routes/schedule.routes.js'
import vehicleTypeRoutes from './routes/vehicle-type.routes.js'
import shiftRoutes from './routes/shift.routes.js'
import dispatchRoutes from './modules/dispatch/dispatch.routes.js'
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
import chatRoutes from './modules/chat/chat.routes.js'

dotenv.config()

const app = express()
// Use APP_PORT instead of PORT (reserved in Firebase Functions)
const PORT = Number(process.env.APP_PORT) || 3000

// CORS Configuration - Allow Firebase Hosting and common domains
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://benxe-management-20251218.web.app',
  'https://benxe-management-20251218.firebaseapp.com',
]

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) {
      return callback(null, true)
    }

    // Normalize request origin (remove trailing slash)
    const normalizedOrigin = origin.replace(/\/$/, '')

    // Allow localhost in any environment
    if (normalizedOrigin.includes('localhost') || normalizedOrigin.includes('127.0.0.1')) {
      return callback(null, true)
    }

    // Allow Firebase Hosting domains
    if (normalizedOrigin.includes('.web.app') || normalizedOrigin.includes('.firebaseapp.com')) {
      return callback(null, true)
    }

    // Check explicit allowed origins
    if (ALLOWED_ORIGINS.includes(normalizedOrigin)) {
      return callback(null, true)
    }

    // Allow any origin from env CORS_ORIGIN
    const envOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim())
    if (envOrigins.includes(normalizedOrigin)) {
      return callback(null, true)
    }

    callback(new Error('Not allowed by CORS'))
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
app.use('/api/chat', chatRoutes)

// Error handling
app.use(errorHandler)

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' })
})

// Export app for Firebase Functions
export { app }

// Start server only when running directly (not as Cloud Function or being analyzed)
// Check multiple environment variables that indicate we're in a Cloud Function context
const isCloudFunction = process.env.FUNCTION_TARGET ||
                        process.env.K_SERVICE ||
                        process.env.FUNCTIONS_EMULATOR ||
                        process.env.GCLOUD_PROJECT ||
                        process.env.FIREBASE_CONFIG

// Also check if this module is being required/imported (not run directly)
const isMainModule = process.argv[1]?.includes('index.js') || process.argv[1]?.includes('index.ts')

if (!isCloudFunction && isMainModule) {
  // Import and test Firebase connection on startup
  import('./config/database.js').then(async ({ testFirebaseConnection }) => {
    const isConnected = await testFirebaseConnection()
    if (!isConnected) {
      console.error('========================================')
      console.error('WARNING: Firebase connection failed!')
      console.error('API calls to database will fail.')
      console.error('Please check:')
      console.error('  1. SERVICE_ACCOUNT_PATH points to valid JSON file')
      console.error('  2. RTDB_URL is correct')
      console.error('  3. Service account has database access')
      console.error('========================================')
    }

    // Preload cache for faster first requests
    try {
      const { cachedData } = await import('./services/cached-data.service.js')
      await cachedData.preloadCommonData()
    } catch (error) {
      console.warn('[Cache] Failed to preload:', error)
    }
    
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`)
      console.log(`API available at http://localhost:${PORT}/api`)
      console.log(`Health check: http://localhost:${PORT}/health`)
    })
  }).catch((error) => {
    console.error('Failed to import database config:', error)
    process.exit(1)
  })
}

