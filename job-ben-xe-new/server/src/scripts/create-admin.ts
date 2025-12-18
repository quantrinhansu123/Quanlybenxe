import bcrypt from 'bcryptjs'
import { firebaseDb } from '../config/database.js'
import dotenv from 'dotenv'

dotenv.config()

// Helper function to generate Firebase-style ID
function generateId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `${timestamp}-${randomPart}`
}

async function createAdmin() {
  const username = process.argv[2] || 'admin'
  const password = process.argv[3] || 'admin123'
  const fullName = process.argv[4] || 'Administrator'

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Get all users to check if username exists
    const users = await firebaseDb.get('users')
    
    let existingUser: any = null
    let existingUserId: string | null = null
    
    if (users) {
      const usersArray = Object.keys(users).map(key => ({
        id: key,
        ...users[key]
      }))
      existingUser = usersArray.find((u: any) => u.username === username)
      if (existingUser) {
        existingUserId = existingUser.id
      }
    }

    if (existingUser) {
      console.log(`User "${username}" already exists. Updating password...`)
      await firebaseDb.update(`users/${existingUserId}`, {
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      })
      console.log(`✅ Password updated for user "${username}"`)
    } else {
      // Create new user
      const userId = generateId()
      const newUser = {
        id: userId,
        username,
        password_hash: passwordHash,
        full_name: fullName,
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      await firebaseDb.set(`users/${userId}`, newUser)
      console.log(`✅ Admin user created successfully!`)
      console.log(`   Username: ${username}`)
      console.log(`   Full Name: ${fullName}`)
      console.log(`   Role: admin`)
    }
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error creating admin user:', error)
    process.exit(1)
  }
}

createAdmin()

