import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as fixedIncomeController from '../controllers/fixedIncomeController';

const router = Router();
router.use(authMiddleware);

router.get('/', fixedIncomeController.listFixedIncome);
router.post('/', fixedIncomeController.createFixedIncome);
router.post('/import-csv', fixedIncomeController.importFixedIncomeCsv);
router.put('/:id', fixedIncomeController.updateFixedIncome);
router.patch('/:id/settle', fixedIncomeController.settleFixedIncome);
router.delete('/:id', fixedIncomeController.deleteFixedIncome);

// Aportes
router.post('/:id/contributions', fixedIncomeController.addContribution);
router.put('/:id/contributions/:contributionId', fixedIncomeController.updateContribution);
router.delete('/:id/contributions/:contributionId', fixedIncomeController.deleteContribution);

export default router;
