import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { SignOptions } from 'jsonwebtoken'
import { db, firebaseDb } from '../config/database.js'
import { loginSchema, registerSchema } from '../utils/validation.js'

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = loginSchema.parse(req.body)
    const { usernameOrEmail, password } = validated

    // Use Firebase Admin SDK for authentication
    console.log('Starting Firebase Admin SDK query for users...')
    let allUsers: any = null
    try {
      const startTime = Date.now()
      allUsers = await firebaseDb.get('users')
      const queryTime = Date.now() - startTime
      console.log(`Firebase Admin SDK query completed in ${queryTime}ms`)
      console.log(`Found ${allUsers ? Object.keys(allUsers).length : 0} users`)
    } catch (error: any) {
      console.error('Firebase Admin SDK query error:', error)
      res.status(500).json({ error: 'Database connection error', details: error.message })
      return
    }

    if (!allUsers) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // Convert to array and find user
    const usersArray = Object.keys(allUsers).map(key => ({
      id: key,
      ...allUsers[key]
    }))

    // Try to find user by username first
    console.log(`Looking for user with usernameOrEmail: ${usernameOrEmail}`)
    let user = usersArray.find(u => u.username === usernameOrEmail)

    // If not found by username, try to find by email
    if (!user) {
      user = usersArray.find(u => u.email === usernameOrEmail)
    }

    if (!user) {
      console.log('User not found')
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    console.log(`User found: ${user.username}`)

    // Check if user is active
    if (user.is_active === false) {
      res.status(403).json({ error: 'Account is disabled' })
      return
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET!
    if (!jwtSecret) {
      res.status(500).json({ error: 'JWT secret not configured' })
      return
    }
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      jwtSecret,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      } as SignOptions
    )

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
      return
    }
    res.status(500).json({ error: 'Login failed' })
  }
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = registerSchema.parse(req.body)
    const { username, password, fullName, email, phone, role } = validated

    // Set default role to 'user' if not provided
    const userRole = role || 'user'

    if (!db) {
      res.status(500).json({ error: 'Database connection error' })
      return
    }

    // Check if username already exists - query directly from Firebase
    const snapshot = await db.ref('users').once('value')
    const allUsers = snapshot.val() || {}
    const usersArray = Object.keys(allUsers).map(key => ({
      id: key,
      ...allUsers[key]
    }))

    const existingUser = usersArray.find(u => u.username === username)
    if (existingUser) {
      res.status(409).json({ error: 'Username already exists' })
      return
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = usersArray.find(u => u.email === email)
      if (existingEmail) {
        res.status(409).json({ error: 'Email already exists' })
        return
      }
    }

    // Hash password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Generate ID
    const userId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 15)}`

    // Create user in Firebase
    const newUser = {
      id: userId,
      username,
      password_hash: passwordHash,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      role: userRole,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await db.ref(`users/${userId}`).set(newUser)

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET!
    if (!jwtSecret) {
      res.status(500).json({ error: 'JWT secret not configured' })
      return
    }
    const token = jwt.sign(
      {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
      },
      jwtSecret,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      } as SignOptions
    )

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.full_name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
      },
    })
  } catch (error) {
    console.error('Register error:', error)
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
      return
    }
    res.status(500).json({ error: 'Registration failed' })
  }
}

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any
    const userId = authReq.user?.id

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    // Use Firebase Admin SDK
    const allUsers = await firebaseDb.get('users')

    if (!allUsers) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    // Find user by ID
    const userKey = Object.keys(allUsers).find(key => {
      const u = allUsers[key]
      return u.id === userId || key === userId
    })

    if (!userKey) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const userData = allUsers[userKey]
    res.json({
      id: userData.id || userKey,
      username: userData.username,
      fullName: userData.full_name,
      email: userData.email,
      role: userData.role,
    })
  } catch (error) {
    console.error('Get current user error:', error)
    res.status(500).json({ error: 'Failed to get user' })
  }
}

