import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboardController';

const router = Router();
router.use(authMiddleware);

router.get('/summary', dashboardController.getSummary);
router.get('/dividends-monthly', dashboardController.getDividendsMonthly);
router.get('/dividends-grouped', dashboardController.getDividendsGrouped);
router.get('/closed-positions', dashboardController.getClosedPositions);
router.get('/pnl-overview', dashboardController.getPnLOverview);
router.get('/movements', dashboardController.getMovements);
router.get('/stock-detail/:ticker', dashboardController.getStockDetail);
router.get('/stock/:ticker', dashboardController.getStockDetail);
router.get('/stock/:ticker/evolution', dashboardController.getStockEvolution);

export default router;
