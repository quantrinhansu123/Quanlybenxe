import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: {
    id: string
    username: string
    role: string
  }
  body: any
  headers: any
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.substring(7)
    const jwtSecret = process.env.JWT_SECRET!

    if (!jwtSecret) {
      return res.status(500).json({ error: 'JWT secret not configured' })
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      id: string
      username: string
      role: string
    }

    req.user = decoded
    return next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    return res.status(500).json({ error: 'Authentication error' })
  }
}

