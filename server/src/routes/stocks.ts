import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as stockController from '../controllers/stockController';

const router = Router();
router.use(authMiddleware);

router.get('/search', stockController.searchStocks);
router.get('/:ticker/quote', stockController.getStockQuote);
router.get('/:ticker/dividends-external', stockController.getExternalDividends);
router.get('/:ticker/history', stockController.getStockHistory);
router.get('/', stockController.listUserStocks);

// Admin
router.get('/admin/api-usage', stockController.getApiUsageStats);
router.post('/admin/sync-month', stockController.syncMonthPrices);

export default router;
