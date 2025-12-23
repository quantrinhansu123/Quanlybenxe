/**
 * Sync Routes from Google Sheets to Firebase
 * Sheet: DANHMUCTUYENCODINH (gid=328499076)
 * URL: https://docs.google.com/spreadsheets/d/1DCH1-efRqLMSXoIr_jm-5v_C1XpPrnWKultMp7FXn3g
 */

const admin = require('firebase-admin')
const https = require('https')

// Initialize Firebase Admin
const serviceAccount = require('../../firebase-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://benxe-management-20251218-default-rtdb.asia-southeast1.firebasedatabase.app'
  })
}

const db = admin.database()

// gviz API works fine for this sheet
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1DCH1-efRqLMSXoIr_jm-5v_C1XpPrnWKultMp7FXn3g/gviz/tq?tqx=out:csv&gid=328499076'

// Fix common Unicode encoding issues
function fixEncoding(str) {
  if (!str) return str
  return str
    // Bắc Ninh fixes
    .replace(/B��c/g, 'Bắc')
    .replace(/B���c/g, 'Bắc')
    // Đã công bố fixes
    .replace(/Đ��/g, 'Đã')
    .replace(/Đ���/g, 'Đã')
    .replace(/��ã/g, 'Đã')
    .replace(/c��ng/g, 'công')
    .replace(/c���ng/g, 'công')
    .replace(/b���/g, 'bố')
    .replace(/b��/g, 'bố')
    // Tuyến fixes
    .replace(/Tuy��n/g, 'Tuyến')
    .replace(/Tuy���n/g, 'Tuyến')
    // Other common fixes
    .replace(/Li��n/g, 'Liên')
    .replace(/Li���n/g, 'Liên')
    .replace(/t��nh/g, 'tỉnh')
    .replace(/t���nh/g, 'tỉnh')
    .replace(/đ���ng/g, 'đồng')
    .replace(/đ��ng/g, 'đồng')
    .trim()
}

// Parse CSV line handling quoted values
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  
  return result
}

// Fetch CSV from Google Sheets (with redirect support for published URLs)
function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    const http = require('http')
    
    const makeRequest = (reqUrl) => {
      const protocol = reqUrl.startsWith('https') ? https : http
      
      protocol.get(reqUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          makeRequest(res.headers.location)
          return
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => resolve(data))
        res.on('error', reject)
      }).on('error', reject)
    }
    makeRequest(url)
  })
}

// Parse CSV to objects
function parseCSV(csv) {
  const lines = csv.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  
  const headers = parseCSVLine(lines[0])
  const routes = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const obj = {}
    
    headers.forEach((header, idx) => {
      obj[header] = values[idx] || ''
    })
    
    const routeCode = obj.MaSoTuyen || obj.MaSoTuyen_Fix
    
    // Validate entry - must have route code
    const isValid = routeCode && 
        routeCode.length > 0 &&
        routeCode.length < 100 && 
        !routeCode.includes(':') &&
        !routeCode.startsWith('•')
    
    if (isValid) {
      routes.push(obj)
    }
  }
  
  return routes
}

// Convert sheet route to Firebase format
function toFirebaseFormat(r) {
  return {
    id: r.MaSoTuyen || r.MaSoTuyen_Fix,
    route_code: r.MaSoTuyen || r.MaSoTuyen_Fix || '',
    route_code_old: r.MaSoTuyen_Cu || '',
    original_info: r.ThongTinTuyenGoc || '',
    departure_province: fixEncoding(r.TinhDi) || '',
    arrival_province: fixEncoding(r.TinhDen) || '',
    departure_station: fixEncoding(r.BenDi) || '',
    departure_station_ref: r.BenDi_Ref || '',
    arrival_station: fixEncoding(r.BenDen) || '',
    arrival_station_ref: r.BenDen_Ref || '',
    itinerary: fixEncoding(r.HanhTrinh) || '',
    route_type: fixEncoding(r.PhanLoaiTuyen) || '',
    operation_status: fixEncoding(r.TinhTrangKhaiThac) || '',
    distance_km: r.CuLyTuyen_km ? parseFloat(r.CuLyTuyen_km) || 0 : 0,
    total_trips_per_month: r.TongChuyenThang ? parseInt(r.TongChuyenThang) || 0 : 0,
    trips_operated: r.ChuyenDaKhaiThac ? parseInt(r.ChuyenDaKhaiThac) || 0 : 0,
    remaining_capacity: r.LuuLuongConLai ? parseInt(r.LuuLuongConLai) || 0 : 0,
    min_interval_minutes: r.GianCachToiThieu_phut ? parseInt(r.GianCachToiThieu_phut) || 0 : 0,
    decision_number: r.SoQuyetDinh || '',
    decision_date: r.NgayBanHanh || '',
    issuing_authority: fixEncoding(r.DonViBanHanh) || '',
    document_file: r.File || '',
    calendar_type: r.Kieulich || '',
    notes: fixEncoding(r.Ghichu) || '',
    user: r.User || '',
    import_time: r.ThoiGianNhap || '',
    source: 'google_sheets',
    synced_at: new Date().toISOString()
  }
}

// Generate a valid Firebase key from route code
function toFirebaseKey(routeCode) {
  // Replace invalid characters: . # $ / [ ]
  return routeCode
    .replace(/\./g, '_')
    .replace(/#/g, '_')
    .replace(/\$/g, '_')
    .replace(/\//g, '_')
    .replace(/\[/g, '_')
    .replace(/\]/g, '_')
}

async function syncRoutes() {
  console.log('=== Syncing Routes from Google Sheets ===\n')
  
  // Fetch CSV
  console.log('Fetching data from Google Sheets...')
  const csv = await fetchCSV(SHEET_URL)
  
  // Parse CSV
  const sheetRoutes = parseCSV(csv)
  console.log(`Found ${sheetRoutes.length} routes in sheet\n`)
  
  // Analyze data
  const routeTypes = {}
  sheetRoutes.forEach(r => {
    const type = fixEncoding(r.PhanLoaiTuyen) || '(empty)'
    routeTypes[type] = (routeTypes[type] || 0) + 1
  })
  
  console.log('Route types distribution:')
  Object.entries(routeTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => console.log(`  ${count}: ${type}`))
  
  // Operation status
  const statuses = {}
  sheetRoutes.forEach(r => {
    const status = fixEncoding(r.TinhTrangKhaiThac) || '(empty)'
    statuses[status] = (statuses[status] || 0) + 1
  })
  
  console.log('\nOperation status distribution:')
  Object.entries(statuses)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => console.log(`  ${count}: ${status}`))
  
  // Convert to Firebase format
  const firebaseRoutes = {}
  sheetRoutes.forEach(r => {
    const fbRoute = toFirebaseFormat(r)
    const key = toFirebaseKey(fbRoute.route_code)
    firebaseRoutes[key] = fbRoute
  })
  
  // Upload to Firebase
  console.log('\nUploading to Firebase (datasheet/DANHMUCTUYENCODINH)...')
  await db.ref('datasheet/DANHMUCTUYENCODINH').set(firebaseRoutes)
  
  console.log(`\n✅ Successfully synced ${sheetRoutes.length} routes to Firebase!`)
  
  // Show sample
  console.log('\nSample routes:')
  sheetRoutes.slice(0, 3).forEach((r, i) => {
    console.log(`${i + 1}. ${r.MaSoTuyen} - ${r.TinhDi} → ${r.TinhDen}`)
    console.log(`   Type: ${r.PhanLoaiTuyen}, Status: ${r.TinhTrangKhaiThac}`)
  })
  
  process.exit(0)
}

// Run
syncRoutes().catch(err => {
  console.error('Error syncing routes:', err)
  process.exit(1)
})
