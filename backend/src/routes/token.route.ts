import { Router, Request, Response } from 'express';
import tokenService from '../services/token.service.js';
import logger from '../utils/logger.js';
import { z } from 'zod';

const router = Router();

// Validation schema
const updateTokenSchema = z.object({
  token: z.string().min(50, 'Token too short'),
});

// GET /api/token/status - Get current token status
router.get('/status', (req: Request, res: Response) => {
  try {
    const status = tokenService.getStatus();
    res.json({
      success: true,
      data: {
        ...status,
        expiresAt: status.expiresAt?.toISOString() || null,
        formattedStatus: tokenService.formatStatus(),
      },
    });
  } catch (error) {
    logger.error('Error getting token status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get token status',
    });
  }
});

// POST /api/token/update - Update the Privy token
router.post('/update', async (req: Request, res: Response) => {
  try {
    const validation = updateTokenSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { token } = validation.data;
    const result = await tokenService.updateToken(token);

    if (result.success) {
      res.json({
        success: true,
        message: 'Token updated successfully',
        data: {
          ...result.status,
          expiresAt: result.status.expiresAt?.toISOString() || null,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Error updating token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update token',
    });
  }
});

// GET /api/token/instructions - Get instructions for refreshing token
router.get('/instructions', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      steps: [
        '1. Ouvrez https://app.ethos.network dans votre navigateur',
        '2. Connectez-vous si necessaire',
        '3. Ouvrez DevTools (F12)',
        '4. Allez dans Application > Cookies > app.ethos.network',
        '5. Copiez la valeur du cookie "privy-token"',
        '6. Collez le token dans le champ ci-dessous et cliquez sur "Mettre a jour"',
      ],
      notes: [
        'Le token expire apres environ 24 heures',
        'Vous recevrez une alerte quand le token est sur le point d\'expirer',
        'Le bot continuera a fonctionner avec le nouveau token automatiquement',
      ],
      currentStatus: tokenService.formatStatus(),
    },
  });
});

export default router;
