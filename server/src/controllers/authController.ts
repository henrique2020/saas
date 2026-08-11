import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

function generateAccessToken(userId: number, role: string, tokenVersion: number = 1): string {
  return jwt.sign({ userId, role, tokenVersion }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  } as jwt.SignOptions);
}

function generateRefreshToken(userId: number, tokenVersion: number = 1): string {
  return jwt.sign({ userId, tokenVersion }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Email já cadastrado' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const usersCount = await prisma.user.count();
    const role = usersCount === 0 ? 'ADMIN' : 'USER';

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, tokenVersion: 1 },
    });

    await prisma.portfolio.create({
      data: { userId: user.id, name: 'Principal' },
    });

    const accessToken = generateAccessToken(user.id, user.role, user.tokenVersion);
    const refreshToken = generateRefreshToken(user.id, user.tokenVersion);

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email e senha são obrigatórios' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const accessToken = generateAccessToken(user.id, user.role, user.tokenVersion);
    const refreshToken = generateRefreshToken(user.id, user.tokenVersion);

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Refresh token é obrigatório' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { userId: number; tokenVersion?: number };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { role: true, tokenVersion: true } });
    
    if (!user || (decoded.tokenVersion && decoded.tokenVersion !== user.tokenVersion)) {
      res.status(401).json({ error: 'Refresh token inválido ou revogado' });
      return;
    }

    const accessToken = generateAccessToken(decoded.userId, user.role, user.tokenVersion);

    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Refresh token inválido' });
  }
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, email } = req.body;

    if (!name && !email) {
      res.status(400).json({ error: 'Informe nome ou email para atualizar' });
      return;
    }

    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, id: { not: req.userId } },
      });
      if (existing) {
        res.status(409).json({ error: 'Email já está em uso por outra conta' });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Senha atual e nova senha são obrigatórios' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Senha atual incorreta' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    // Incrementa tokenVersion para revogar tokens antigos
    await prisma.user.update({
      where: { id: req.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
