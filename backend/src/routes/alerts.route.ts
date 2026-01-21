import { Router, Request, Response } from 'express';
import db from '../services/database.service.js';
import logger from '../utils/logger.js';

// Type alias for string-based enums (SQLite doesn't support native enums)
type AlertStatus = 'PENDING' | 'CONFIRMED' | 'IGNORED' | 'EXPIRED';

const router = Router();

// GET /api/alerts - List alerts with filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      status,
      relationId,
      limit = '50',
      offset = '0',
    } = req.query;

    const options = {
      status: status as AlertStatus | undefined,
      relationId: relationId as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    const { data, total } = await db.getAlerts(options);

    res.json({
      success: true,
      data,
      total,
      limit: options.limit,
      offset: options.offset,
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
    });
  }
});

// GET /api/alerts/pending - Get pending alerts
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const { data, total } = await db.getAlerts({
      status: 'PENDING',
      limit: 100,
    });

    res.json({
      success: true,
      data,
      total,
    });
  } catch (error) {
    logger.error('Error fetching pending alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending alerts',
    });
  }
});

// GET /api/alerts/:id - Get alert details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const alert = await db.getAlertById(id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    // Get pending defense if exists
    const pendingDefense = await db.getPendingDefense(alert.reviewId);

    res.json({
      success: true,
      data: {
        ...alert,
        pendingDefense,
      },
    });
  } catch (error) {
    logger.error('Error fetching alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert',
    });
  }
});

// PATCH /api/alerts/:id - Update alert status
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['PENDING', 'CONFIRMED', 'IGNORED', 'EXPIRED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    const alert = await db.updateAlertStatus(id, status as AlertStatus);

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    logger.error('Error updating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert',
    });
  }
});

export default router;
