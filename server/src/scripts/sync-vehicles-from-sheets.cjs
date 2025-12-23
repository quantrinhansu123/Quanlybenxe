/**
 * Sync Vehicles from Google Sheets to Firebase
 * Sheet: XE
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

// Use published CSV URL (has latest data including SoCho)
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRXpInp695vx7UfmwC5-2lc2IgsgaXxsRlWZsfrDRHmTNvWDwOzdW1OXTTyR66BBtJJCjEHXOqqfCY5/pub?output=csv&gid=40001005'

// Fix common Unicode encoding issues
function fixEncoding(str) {
  if (!str) return str
  return str
    .replace(/Lo���i/g, 'Loại')
    .replace(/Lo��i/g, 'Loại')
    .replace(/kh��c/g, 'khác')
    .replace(/đ���ng/g, 'đồng')
    .replace(/đ��ng/g, 'đồng')
    .replace(/H��p/g, 'Hợp')
    .replace(/c��� /g, 'cố ')
    .replace(/t��i/g, 'tải')
    .replace(/t���i/g, 'tải')
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

// Fetch CSV from Google Sheets (with redirect support)
function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    const http = require('http')
    
    const makeRequest = (reqUrl) => {
      const protocol = reqUrl.startsWith('https') ? https : http
      
      protocol.get(reqUrl, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          const redirectUrl = res.headers.location
          console.log('Redirecting to:', redirectUrl.substring(0, 60) + '...')
          makeRequest(redirectUrl)
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
  const vehicles = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const obj = {}
    
    headers.forEach((header, idx) => {
      obj[header] = values[idx] || ''
    })
    
    const id = obj.IDXe
    const plateNumber = obj.BienSo
    
    // Validate entry
    const isValidId = id && 
        id.length > 0 &&
        id.length < 50 && 
        !id.includes(':') &&
        !id.includes('→') &&
        !id.startsWith('•')
    
    // Must have either ID or plate number
    if (isValidId) {
      vehicles.push(obj)
    }
  }
  
  return vehicles
}

// Parse seat count from various formats: "6", "6 Người", "45", etc.
function parseSeatCount(value) {
  if (!value) return 0;
  const str = String(value).trim();
  // Extract first number from string (handles "6 Người", "45", "4 Người", etc.)
  const match = str.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Convert sheet vehicle to Firebase format
function toFirebaseFormat(v) {
  return {
    id: v.IDXe,
    plate_number: v.BienSo || '',
    owner_name: fixEncoding(v.TenDangKyXe) || '',
    owner_address: fixEncoding(v.DiaChiChuXe) || '',
    manufacturer: fixEncoding(v.NhanHieu) || '',
    vehicle_type: fixEncoding(v.LoaiXe) || '',
    vehicle_category: fixEncoding(v.LoaiPhuongTien) || '',
    chassis_number: v.SoKhung || '',
    engine_number: v.SoMay || '',
    seat_count: parseSeatCount(v.SoCho),
    load_capacity: v.TaiTrong ? parseInt(v.TaiTrong) || 0 : 0,
    color: fixEncoding(v.MauSon) || '',
    manufacture_year: v.NamSanXuat ? parseInt(v.NamSanXuat) || 0 : 0,
    validity_years: v.NienHan || '',
    is_identified_plate: v.LaBienDinhDanh === 'true' || v.LaBienDinhDanh === '1',
    identified_plate_status: fixEncoding(v.TrangThaiBienDinhDanh) || '',
    identified_plate_revoke_reason: fixEncoding(v.LyDoThuBienDinhDanh) || '',
    registration_info: fixEncoding(v.ThongTinDangKyXe) || '',
    has_transport_business: v.CoKDVT === 'true' || v.CoKDVT === '1',
    user: v.User || '',
    import_time: v.ThoiGianNhap || '',
    source: 'google_sheets',
    synced_at: new Date().toISOString()
  }
}

async function syncVehicles() {
  console.log('=== Syncing Vehicles from Google Sheets ===\n')
  
  // Fetch CSV
  console.log('Fetching data from Google Sheets...')
  const csv = await fetchCSV(SHEET_URL)
  
  // Parse CSV
  const sheetVehicles = parseCSV(csv)
  console.log(`Found ${sheetVehicles.length} vehicles in sheet\n`)
  
  // Analyze data
  const vehicleTypes = {}
  sheetVehicles.forEach(v => {
    const type = fixEncoding(v.LoaiXe) || '(empty)'
    vehicleTypes[type] = (vehicleTypes[type] || 0) + 1
  })
  
  console.log('Vehicle types distribution:')
  Object.entries(vehicleTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([type, count]) => console.log(`  ${count}: ${type}`))
  
  // Check for duplicates
  const plates = {}
  let duplicates = 0
  sheetVehicles.forEach(v => {
    if (v.BienSo) {
      if (plates[v.BienSo]) duplicates++
      else plates[v.BienSo] = true
    }
  })
  console.log(`\nUnique plate numbers: ${Object.keys(plates).length}`)
  console.log(`Duplicate plates: ${duplicates}`)
  
  // Convert to Firebase format
  const firebaseVehicles = {}
  sheetVehicles.forEach(v => {
    const fbV = toFirebaseFormat(v)
    firebaseVehicles[v.IDXe] = fbV
  })
  
  // Upload to Firebase
  console.log('\nUploading to Firebase (datasheet/Xe)...')
  await db.ref('datasheet/Xe').set(firebaseVehicles)
  
  console.log(`\n✅ Successfully synced ${sheetVehicles.length} vehicles to Firebase!`)
  
  // Show sample
  console.log('\nSample vehicles:')
  sheetVehicles.slice(0, 3).forEach((v, i) => {
    console.log(`${i + 1}. ${v.BienSo} - ${v.TenDangKyXe?.substring(0, 40)}`)
    console.log(`   Type: ${v.LoaiXe}, Manufacturer: ${v.NhanHieu}`)
  })
  
  process.exit(0)
}

// Run
syncVehicles().catch(err => {
  console.error('Error syncing vehicles:', err)
  process.exit(1)
})
