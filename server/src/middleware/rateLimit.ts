import rateLimit from 'express-rate-limit';

const isLocalhost = (ip: string | undefined): boolean => {
  if (!ip) return false;
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
};

// Strict limiter for auth endpoints (login/register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isLocalhost(req.ip as string | undefined),
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
});

// General API limiter
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isLocalhost(req.ip as string | undefined),
  message: { error: 'Limite de requisições excedido. Tente novamente em instantes.' },
});
