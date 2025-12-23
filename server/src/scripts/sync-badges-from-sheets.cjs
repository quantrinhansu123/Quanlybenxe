/**
 * Sync Vehicle Badges from Google Sheets to Firebase
 * Sheet: PHUHIEUXE
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
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1DCH1-efRqLMSXoIr_jm-5v_C1XpPrnWKultMp7FXn3g/gviz/tq?tqx=out:csv&gid=1560762265'

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
  const badges = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const obj = {}
    
    headers.forEach((header, idx) => {
      obj[header] = values[idx] || ''
    })
    
    const id = obj.ID_PhuHieu
    
    // Validate entry
    const isValidId = id && 
        id.length > 0 &&
        id.length < 50 && 
        !id.includes(':') &&
        !id.includes('→') &&
        !id.startsWith('•')
    
    if (isValidId) {
      badges.push(obj)
    }
  }
  
  return badges
}

// Convert sheet badge to Firebase format
function toFirebaseFormat(b) {
  return {
    id: b.ID_PhuHieu,
    file_number: b.MaHoSo || '',
    badge_type: fixEncoding(b.LoaiPH) || '',
    badge_number: b.SoPhuHieu || '',
    vehicle_id: b.BienSoXe || '', // This is actually IDXe reference
    warning_duplicate_plate: b.CanhBaoTrungBienSoKhiCapPH || '',
    issuing_authority_ref: b.Ref_DonViCapPhuHieu || '',
    business_license_ref: b.Ref_GPKD || '',
    notification_ref: b.Ref_ThongBao || '',
    route_ref: b.Ref_Tuyen || '',
    bus_route_ref: b.Ref_TuyenBuyt || '',
    issue_date: b.NgayCap || '',
    expiry_date: b.NgayHetHan || '',
    issue_type: fixEncoding(b.LoaiCap) || '',
    reissue_reason: fixEncoding(b.LyDoCapLai) || '',
    old_badge_number: b.SoPhuHieuCu || '',
    status: fixEncoding(b.TrangThai) || '',
    email_sent: b.GuiEmailbao === 'true' || b.GuiEmailbao === '1',
    revoke_decision: b.QDThuHoi || '',
    revoke_reason: fixEncoding(b.LyDoThuHoi) || '',
    revoke_date: b.NgayThuHoi || '',
    replacement_vehicle: b.XeThayThe || '',
    badge_color: fixEncoding(b.MauPhuHieu) || '',
    notes: fixEncoding(b.GhiChu) || '',
    user: b.User || '',
    import_time: b.ThoiGianNhap || '',
    need_reissue_popup: b.CanCapLaiPopup === 'true' || b.CanCapLaiPopup === '1',
    vehicle_replaced: b.Xebithaythe || '',
    issue_deadline: b.Hancap || '',
    source: 'google_sheets',
    synced_at: new Date().toISOString()
  }
}

async function syncBadges() {
  console.log('=== Syncing Vehicle Badges from Google Sheets ===\n')
  
  // Fetch CSV
  console.log('Fetching data from Google Sheets...')
  const csv = await fetchCSV(SHEET_URL)
  
  // Parse CSV
  const sheetBadges = parseCSV(csv)
  console.log(`Found ${sheetBadges.length} badges in sheet\n`)
  
  // Analyze data
  const badgeTypes = {}
  sheetBadges.forEach(b => {
    const type = fixEncoding(b.LoaiPH) || '(empty)'
    badgeTypes[type] = (badgeTypes[type] || 0) + 1
  })
  
  console.log('Badge types distribution:')
  Object.entries(badgeTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => console.log(`  ${count}: ${type}`))
  
  // Check for duplicates
  const badgeNums = {}
  let duplicates = 0
  sheetBadges.forEach(b => {
    if (b.SoPhuHieu) {
      if (badgeNums[b.SoPhuHieu]) duplicates++
      else badgeNums[b.SoPhuHieu] = true
    }
  })
  console.log(`\nUnique badge numbers: ${Object.keys(badgeNums).length}`)
  console.log(`Duplicate badge numbers: ${duplicates}`)
  
  // Count by status
  const statuses = {}
  sheetBadges.forEach(b => {
    const status = fixEncoding(b.TrangThai) || '(empty)'
    statuses[status] = (statuses[status] || 0) + 1
  })
  console.log('\nStatus distribution:')
  Object.entries(statuses)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => console.log(`  ${count}: ${status}`))
  
  // Convert to Firebase format
  const firebaseBadges = {}
  sheetBadges.forEach(b => {
    const fbB = toFirebaseFormat(b)
    firebaseBadges[b.ID_PhuHieu] = fbB
  })
  
  // Upload to Firebase
  console.log('\nUploading to Firebase (datasheet/PHUHIEUXE)...')
  await db.ref('datasheet/PHUHIEUXE').set(firebaseBadges)
  
  console.log(`\n✅ Successfully synced ${sheetBadges.length} badges to Firebase!`)
  
  // Show sample
  console.log('\nSample badges:')
  sheetBadges.slice(0, 3).forEach((b, i) => {
    console.log(`${i + 1}. ${b.SoPhuHieu} - ${b.LoaiPH}`)
    console.log(`   Vehicle: ${b.BienSoXe}, Status: ${b.TrangThai}`)
  })
  
  process.exit(0)
}

// Run
syncBadges().catch(err => {
  console.error('Error syncing badges:', err)
  process.exit(1)
})
