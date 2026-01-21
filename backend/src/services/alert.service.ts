import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';
import { config_values } from '../config/env.js';
import logger from '../utils/logger.js';
import type { AlertPayload, TelegramCallbackData } from '../models/types.js';
import db from './database.service.js';

class AlertService {
  private telegramBot: Telegraf | null = null;
  private twitterClient: TwitterApi | null = null;
  private callbackHandlers: Map<string, (data: TelegramCallbackData) => Promise<void>> = new Map();

  constructor() {
    this.initTelegram();
    this.initTwitter();
  }

  // Initialize Telegram Bot
  private initTelegram() {
    if (!config_values.telegram.enabled || !config_values.telegram.botToken) {
      logger.info('Telegram notifications disabled');
      return;
    }

    try {
      this.telegramBot = new Telegraf(config_values.telegram.botToken);

      // Handle callback queries (button clicks)
      this.telegramBot.on('callback_query', async (ctx) => {
        try {
          const callbackQuery = ctx.callbackQuery;
          // Type guard: 'data' property only exists on DataQuery, not GameQuery
          if (!('data' in callbackQuery) || !callbackQuery.data) return;
          const data = callbackQuery.data;

          const parsed = JSON.parse(data) as TelegramCallbackData;
          const handler = this.callbackHandlers.get(parsed.action);

          if (handler) {
            await handler(parsed);
            await ctx.answerCbQuery('Action processed!');
          } else {
            await ctx.answerCbQuery('Unknown action');
          }
        } catch (error) {
          logger.error('Telegram callback error:', error);
          await ctx.answerCbQuery('Error processing action');
        }
      });

      // Start polling in non-blocking mode
      this.telegramBot.launch().catch((err) => {
        logger.error('Telegram bot failed to start:', err);
      });

      logger.info('Telegram bot initialized');
    } catch (error) {
      logger.error('Failed to initialize Telegram bot:', error);
    }
  }

  // Initialize Twitter Client
  private initTwitter() {
    if (!config_values.twitter.enabled) {
      logger.info('Twitter notifications disabled');
      return;
    }

    try {
      this.twitterClient = new TwitterApi({
        appKey: config_values.twitter.apiKey!,
        appSecret: config_values.twitter.apiSecret!,
        accessToken: config_values.twitter.accessToken,
        accessSecret: config_values.twitter.accessSecret,
      });

      logger.info('Twitter client initialized');
    } catch (error) {
      logger.error('Failed to initialize Twitter client:', error);
    }
  }

  // Register callback handler for Telegram buttons
  onCallback(action: string, handler: (data: TelegramCallbackData) => Promise<void>) {
    this.callbackHandlers.set(action, handler);
  }

  // Send alert to all configured channels
  async sendAlert(payload: AlertPayload): Promise<{ telegram?: string; discord?: string; twitter?: string }> {
    const results: { telegram?: string; discord?: string; twitter?: string } = {};

    try {
      // Send to all channels in parallel
      const promises: Promise<void>[] = [];

      if (config_values.telegram.enabled) {
        promises.push(
          this.sendTelegramAlert(payload).then((msgId) => {
            results.telegram = msgId;
          })
        );
      }

      if (config_values.discord.enabled) {
        promises.push(
          this.sendDiscordAlert(payload).then((msgId) => {
            results.discord = msgId;
          })
        );
      }

      if (config_values.twitter.enabled) {
        promises.push(
          this.sendTwitterAlert(payload).then((msgId) => {
            results.twitter = msgId;
          })
        );
      }

      await Promise.allSettled(promises);
    } catch (error) {
      logger.error('Error sending alerts:', error);
    }

    return results;
  }

  // Send Telegram alert with inline buttons
  private async sendTelegramAlert(payload: AlertPayload): Promise<string | undefined> {
    if (!this.telegramBot || !config_values.telegram.chatId) return;

    const message = this.formatTelegramMessage(payload);
    const buttons = this.createTelegramButtons(payload);

    try {
      const result = await this.telegramBot.telegram.sendMessage(
        config_values.telegram.chatId,
        message,
        {
          parse_mode: 'HTML',
          ...buttons,
        }
      );

      logger.info(`Telegram alert sent: ${result.message_id}`);
      return result.message_id.toString();
    } catch (error) {
      logger.error('Failed to send Telegram alert:', error);
      return undefined;
    }
  }

  // Format Telegram message
  private formatTelegramMessage(payload: AlertPayload): string {
    const emoji = payload.type === 'SLASH' ? '⚡' : '🚨';
    const typeLabel = payload.type === 'SLASH' ? 'SLASH DÉTECTÉ' : 'REVIEW NÉGATIVE';

    let message = `${emoji} <b>ALERTE ETHOS - ${typeLabel}</b>\n\n`;
    message += `📛 <b>Cible:</b> ${payload.target.name || 'Unknown'}\n`;
    message += `   <code>${payload.target.address.slice(0, 6)}...${payload.target.address.slice(-4)}</code>\n\n`;
    message += `👤 <b>Attaquant:</b> ${payload.attacker.name || 'Unknown'}\n`;
    message += `   <code>${payload.attacker.address.slice(0, 6)}...${payload.attacker.address.slice(-4)}</code>\n\n`;
    message += `⭐ <b>Score:</b> ${payload.score}\n`;

    if (payload.comment) {
      message += `💬 <b>Commentaire:</b>\n<i>"${payload.comment.slice(0, 200)}${payload.comment.length > 200 ? '...' : ''}"</i>\n\n`;
    }

    message += `🔗 <a href="${payload.target.profileUrl}">Voir le profil</a>\n`;
    message += `⏰ <b>Détecté:</b> ${payload.timestamp.toLocaleString('fr-FR')}\n`;

    if (payload.autoDefense?.enabled) {
      message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `🤖 <b>Auto-défense proposée:</b>\n`;
      message += `<i>"${payload.autoDefense.suggestedComment}"</i>\n`;
      message += `Score: +${payload.autoDefense.suggestedScore}\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━`;
    }

    return message;
  }

  // Create Telegram inline buttons
  private createTelegramButtons(payload: AlertPayload) {
    const callbackData = (action: string): string =>
      JSON.stringify({
        action,
        alertId: payload.reviewId, // Will be updated with actual alert ID
        reviewId: payload.reviewId,
      });

    if (payload.autoDefense?.requireConfirm) {
      return Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Confirmer défense', callbackData('confirm')),
          Markup.button.callback('✏️ Modifier', callbackData('edit')),
        ],
        [
          Markup.button.callback('❌ Ignorer', callbackData('ignore')),
        ],
        [
          Markup.button.url('📊 Dashboard', `${config_values.frontend.url}/defend/${payload.reviewId}`),
        ],
      ]);
    }

    return Markup.inlineKeyboard([
      [
        Markup.button.callback('🛡️ Défendre', callbackData('confirm')),
        Markup.button.callback('👁️ Ignorer', callbackData('ignore')),
      ],
      [
        Markup.button.url('📊 Dashboard', `${config_values.frontend.url}/alerts`),
      ],
    ]);
  }

  // Send Discord alert with embed
  private async sendDiscordAlert(payload: AlertPayload): Promise<string | undefined> {
    if (!config_values.discord.webhookUrl) return;

    const embed = this.formatDiscordEmbed(payload);

    try {
      const response = await axios.post(config_values.discord.webhookUrl + '?wait=true', {
        embeds: [embed],
        components: this.createDiscordButtons(payload),
      });

      logger.info(`Discord alert sent: ${response.data?.id}`);
      return response.data?.id;
    } catch (error) {
      logger.error('Failed to send Discord alert:', error);
      return undefined;
    }
  }

  // Format Discord embed
  private formatDiscordEmbed(payload: AlertPayload) {
    const color = payload.type === 'SLASH' ? 0xFF0000 : 0xFFA500; // Red for slash, orange for negative

    const fields = [
      { name: '📛 Cible', value: `${payload.target.name || 'Unknown'}\n\`${payload.target.address}\``, inline: true },
      { name: '👤 Attaquant', value: `${payload.attacker.name || 'Unknown'}\n\`${payload.attacker.address}\``, inline: true },
      { name: '⭐ Score', value: payload.score.toString(), inline: true },
    ];

    if (payload.comment) {
      fields.push({
        name: '💬 Commentaire',
        value: payload.comment.slice(0, 1024),
        inline: false,
      });
    }

    if (payload.autoDefense?.enabled) {
      fields.push({
        name: '🤖 Défense proposée',
        value: `"${payload.autoDefense.suggestedComment}"\nScore: +${payload.autoDefense.suggestedScore}`,
        inline: false,
      });
    }

    return {
      title: `🚨 ALERTE ETHOS - ${payload.type === 'SLASH' ? 'SLASH' : 'REVIEW NÉGATIVE'}`,
      color,
      fields,
      url: payload.target.profileUrl,
      footer: {
        text: `Détecté: ${payload.timestamp.toLocaleString('fr-FR')}`,
      },
      timestamp: payload.timestamp.toISOString(),
    };
  }

  // Create Discord buttons (note: requires Discord bot for interactions)
  private createDiscordButtons(payload: AlertPayload) {
    return [
      {
        type: 1, // Action row
        components: [
          {
            type: 2, // Button
            style: 3, // Success (green)
            label: '✅ Confirmer',
            custom_id: `defend_${payload.reviewId}`,
          },
          {
            type: 2,
            style: 1, // Primary (blue)
            label: '✏️ Modifier',
            custom_id: `edit_${payload.reviewId}`,
          },
          {
            type: 2,
            style: 4, // Danger (red)
            label: '❌ Ignorer',
            custom_id: `ignore_${payload.reviewId}`,
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5, // Link
            label: '📊 Dashboard',
            url: `${config_values.frontend.url}/defend/${payload.reviewId}`,
          },
        ],
      },
    ];
  }

  // Send Twitter DM alert
  private async sendTwitterAlert(payload: AlertPayload): Promise<string | undefined> {
    if (!this.twitterClient) return;

    try {
      // Note: Twitter DM requires conversation setup
      // This is a simplified version - may need adjustment based on Twitter API v2 requirements
      const message = this.formatTwitterMessage(payload);

      // For now, we'll log instead of actually sending
      // To send DMs, you'd need the recipient's Twitter ID and proper permissions
      logger.info(`Twitter alert formatted (DM not sent): ${message.slice(0, 100)}...`);

      return 'twitter_dm_disabled';
    } catch (error) {
      logger.error('Failed to send Twitter alert:', error);
      return undefined;
    }
  }

  // Format Twitter message
  private formatTwitterMessage(payload: AlertPayload): string {
    const emoji = payload.type === 'SLASH' ? '⚡' : '🚨';
    let message = `${emoji} ALERTE ETHOS\n\n`;
    message += `Cible: ${payload.target.name || payload.target.address.slice(0, 10)}...\n`;
    message += `Attaquant: ${payload.attacker.name || payload.attacker.address.slice(0, 10)}...\n`;
    message += `Score: ${payload.score}\n\n`;
    message += `Dashboard: ${config_values.frontend.url}/defend/${payload.reviewId}`;
    return message;
  }

  // Update Telegram message (e.g., after action)
  async updateTelegramMessage(chatId: string, messageId: number, text: string) {
    if (!this.telegramBot) return;

    try {
      await this.telegramBot.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        text,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      logger.error('Failed to update Telegram message:', error);
    }
  }

  // Send simple notification
  async sendNotification(message: string, channel: 'telegram' | 'discord' | 'all' = 'all') {
    if (channel === 'telegram' || channel === 'all') {
      if (this.telegramBot && config_values.telegram.chatId) {
        await this.telegramBot.telegram.sendMessage(
          config_values.telegram.chatId,
          message,
          { parse_mode: 'HTML' }
        );
      }
    }

    if (channel === 'discord' || channel === 'all') {
      if (config_values.discord.webhookUrl) {
        await axios.post(config_values.discord.webhookUrl, { content: message });
      }
    }
  }

  // Cleanup
  async stop() {
    if (this.telegramBot) {
      this.telegramBot.stop('SIGTERM');
    }
    logger.info('Alert service stopped');
  }
}

export const alertService = new AlertService();
export default alertService;
