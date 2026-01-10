import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { SignOptions } from 'jsonwebtoken'
import { db } from '../db/drizzle.js'
import { users } from '../db/schema/users.js'
import { eq } from 'drizzle-orm'
import { loginSchema, registerSchema } from '../utils/validation.js'

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!db) {
      res.status(500).json({ error: 'Database not initialized' })
      return
    }

    const validated = loginSchema.parse(req.body)
    const { usernameOrEmail, password } = validated

    console.log('Starting Drizzle ORM query for users...')
    const startTime = Date.now()

    // Query user by email (since schema uses email field)
    const [user] = await db.select().from(users).where(eq(users.email, usernameOrEmail))

    const queryTime = Date.now() - startTime
    console.log(`Drizzle ORM query completed in ${queryTime}ms`)

    if (!user) {
      console.log('User not found')
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    console.log(`User found: ${user.email}`)

    // Check if user is active
    if (user.isActive === false) {
      res.status(403).json({ error: 'Account is disabled' })
      return
    }

    // Verify password
    if (!user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
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
        username: user.email, // Use email as username
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
        username: user.email,
        fullName: user.name,
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
    if (!db) {
      res.status(500).json({ error: 'Database not initialized' })
      return
    }

    const validated = registerSchema.parse(req.body)
    const { username, password, fullName, email, phone, role } = validated

    // Set default role to 'user' if not provided
    const userRole = role || 'user'

    // Use email as username if not provided (compatibility)
    const userEmail = email || username

    // Check if email already exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, userEmail))

    if (existingUser) {
      res.status(409).json({ error: 'Email already exists' })
      return
    }

    // Hash password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create user in Drizzle
    const [newUser] = await db.insert(users).values({
      email: userEmail,
      passwordHash: passwordHash,
      name: fullName,
      phone: phone || null,
      role: userRole,
      isActive: true,
      emailVerified: false,
    }).returning()

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET!
    if (!jwtSecret) {
      res.status(500).json({ error: 'JWT secret not configured' })
      return
    }
    const token = jwt.sign(
      {
        id: newUser.id,
        username: newUser.email,
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
        username: newUser.email,
        fullName: newUser.name,
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
    if (!db) {
      res.status(500).json({ error: 'Database not initialized' })
      return
    }

    const authReq = req as any
    const userId = authReq.user?.id

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    // Query user by ID
    const [user] = await db.select().from(users).where(eq(users.id, userId))

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({
      id: user.id,
      username: user.email,
      fullName: user.name,
      email: user.email,
      role: user.role,
    })
  } catch (error) {
    console.error('Get current user error:', error)
    res.status(500).json({ error: 'Failed to get user' })
  }
}

