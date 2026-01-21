import { Router, Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

const router = Router();

// Get env path - resolve from current working directory
const envPath = path.resolve(process.cwd(), '.env');

// Helper to read .env file
async function readEnvFile(): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(envPath, 'utf-8');
    const env: Record<string, string> = {};
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    return env;
  } catch (error) {
    logger.error('Failed to read .env file:', error);
    return {};
  }
}

// Helper to write .env file
async function writeEnvFile(env: Record<string, string>): Promise<void> {
  const lines: string[] = [];

  // Group settings logically
  const groups = {
    server: ['PORT', 'NODE_ENV', 'FRONTEND_URL'],
    ethos: ['ETHOS_API_URL', 'ETHOS_PRIVY_TOKEN', 'ETHOS_USER_KEY', 'ETHOS_CLIENT_ID'],
    telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
    discord: ['DISCORD_WEBHOOK_URL'],
    twitter: ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET'],
    database: ['DATABASE_URL'],
    monitor: ['MONITOR_INTERVAL_MINUTES', 'AUTO_DEFENSE_ENABLED', 'AUTO_DEFENSE_REQUIRE_CONFIRM', 'AUTO_DEFENSE_DEFAULT_SCORE'],
  };

  const addedKeys = new Set<string>();

  for (const [groupName, keys] of Object.entries(groups)) {
    lines.push(`# ${groupName.charAt(0).toUpperCase() + groupName.slice(1)} Configuration`);
    for (const key of keys) {
      if (env[key] !== undefined) {
        lines.push(`${key}=${env[key]}`);
        addedKeys.add(key);
      }
    }
    lines.push('');
  }

  // Add any remaining keys
  for (const [key, value] of Object.entries(env)) {
    if (!addedKeys.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }

  await fs.writeFile(envPath, lines.join('\n'), 'utf-8');
}

// Mask sensitive values
function maskValue(value: string | undefined, showLength = 4): string {
  if (!value) return '';
  if (value.length <= showLength * 2) return '****';
  return value.slice(0, showLength) + '****' + value.slice(-showLength);
}

// GET /api/settings - Get current settings (masked secrets)
router.get('/', async (req: Request, res: Response) => {
  try {
    const env = await readEnvFile();

    const settings = {
      notifications: {
        telegram: {
          enabled: !!env.TELEGRAM_BOT_TOKEN && !!env.TELEGRAM_CHAT_ID,
          botToken: maskValue(env.TELEGRAM_BOT_TOKEN),
          chatId: env.TELEGRAM_CHAT_ID || '',
        },
        discord: {
          enabled: !!env.DISCORD_WEBHOOK_URL,
          webhookUrl: maskValue(env.DISCORD_WEBHOOK_URL),
        },
        twitter: {
          enabled: !!env.TWITTER_API_KEY,
          apiKey: maskValue(env.TWITTER_API_KEY),
          apiSecret: maskValue(env.TWITTER_API_SECRET),
          accessToken: maskValue(env.TWITTER_ACCESS_TOKEN),
          accessSecret: maskValue(env.TWITTER_ACCESS_SECRET),
        },
      },
      autoDefense: {
        enabled: env.AUTO_DEFENSE_ENABLED === 'true',
        requireConfirm: env.AUTO_DEFENSE_REQUIRE_CONFIRM !== 'false',
        defaultScore: parseInt(env.AUTO_DEFENSE_DEFAULT_SCORE || '3', 10),
      },
      monitorInterval: parseInt(env.MONITOR_INTERVAL_MINUTES || '5', 10),
    };

    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Failed to get settings:', error);
    res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

// POST /api/settings - Save settings
router.post('/', async (req: Request, res: Response) => {
  try {
    const { notifications, autoDefense, monitorInterval } = req.body;
    const env = await readEnvFile();

    // Update Telegram settings (only if new values provided, not masked)
    if (notifications?.telegram) {
      if (notifications.telegram.botToken && !notifications.telegram.botToken.includes('****')) {
        env.TELEGRAM_BOT_TOKEN = notifications.telegram.botToken;
      }
      if (notifications.telegram.chatId) {
        env.TELEGRAM_CHAT_ID = notifications.telegram.chatId;
      }
      // If disabled, remove tokens
      if (notifications.telegram.enabled === false) {
        delete env.TELEGRAM_BOT_TOKEN;
        delete env.TELEGRAM_CHAT_ID;
      }
    }

    // Update Discord settings
    if (notifications?.discord) {
      if (notifications.discord.webhookUrl && !notifications.discord.webhookUrl.includes('****')) {
        env.DISCORD_WEBHOOK_URL = notifications.discord.webhookUrl;
      }
      if (notifications.discord.enabled === false) {
        delete env.DISCORD_WEBHOOK_URL;
      }
    }

    // Update Twitter settings
    if (notifications?.twitter) {
      if (notifications.twitter.apiKey && !notifications.twitter.apiKey.includes('****')) {
        env.TWITTER_API_KEY = notifications.twitter.apiKey;
      }
      if (notifications.twitter.apiSecret && !notifications.twitter.apiSecret.includes('****')) {
        env.TWITTER_API_SECRET = notifications.twitter.apiSecret;
      }
      if (notifications.twitter.accessToken && !notifications.twitter.accessToken.includes('****')) {
        env.TWITTER_ACCESS_TOKEN = notifications.twitter.accessToken;
      }
      if (notifications.twitter.accessSecret && !notifications.twitter.accessSecret.includes('****')) {
        env.TWITTER_ACCESS_SECRET = notifications.twitter.accessSecret;
      }
      if (notifications.twitter.enabled === false) {
        delete env.TWITTER_API_KEY;
        delete env.TWITTER_API_SECRET;
        delete env.TWITTER_ACCESS_TOKEN;
        delete env.TWITTER_ACCESS_SECRET;
      }
    }

    // Update auto-defense settings
    if (autoDefense) {
      env.AUTO_DEFENSE_ENABLED = String(autoDefense.enabled);
      env.AUTO_DEFENSE_REQUIRE_CONFIRM = String(autoDefense.requireConfirm);
      env.AUTO_DEFENSE_DEFAULT_SCORE = String(autoDefense.defaultScore);
    }

    // Update monitor interval
    if (monitorInterval) {
      env.MONITOR_INTERVAL_MINUTES = String(monitorInterval);
    }

    await writeEnvFile(env);
    logger.info('Settings saved successfully');

    res.json({ success: true, message: 'Settings saved. Restart server to apply changes.' });
  } catch (error) {
    logger.error('Failed to save settings:', error);
    res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
});

// POST /api/settings/test/:channel - Test notification channel
router.post('/test/:channel', async (req: Request, res: Response) => {
  try {
    const { channel } = req.params;
    const env = await readEnvFile();

    const testMessage = `🧪 Test notification from Ethos Monitor\n\nIf you see this, ${channel} notifications are working correctly!\n\nTimestamp: ${new Date().toLocaleString()}`;

    switch (channel) {
      case 'telegram': {
        if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
          return res.status(400).json({
            success: false,
            error: 'Telegram not configured. Please enter Bot Token and Chat ID first.'
          });
        }

        // Use dynamic import to test with actual credentials
        const { Telegraf } = await import('telegraf');
        const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
        await bot.telegram.sendMessage(env.TELEGRAM_CHAT_ID, testMessage);

        res.json({ success: true, message: 'Telegram test sent!' });
        break;
      }

      case 'discord': {
        if (!env.DISCORD_WEBHOOK_URL) {
          return res.status(400).json({
            success: false,
            error: 'Discord not configured. Please enter Webhook URL first.'
          });
        }

        const { default: axios } = await import('axios');
        await axios.post(env.DISCORD_WEBHOOK_URL, {
          content: testMessage,
          embeds: [{
            title: '🧪 Test Notification',
            description: 'If you see this, Discord notifications are working correctly!',
            color: 0x5865F2,
            timestamp: new Date().toISOString(),
          }],
        });

        res.json({ success: true, message: 'Discord test sent!' });
        break;
      }

      case 'twitter': {
        if (!env.TWITTER_API_KEY || !env.TWITTER_API_SECRET) {
          return res.status(400).json({
            success: false,
            error: 'Twitter not configured. Please enter API credentials first.'
          });
        }

        // Twitter DM requires more setup, just validate credentials exist
        res.json({
          success: true,
          message: 'Twitter credentials saved. DM functionality requires additional setup.'
        });
        break;
      }

      default:
        res.status(400).json({ success: false, error: 'Unknown channel' });
    }
  } catch (error) {
    logger.error(`Failed to test ${req.params.channel}:`, error);
    res.status(500).json({
      success: false,
      error: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

export default router;
