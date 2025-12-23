/**
 * Sync Operators from Google Sheets to Firebase
 * Sheet: THONGTINDONVIVANTAI
 * URL: https://docs.google.com/spreadsheets/d/1DCH1-efRqLMSXoIr_jm-5v_C1XpPrnWKultMp7FXn3g
 */

const admin = require('firebase-admin')
const https = require('https')
const path = require('path')

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
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1DCH1-efRqLMSXoIr_jm-5v_C1XpPrnWKultMp7FXn3g/gviz/tq?tqx=out:csv&sheet=THONGTINDONVIVANTAI'

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
  const operators = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const obj = {}
    
    headers.forEach((header, idx) => {
      obj[header] = values[idx] || ''
    })
    
    // Skip empty rows and invalid IDs
    // Firebase keys can't contain ".", "#", "$", "/", "[", or "]"
    const id = obj.IDDoanhNghiep
    const name = obj.TenDoanhNghiep
    
    // Validate ID - must be alphanumeric and not contain special prefixes
    const isValidId = id && 
        id.length > 0 &&
        id.length < 50 && 
        !id.includes(',') && 
        !id.includes('.') && 
        !id.includes('#') && 
        !id.includes('$') && 
        !id.includes('/') && 
        !id.includes('[') && 
        !id.includes(']') &&
        !id.includes(':') &&      // Exclude keys like "CQCapDKKD: ..."
        !id.includes('→') &&      // Exclude keys with arrow
        !id.startsWith('•') &&    // Exclude bullet points
        !id.startsWith('DiaChi') &&
        !id.startsWith('SoNha') &&
        !id.startsWith('CQCap')
    
    // Validate name - must have actual content
    const isValidName = name && name.trim().length > 2
    
    if (isValidId && isValidName) {
      operators.push(obj)
    }
  }
  
  return operators
}

// Convert sheet operator to Firebase format
function toFirebaseFormat(op) {
  // Build full address
  const addressParts = [
    op.SoNha_TDP,
    op.XaPhuongThiTran,
    op.QuanHuyen,
    op.TinhThanh
  ].filter(p => p && p.trim())
  
  return {
    id: op.IDDoanhNghiep,
    name: op.TenDoanhNghiep,
    province: op.TinhThanh || '',
    district: op.QuanHuyen || '',
    ward: op.XaPhuongThiTran || '',
    address: op.SoNha_TDP || '',
    full_address: op.DiachiDayDu || addressParts.join(', '),
    phone: op.SoDienThoai || '',
    email: op.Email || '',
    tax_code: op.MaSoThue || '',
    business_license: op.SoDKKD || '',
    business_license_date: op.NgayCap || '',
    business_license_authority: op.CQCapDKKD || '',
    representative_name: op.NguoiDaiDienTheoPhapLuat || '',
    business_type: op.LoaiHinh || '',
    registration_province: op.TinhDangKyHoatDong || '',
    source: 'google_sheets',
    synced_at: new Date().toISOString()
  }
}

async function syncOperators() {
  console.log('=== Syncing Operators from Google Sheets ===\n')
  
  // Fetch CSV
  console.log('Fetching data from Google Sheets...')
  const csv = await fetchCSV(SHEET_URL)
  
  // Parse CSV
  const sheetOperators = parseCSV(csv)
  console.log(`Found ${sheetOperators.length} operators in sheet\n`)
  
  // Analyze data
  const provinceStats = {}
  const bacNinhCount = { inside: 0, outside: 0 }
  
  sheetOperators.forEach(op => {
    const prov = op.TinhThanh || '(empty)'
    provinceStats[prov] = (provinceStats[prov] || 0) + 1
    
    if (op.TinhThanh?.includes('Bắc Ninh')) {
      bacNinhCount.inside++
    } else if (op.TinhThanh) {
      bacNinhCount.outside++
    }
  })
  
  console.log('Province distribution:')
  Object.entries(provinceStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([prov, count]) => console.log(`  ${count}: ${prov}`))
  
  console.log(`\nBắc Ninh summary:`)
  console.log(`  Inside Bắc Ninh: ${bacNinhCount.inside}`)
  console.log(`  Outside Bắc Ninh: ${bacNinhCount.outside}`)
  
  // Convert to Firebase format
  const firebaseOperators = {}
  sheetOperators.forEach(op => {
    const fbOp = toFirebaseFormat(op)
    firebaseOperators[op.IDDoanhNghiep] = fbOp
  })
  
  // Upload to Firebase
  console.log('\nUploading to Firebase (datasheet/DONVIVANTAI)...')
  await db.ref('datasheet/DONVIVANTAI').set(firebaseOperators)
  
  console.log(`\n✅ Successfully synced ${sheetOperators.length} operators to Firebase!`)
  
  // Show sample
  console.log('\nSample operators:')
  sheetOperators.slice(0, 5).forEach((op, i) => {
    console.log(`${i + 1}. ${op.TenDoanhNghiep.substring(0, 50)}`)
    console.log(`   Province: ${op.TinhThanh}, District: ${op.QuanHuyen}`)
  })
  
  process.exit(0)
}

// Run
syncOperators().catch(err => {
  console.error('Error syncing operators:', err)
  process.exit(1)
})
