import { Router, Request, Response } from 'express';
import db from '../services/database.service.js';
import logger from '../utils/logger.js';

const router = Router();

// GET /api/reviews - List reviews with filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      negative,
      relationId,
      limit = '50',
      offset = '0',
    } = req.query;

    const options = {
      negative: negative === 'true' ? true : negative === 'false' ? false : undefined,
      relationId: relationId as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    const { data, total } = await db.getReviews(options);

    res.json({
      success: true,
      data,
      total,
      limit: options.limit,
      offset: options.offset,
    });
  } catch (error) {
    logger.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reviews',
    });
  }
});

// GET /api/reviews/negative - Get negative reviews only
router.get('/negative', async (req: Request, res: Response) => {
  try {
    const {
      limit = '50',
      offset = '0',
    } = req.query;

    const { data, total } = await db.getReviews({
      negative: true,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    res.json({
      success: true,
      data,
      total,
    });
  } catch (error) {
    logger.error('Error fetching negative reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch negative reviews',
    });
  }
});

// GET /api/reviews/stats - Get review statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await db.getStats();

    res.json({
      success: true,
      data: {
        total: stats.totalReviews,
        negative: stats.negativeReviews,
        positive: stats.totalReviews - stats.negativeReviews,
        negativePercentage: stats.totalReviews > 0
          ? ((stats.negativeReviews / stats.totalReviews) * 100).toFixed(1)
          : 0,
      },
    });
  } catch (error) {
    logger.error('Error fetching review stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch review stats',
    });
  }
});

export default router;
