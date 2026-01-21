import { Router, Request, Response } from 'express';
import db from '../services/database.service.js';
import ethosService from '../services/ethos.service.js';
import logger from '../utils/logger.js';

const router = Router();

// GET /api/relations - List all relations
router.get('/', async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const relations = await db.getRelations(activeOnly);

    res.json({
      success: true,
      data: relations,
      total: relations.length,
    });
  } catch (error) {
    logger.error('Error fetching relations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch relations',
    });
  }
});

// GET /api/relations/:id - Get relation details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const relation = await db.getRelationById(id);

    if (!relation) {
      return res.status(404).json({
        success: false,
        error: 'Relation not found',
      });
    }

    // Get fresh score from Ethos
    const score = await ethosService.getScore(relation.userkey);

    res.json({
      success: true,
      data: {
        ...relation,
        ethosScore: score,
      },
    });
  } catch (error) {
    logger.error('Error fetching relation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch relation',
    });
  }
});

// POST /api/relations/refresh - Refresh relations from Ethos
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { config_values } = await import('../config/env.js');
    const vouches = await ethosService.getVouches(config_values.ethos.userKey);

    let updated = 0;
    for (const vouch of vouches) {
      const userkey = ethosService.profileIdToUserkey(vouch.subjectProfileId);
      const profile = await ethosService.getProfile(userkey);

      if (profile) {
        await db.upsertRelation({
          id: vouch.id.toString(),
          userkey,
          name: profile.name || profile.username,
          address: profile.primaryAddress,
          avatarUrl: profile.avatar,
        });
        updated++;
      }
    }

    res.json({
      success: true,
      data: {
        total: vouches.length,
        updated,
      },
    });
  } catch (error) {
    logger.error('Error refreshing relations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh relations',
    });
  }
});

export default router;
