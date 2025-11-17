import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extender a interface Request para incluir o user (payload JWT)
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Acesso negado. Token não fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string, email: string };
    
    // Adiciona o ID do usuário decodificado à requisição
    req.userId = String(decoded.id); 
    next();
  } catch (error) {
    // Token expirado ou inválido
    return res.status(401).json({ status: 'error', message: 'Token inválido ou expirado.' });
  }
};

export default authMiddleware;