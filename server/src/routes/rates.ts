import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as rateController from '../controllers/rateController';

const router = Router();
router.use(authMiddleware);

router.get('/', rateController.listRates);
router.get('/current', rateController.getCurrentRates);
router.post('/import-csv', rateController.importRatesCsv);
router.post('/', rateController.createRate);
router.put('/:id', rateController.updateRate);
router.delete('/:id', rateController.deleteRate);

export default router;
