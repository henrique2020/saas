// Padroniza o fuso horário de toda a aplicação para Brasília (America/Sao_Paulo)
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import dividendRoutes from './routes/dividends';
import rateRoutes from './routes/rates';
import fixedIncomeRoutes from './routes/fixedIncome';
import stockRoutes from './routes/stocks';
import dashboardRoutes from './routes/dashboard';
import shareRoutes from './routes/shares';
import auditLogRoutes from './routes/auditLogs';
import { startPriceSyncCron } from './jobs/priceSync';
import { startDividendSyncCron } from './jobs/dividendSync';
import { authLimiter, apiLimiter } from './middleware/rateLimit';
import { routeLogger } from './middleware/routeLogger';
import { syncStockCategories } from './utils/stockCategory';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Logging & Rate limiting
app.use('/api', routeLogger);
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dividends', dividendRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/fixed-income', fixedIncomeRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/audit-logs', auditLogRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startPriceSyncCron();
  startDividendSyncCron();
  syncStockCategories();
});

export default app;
