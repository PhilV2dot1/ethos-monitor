import express from 'express';
import cors from 'cors';
import { config_values } from './config/env.js';
import logger from './utils/logger.js';
import db from './services/database.service.js';
import alertService from './services/alert.service.js';
import scheduler from './scheduler/cron.js';
import monitorService from './services/monitor.service.js';
import ethosService from './services/ethos.service.js';
import tokenService from './services/token.service.js';

// Routes
import relationsRoute from './routes/relations.route.js';
import reviewsRoute from './routes/reviews.route.js';
import alertsRoute from './routes/alerts.route.js';
import defendRoute from './routes/defend.route.js';
import tokenRoute from './routes/token.route.js';
import settingsRoute from './routes/settings.route.js';

const app = express();

// Middleware
app.use(cors({
  origin: config_values.server.isProd
    ? [config_values.frontend.url, /\.vercel\.app$/, /\.railway\.app$/]
    : '*',
  credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', async (_req, res) => {
  const ethosHealthy = await ethosService.healthCheck();
  const stats = await db.getStats();
  const schedulerStatus = scheduler.getStatus();
  const tokenStatus = tokenService.getStatus();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ethos: {
      healthy: ethosHealthy,
      userKey: config_values.ethos.userKey,
    },
    token: {
      valid: tokenStatus.valid,
      expiresAt: tokenStatus.expiresAt?.toISOString() || null,
      expiresIn: tokenStatus.expiresIn,
      isExpiringSoon: tokenStatus.isExpiringSoon,
    },
    database: {
      relations: stats.totalRelations,
      reviews: stats.totalReviews,
      alerts: stats.totalAlerts,
    },
    scheduler: schedulerStatus,
    notifications: {
      telegram: config_values.telegram.enabled,
      discord: config_values.discord.enabled,
      twitter: config_values.twitter.enabled,
    },
  });
});

// API Routes
app.use('/api/relations', relationsRoute);
app.use('/api/reviews', reviewsRoute);
app.use('/api/alerts', alertsRoute);
app.use('/api/defend', defendRoute);
app.use('/api/token', tokenRoute);
app.use('/api/settings', settingsRoute);

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    const recentLogs = await db.getRecentMonitorLogs(5);
    const status = scheduler.getStatus();

    res.json({
      success: true,
      data: {
        ...stats,
        monitorStatus: status,
        recentRuns: recentLogs,
      },
    });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
    });
  }
});

// Trigger manual monitor run
app.post('/api/monitor/run', async (req, res) => {
  try {
    const result = await scheduler.triggerMonitor();
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error triggering monitor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger monitor',
    });
  }
});

// Get monitor status
app.get('/api/monitor/status', (req, res) => {
  res.json({
    success: true,
    data: scheduler.getStatus(),
  });
});

// Config endpoints
app.get('/api/config', async (req, res) => {
  res.json({
    success: true,
    data: {
      monitorInterval: config_values.scheduler.intervalMinutes,
      autoDefense: {
        enabled: config_values.autoDefense.enabled,
        requireConfirm: config_values.autoDefense.requireConfirm,
        defaultScore: config_values.autoDefense.defaultScore,
      },
      notifications: {
        telegram: config_values.telegram.enabled,
        discord: config_values.discord.enabled,
        twitter: config_values.twitter.enabled,
      },
    },
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down...');
  scheduler.stop();
  await alertService.stop();
  await db.disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`
╔═══════════════════════════════════════════════════════════╗
║             ETHOS MONITOR - BOT Anti-Slash                ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                              ║
║  Environment: ${config_values.server.isDev ? 'development' : 'production'}                           ║
║                                                           ║
║  Ethos User: ${config_values.ethos.userKey.slice(0, 30)}...         ║
║  Telegram: ${config_values.telegram.enabled ? '✅ Enabled' : '❌ Disabled'}                             ║
║  Discord:  ${config_values.discord.enabled ? '✅ Enabled' : '❌ Disabled'}                             ║
║  Twitter:  ${config_values.twitter.enabled ? '✅ Enabled' : '❌ Disabled'}                             ║
║                                                           ║
║  Monitor Interval: ${config_values.scheduler.intervalMinutes} minutes                         ║
║  Auto-Defense: ${config_values.autoDefense.enabled ? '✅ Enabled' : '❌ Disabled'} (Confirm: ${config_values.autoDefense.requireConfirm ? 'Yes' : 'No'})        ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Start the scheduler
  scheduler.start();

  // Start token monitoring
  tokenService.startMonitoring((status) => {
    if (status.isExpired) {
      logger.error('=== TOKEN EXPIRED === Please update your Privy token at /api/token/update');
    } else if (status.isExpiringSoon) {
      logger.warn(`=== TOKEN EXPIRING SOON === ${Math.floor((status.expiresIn || 0) / 60)} minutes remaining`);
    }
  });
});

export default app;
