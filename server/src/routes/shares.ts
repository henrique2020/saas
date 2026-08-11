import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as shareController from '../controllers/shareController';

const router = Router();
router.use(authMiddleware);

router.get('/incoming', shareController.listIncomingShares);
router.get('/outgoing', shareController.listOutgoingShares);
router.post('/outgoing', shareController.createOutgoingShare);
router.post('/confirm', shareController.confirmShare);
router.delete('/:id', shareController.deleteShare);

// Visualização compartilhada
router.get('/:id/summary', shareController.getSharedSummary);
router.get('/:id/dividends-monthly', shareController.getSharedDividendsMonthly);
router.get('/:id/stock/:ticker', shareController.getSharedStockDetail);

export default router;
