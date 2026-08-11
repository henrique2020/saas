import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as transactionController from '../controllers/transactionController';

const router = Router();
router.use(authMiddleware);

router.get('/', transactionController.listTransactions);
router.post('/', transactionController.createTransaction);
router.put('/:id', transactionController.updateTransaction);
router.delete('/:id', transactionController.deleteTransaction);
router.post('/import-csv', transactionController.importTransactionsCsv);

export default router;
