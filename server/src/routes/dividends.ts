import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as dividendController from '../controllers/dividendController';

const router = Router();
router.use(authMiddleware);

// Tabela central (admin)
router.get('/stock-dividends', dividendController.listStockDividends);
router.post('/stock-dividends', dividendController.createStockDividend);
router.put('/stock-dividends/:id', dividendController.updateStockDividend);
router.delete('/stock-dividends/:id', dividendController.deleteStockDividend);
router.post('/stock-dividends/import-csv', dividendController.importStockDividendsCsv);

// Lançamentos manuais do usuário
router.get('/manual', dividendController.listManualUserDividends);
router.post('/manual', dividendController.createManualUserDividend);
router.put('/manual/:id', dividendController.updateManualUserDividend);
router.delete('/manual/:id', dividendController.deleteManualUserDividend);

// Visão consolidada calculada
router.get('/', dividendController.getUserDividends);

export default router;
