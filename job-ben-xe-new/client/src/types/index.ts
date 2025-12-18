// User types
export interface User {
  id: string
  username: string
  fullName: string
  role: 'admin' | 'dispatcher' | 'accountant' | 'reporter'
  email?: string
  phone?: string
}

export interface LoginCredentials {
  usernameOrEmail: string
  password: string
  rememberMe?: boolean
}

export interface RegisterCredentials {
  username: string
  password: string
  fullName: string
  email?: string
  phone?: string
  role?: 'admin' | 'dispatcher' | 'accountant' | 'reporter'
}

// Operator types
export interface Operator {
  id: string
  name: string
  code: string
  taxCode?: string
  
  isTicketDelegated: boolean
  province?: string
  district?: string
  address?: string
  
  phone?: string
  email?: string
  representativeName?: string
  representativePosition?: string
  
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface OperatorInput {
  name: string
  code: string
  taxCode?: string
  
  isTicketDelegated?: boolean
  province?: string
  district?: string
  address?: string
  
  phone?: string
  email?: string
  representativeName?: string
  representativePosition?: string
}

// Vehicle Type types
export interface VehicleType {
  id: string
  name: string
  description?: string
  createdAt?: string
}

export interface VehicleTypeInput {
  name: string
  description?: string
}

// Vehicle types
export interface Vehicle {
  id: string
  plateNumber: string
  vehicleTypeId?: string
  vehicleType?: VehicleType
  operatorId: string
  operator?: Operator
  seatCapacity: number
  bedCapacity?: number
  manufactureYear?: number
  chassisNumber?: string
  engineNumber?: string
  color?: string
  imageUrl?: string
  
  insuranceExpiryDate?: string
  inspectionExpiryDate?: string
  
  cargoLength?: number
  cargoWidth?: number
  cargoHeight?: number
  
  gpsProvider?: string
  gpsUsername?: string
  gpsPassword?: string
  
  province?: string

  isActive: boolean
  notes?: string
  documents?: VehicleDocuments
  createdAt?: string
  updatedAt?: string
}

export interface VehicleDocuments {
  registration?: DocumentInfo
  inspection?: DocumentInfo
  insurance?: DocumentInfo
  operation_permit?: DocumentInfo
  emblem?: DocumentInfo
}

export interface DocumentInfo {
  number: string
  issueDate: string
  expiryDate: string
  issuingAuthority?: string
  documentUrl?: string
  notes?: string
  isValid: boolean
}

export interface VehicleInput {
  plateNumber: string
  vehicleTypeId?: string
  operatorId: string
  seatCapacity: number
  bedCapacity?: number
  manufactureYear?: number
  chassisNumber?: string
  engineNumber?: string
  color?: string
  imageUrl?: string
  
  insuranceExpiryDate?: string
  inspectionExpiryDate?: string
  
  cargoLength?: number
  cargoWidth?: number
  cargoHeight?: number
  
  gpsProvider?: string
  gpsUsername?: string
  gpsPassword?: string
  
  province?: string

  notes?: string
  documents?: VehicleDocuments
}

// Driver types
export interface Driver {
  id: string
  operatorId: string // Keep for backward compatibility
  operator?: Operator // Keep for backward compatibility
  operatorIds?: string[] // Array of operator IDs
  operators?: Array<Operator & { isPrimary?: boolean }> // Array of operators with primary flag
  fullName: string
  idNumber: string
  phone?: string
  province?: string
  district?: string
  address?: string
  licenseNumber: string
  licenseClass: string
  licenseExpiryDate: string
  imageUrl?: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface DriverInput {
  operatorIds: string[] // Array of operator IDs (at least one required)
  fullName: string
  idNumber: string
  phone?: string
  province?: string
  district?: string
  address?: string
  licenseNumber: string
  licenseClass: string
  licenseExpiryDate: string
  imageUrl?: string
}

// Location types
export interface Location {
  id: string
  name: string
  code: string
  stationType?: string
  phone?: string
  email?: string
  address?: string
  latitude?: number
  longitude?: number
  isActive: boolean
  createdAt?: string
}

export interface LocationInput {
  name: string
  code: string
  stationType?: string
  phone?: string
  email?: string
  address?: string
  latitude?: number
  longitude?: number
}

// Route types
export interface Route {
  id: string
  routeCode: string
  routeName: string
  routeType?: string
  originId: string
  origin?: Location
  destinationId: string
  destination?: Location
  distanceKm?: number
  estimatedDurationMinutes?: number
  
  plannedFrequency?: string
  boardingPoint?: string
  journeyDescription?: string
  departureTimesDescription?: string
  restStops?: string
  
  isActive: boolean
  stops?: RouteStop[]
  createdAt?: string
  updatedAt?: string
}

export interface RouteStop {
  id: string
  routeId: string
  locationId: string
  location?: Location
  stopOrder: number
  distanceFromOriginKm?: number
  estimatedMinutesFromOrigin?: number
  createdAt?: string
}

export interface RouteInput {
  routeCode: string
  routeName: string
  originId: string
  destinationId: string
  distanceKm?: number
  estimatedDurationMinutes?: number
  
  plannedFrequency?: string
  boardingPoint?: string
  journeyDescription?: string
  departureTimesDescription?: string
  restStops?: string
  
  stops?: Omit<RouteStop, 'id' | 'routeId' | 'createdAt'>[]
}

// Schedule types
export interface Schedule {
  id: string
  scheduleCode: string
  routeId: string
  route?: Route
  operatorId: string
  operator?: Operator
  departureTime: string
  frequencyType: 'daily' | 'weekly' | 'specific_days'
  daysOfWeek?: number[]
  effectiveFrom: string
  effectiveTo?: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ScheduleInput {
  scheduleCode?: string // Optional - will be auto-generated if not provided
  routeId: string
  operatorId: string
  departureTime: string
  frequencyType: 'daily' | 'weekly' | 'specific_days'
  daysOfWeek?: number[]
  effectiveFrom: string
  effectiveTo?: string
}

// Dispatch types
export type DispatchStatus =
  | 'entered'
  | 'passengers_dropped'
  | 'permit_issued'
  | 'permit_rejected'
  | 'paid'
  | 'departure_ordered'
  | 'departed'

export type PermitStatus = 'approved' | 'rejected' | 'pending'
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card'

export interface DispatchRecord {
  id: string
  vehicleId: string
  vehicle?: Vehicle
  vehiclePlateNumber: string
  driverId: string
  driver?: Driver
  driverName: string
  scheduleId?: string
  schedule?: Schedule
  routeId: string
  route?: Route
  routeName: string
  
  // Entry
  entryTime: string
  entryBy?: string
  
  // Passenger drop-off
  passengerDropTime?: string
  passengersArrived?: number
  passengerDropBy?: string
  
  // Boarding permit
  boardingPermitTime?: string
  plannedDepartureTime?: string
  transportOrderCode?: string
  seatCount?: number
  permitStatus?: PermitStatus
  rejectionReason?: string
  boardingPermitBy?: string
  
  // Payment
  paymentTime?: string
  paymentAmount?: number
  paymentMethod?: PaymentMethod
  invoiceNumber?: string
  paymentBy?: string
  
  // Departure order
  departureOrderTime?: string
  passengersDeparting?: number
  departureOrderBy?: string
  
  // Exit
  exitTime?: string
  exitBy?: string
  
  // Status
  currentStatus: DispatchStatus
  notes?: string
  metadata?: Record<string, any>
  createdAt?: string
  updatedAt?: string
}

export interface DispatchInput {
  vehicleId: string
  driverId: string
  scheduleId?: string
  routeId?: string
  entryTime: string
  notes?: string
  entryShiftId?: string
}

// Violation types
export interface ViolationType {
  id: string
  code: string
  name: string
  description?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  createdAt?: string
}

export interface Violation {
  id: string
  dispatchRecordId?: string
  vehicleId?: string
  driverId?: string
  violationTypeId: string
  violationType?: ViolationType
  violationDate: string
  description?: string
  resolutionStatus: 'pending' | 'resolved' | 'dismissed'
  resolutionNotes?: string
  recordedBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface ViolationInput {
  dispatchRecordId?: string
  vehicleId?: string
  driverId?: string
  violationTypeId: string
  violationDate: string
  description?: string
}

// Service types
export interface ServiceType {
  id: string
  code: string
  name: string
  description?: string
  basePrice: number
  unit?: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ServiceCharge {
  id: string
  dispatchRecordId: string
  serviceTypeId: string
  serviceType?: ServiceType
  quantity: number
  unitPrice: number
  totalAmount: number
  createdAt?: string
}

export interface ServiceChargeInput {
  dispatchRecordId: string
  serviceTypeId: string
  quantity?: number
  unitPrice: number
  totalAmount: number
}

// Service Management types (Quản lý dịch vụ)
export interface Service {
  id: string
  code: string // Mã dịch vụ
  name: string // Tên dịch vụ
  unit: string // Đơn vị tính
  taxPercentage: number // Phần trăm thuế
  materialType: string // Loại vật tư/hàng hóa
  useQuantityFormula: boolean // Sử dụng công thức tính số lượng
  usePriceFormula: boolean // Sử dụng công thức tính đơn giá
  displayOrder: number // Thứ tự hiển thị
  isDefault: boolean // Mặc định chọn
  autoCalculateQuantity: boolean // Tự động tính số lượng
  isActive: boolean // Trạng thái
  quantityFormulaExpression?: string // ID biểu thức tính số lượng
  priceFormulaExpression?: string // ID biểu thức tính đơn giá
  createdAt?: string
  updatedAt?: string
}

export interface ServiceInput {
  code: string
  name: string
  unit: string
  taxPercentage: number
  materialType: string
  useQuantityFormula: boolean
  usePriceFormula: boolean
  displayOrder: number
  isDefault: boolean
  autoCalculateQuantity: boolean
}

// Service Formula types (Quản lý biểu thức)
export interface ServiceFormula {
  id: string
  code: string // Mã biểu thức
  name: string // Tên biểu thức
  description?: string // Ghi chú
  formulaType: 'quantity' | 'price' // Loại biểu thức: tính số lượng hoặc tính đơn giá
  formulaExpression?: string // Biểu thức công thức
  isActive: boolean // Trạng thái
  usageCount?: number // Số lượng dịch vụ đang sử dụng (từ view)
  usedByServices?: string // Danh sách dịch vụ đang sử dụng (từ view)
  createdAt?: string
  updatedAt?: string
}

export interface ServiceFormulaInput {
  code: string
  name: string
  description?: string
  formulaType: 'quantity' | 'price'
  formulaExpression?: string
  isActive?: boolean
}

// Invoice types
export interface Invoice {
  id: string
  invoiceNumber: string
  dispatchRecordId?: string
  operatorId: string
  operator?: Operator
  issueDate: string
  dueDate?: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  paymentStatus: 'pending' | 'paid' | 'overdue' | 'cancelled'
  paymentDate?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export interface InvoiceInput {
  invoiceNumber: string
  dispatchRecordId?: string
  operatorId: string
  issueDate: string
  dueDate?: string
  subtotal: number
  taxAmount?: number
  totalAmount: number
  notes?: string
}

// Report types
export interface ReportFilter {
  startDate: string
  endDate: string
  vehicleId?: string
  driverId?: string
  operatorId?: string
  routeId?: string
  status?: DispatchStatus
}

export interface RevenueReport {
  date: string
  totalRevenue: number
  vehicleCount: number
  transactionCount: number
}

export interface InvoiceReport {
  id: string
  invoiceNumber: string
  dispatchId: string
  operatorName: string
  amount: number
  issueDate: string
  status: string
}

// Vehicle Badge types (Phù hiệu xe)
export interface VehicleBadge {
  id: string
  badge_color: string
  badge_number: string
  badge_type: string
  bus_route_ref: string
  business_license_ref: string
  created_at: string
  created_by: string
  email_notification_sent: boolean
  expiry_date: string
  file_code: string
  issue_date: string
  issue_type: string
  license_plate_sheet: string
  notes: string
  notification_ref: string
  previous_badge_number: string
  renewal_due_date: string
  renewal_reason: string
  renewal_reminder_shown: boolean
  replacement_vehicle_id: string
  revocation_date: string
  revocation_decision: string
  revocation_reason: string
  route_id: string
  status: string
  vehicle_id: string
  warn_duplicate_plate: boolean
}
