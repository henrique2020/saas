import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  tokenVersion?: number;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number; role?: string; tokenVersion?: number };
    req.userId = decoded.userId;
    req.userRole = decoded.role || 'USER';
    req.tokenVersion = decoded.tokenVersion || 1;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
