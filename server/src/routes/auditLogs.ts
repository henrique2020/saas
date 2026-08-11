import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as auditLogController from '../controllers/auditLogController';

const router = Router();
router.use(authMiddleware);

router.get('/', auditLogController.listAuditLogs);

export default router;
