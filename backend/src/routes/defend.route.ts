import { Router, Request, Response } from 'express';
import db from '../services/database.service.js';
import monitorService from '../services/monitor.service.js';
import logger from '../utils/logger.js';
import { z } from 'zod';
import { getRandomDefenseMessage } from '../models/types.js';

const router = Router();

// Validation schema
const defendSchema = z.object({
  targetUserkey: z.string().min(1),
  score: z.number().min(-5).max(5),
  comment: z.string().min(1).max(1000),
  reviewId: z.string().optional(),
  alertId: z.string().optional(),
});

// POST /api/defend - Post a defense review
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = defendSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.issues,
      });
    }

    const { targetUserkey, score, comment, reviewId, alertId } = validation.data;

    // Post the defense
    const result = await monitorService.postCustomDefense(
      targetUserkey,
      score,
      comment,
      reviewId
    );

    if (result.success) {
      // Update alert status if provided
      if (alertId) {
        await db.updateAlertStatus(alertId, 'CONFIRMED');
      }

      res.json({
        success: true,
        message: 'Defense posted successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to post defense',
      });
    }
  } catch (error) {
    logger.error('Error posting defense:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to post defense',
    });
  }
});

// POST /api/defend/confirm/:alertId - Confirm auto-defense
router.post('/confirm/:alertId', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    const alert = await db.getAlertById(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    const success = await monitorService.executeDefense(alertId, alert.reviewId);

    if (success) {
      res.json({
        success: true,
        message: 'Defense confirmed and posted',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to execute defense',
      });
    }
  } catch (error) {
    logger.error('Error confirming defense:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm defense',
    });
  }
});

// GET /api/defend/suggest - Get defense suggestion for a target
router.get('/suggest', async (req: Request, res: Response) => {
  try {
    const { score = '3' } = req.query;
    const suggestion = getRandomDefenseMessage(parseInt(score as string, 10));

    res.json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    logger.error('Error getting defense suggestion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestion',
    });
  }
});

// GET /api/defend/pending - Get pending defenses
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const { data: alerts } = await db.getAlerts({ status: 'PENDING' });

    const pending = await Promise.all(
      alerts.map(async (alert) => {
        const defense = await db.getPendingDefense(alert.reviewId);
        return {
          alert,
          defense,
        };
      })
    );

    res.json({
      success: true,
      data: pending.filter((p) => p.defense !== null),
    });
  } catch (error) {
    logger.error('Error fetching pending defenses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending defenses',
    });
  }
});

export default router;
