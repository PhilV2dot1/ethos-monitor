import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Ethos API
  ETHOS_API_URL: z.string().url().default('https://api.ethos.network'),
  ETHOS_PRIVY_TOKEN: z.string().min(1),
  ETHOS_USER_KEY: z.string().min(1),
  ETHOS_CLIENT_ID: z.string().default('ethos-monitor@1.0.0'),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  // Discord
  DISCORD_WEBHOOK_URL: z.string().url().optional(),

  // Twitter/X
  TWITTER_API_KEY: z.string().optional(),
  TWITTER_API_SECRET: z.string().optional(),
  TWITTER_ACCESS_TOKEN: z.string().optional(),
  TWITTER_ACCESS_SECRET: z.string().optional(),

  // Database
  DATABASE_URL: z.string().default('file:./ethos.db'),

  // Scheduler
  MONITOR_INTERVAL_MINUTES: z.string().default('5'),

  // Auto-defense
  AUTO_DEFENSE_ENABLED: z.string().transform(v => v === 'true').default('true'),
  AUTO_DEFENSE_REQUIRE_CONFIRM: z.string().transform(v => v === 'true').default('true'),
  AUTO_DEFENSE_DEFAULT_SCORE: z.string().transform(v => parseInt(v, 10)).default('3'),

  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

export const config_values = {
  server: {
    port: parseInt(env.PORT, 10),
    isDev: env.NODE_ENV === 'development',
    isProd: env.NODE_ENV === 'production',
  },
  ethos: {
    apiUrl: env.ETHOS_API_URL,
    privyToken: env.ETHOS_PRIVY_TOKEN,
    userKey: env.ETHOS_USER_KEY,
    clientId: env.ETHOS_CLIENT_ID,
  },
  telegram: {
    enabled: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
    botToken: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
  },
  discord: {
    enabled: !!env.DISCORD_WEBHOOK_URL,
    webhookUrl: env.DISCORD_WEBHOOK_URL,
  },
  twitter: {
    enabled: !!(env.TWITTER_API_KEY && env.TWITTER_API_SECRET),
    apiKey: env.TWITTER_API_KEY,
    apiSecret: env.TWITTER_API_SECRET,
    accessToken: env.TWITTER_ACCESS_TOKEN,
    accessSecret: env.TWITTER_ACCESS_SECRET,
  },
  scheduler: {
    intervalMinutes: parseInt(env.MONITOR_INTERVAL_MINUTES, 10),
  },
  autoDefense: {
    enabled: env.AUTO_DEFENSE_ENABLED,
    requireConfirm: env.AUTO_DEFENSE_REQUIRE_CONFIRM,
    defaultScore: env.AUTO_DEFENSE_DEFAULT_SCORE,
  },
  frontend: {
    url: env.FRONTEND_URL,
  },
};
