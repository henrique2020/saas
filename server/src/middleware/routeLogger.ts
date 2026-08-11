import { Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'routes.log');

export function routeLogger(req: AuthRequest, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl, ip } = req;
    const status = res.statusCode;
    const userId = req.userId || null;
    const userAgent = req.get('user-agent') || '';
    const timestamp = new Date().toISOString();

    const logLine = `[${timestamp}] ${method} ${originalUrl} ${status} ${duration}ms - IP: ${ip || '-'} - User: ${userId || 'guest'}\n`;

    // Write to routes.log file
    fs.appendFile(logFilePath, logLine, (err) => {
      if (err) console.error('Erro ao escrever no routes.log:', err);
    });

    // Save to route_logs DB table (non-blocking)
    prisma.routeLog
      .create({
        data: {
          userId,
          method,
          path: originalUrl.slice(0, 255),
          status,
          duration,
          ip: ip ? ip.slice(0, 45) : null,
          userAgent: userAgent ? userAgent.slice(0, 255) : null,
        },
      })
      .catch((err) => {
        // Silently swallow log DB insertion errors to avoid impacting main app logic
      });
  });

  next();
}
