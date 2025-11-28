import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Acesso negado. Token não fornecido.'
    })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string
      email: string
    }

    req.userId = String(decoded.id)
    next()
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Token inválido ou expirado.'
    })
  }
}

// exporta como nomeado e como default
export { authMiddleware }
export default authMiddleware
