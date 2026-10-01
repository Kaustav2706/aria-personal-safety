import { Router } from 'express';
import { getReportById, handleLegacyReportDownload } from '../controllers/report.controller.js';

const router = Router();

// GET /api/reports/:id (or /api/reports/report_:id.pdf)
router.get('/:id', getReportById);

export { handleLegacyReportDownload };
export default router;
