import { config_values } from '../config/env.js';
import logger from '../utils/logger.js';
import ethosService from './ethos.service.js';
import alertService from './alert.service.js';
import db from './database.service.js';
import type { MonitorResult, AlertPayload, EthosActivity } from '../models/types.js';
import { getRandomDefenseMessage } from '../models/types.js';

class MonitorService {
  private isRunning = false;
  private lastRunAt: Date | null = null;

  constructor() {
    // Register callback handlers for Telegram buttons
    this.registerCallbackHandlers();
  }

  // Register handlers for Telegram button clicks
  private registerCallbackHandlers() {
    alertService.onCallback('confirm', async (data) => {
      logger.info(`Defense confirmed for review ${data.reviewId}`);
      await this.executeDefense(data.alertId, data.reviewId);
    });

    alertService.onCallback('ignore', async (data) => {
      logger.info(`Alert ignored for review ${data.reviewId}`);
      await db.updateAlertStatus(data.alertId, 'IGNORED');
    });

    alertService.onCallback('edit', async (data) => {
      logger.info(`Edit requested for review ${data.reviewId}`);
      // User will be redirected to dashboard via URL button
    });
  }

  // Main monitoring cycle
  async runMonitorCycle(): Promise<MonitorResult> {
    if (this.isRunning) {
      logger.warn('Monitor cycle already running, skipping...');
      return {
        relationsChecked: 0,
        reviewsFound: 0,
        newNegative: 0,
        alertsSent: 0,
        errors: ['Cycle already running'],
        duration: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const result: MonitorResult = {
      relationsChecked: 0,
      reviewsFound: 0,
      newNegative: 0,
      alertsSent: 0,
      errors: [],
      duration: 0,
    };

    try {
      logger.info('Starting monitor cycle...');

      // 1. Get user's vouches (relations)
      const userKey = config_values.ethos.userKey;
      const vouches = await ethosService.getVouches(userKey);
      logger.info(`Found ${vouches.length} relations to monitor`);

      // 2. For each relation, check for new negative reviews
      for (const vouch of vouches) {
        try {
          const relationUserkey = ethosService.profileIdToUserkey(vouch.subjectProfileId);
          result.relationsChecked++;

          // Use subjectUser data from vouch response if available, otherwise fetch profile
          let profileData: { name?: string | null; address?: string; avatar?: string | null } = {};

          if (vouch.subjectUser) {
            // Extract address from userkeys or primaryAddress
            const addressKey = vouch.subjectUser.userkeys?.find((k) => k.startsWith('address:'));
            profileData = {
              name: vouch.subjectUser.displayName || vouch.subjectUser.username,
              address: vouch.subjectUser.primaryAddress || (addressKey ? addressKey.replace('address:', '') : undefined),
              avatar: vouch.subjectUser.avatarUrl,
            };
          }

          // Fallback to fetching profile if subjectUser data is incomplete
          if (!profileData.address) {
            const profile = await ethosService.getProfile(relationUserkey);
            if (!profile) continue;
            profileData = {
              name: profile.name || profile.username,
              address: profile.primaryAddress,
              avatar: profile.avatar,
            };
          }

          if (!profileData.address) continue;

          await db.upsertRelation({
            id: vouch.id?.toString() || vouch.subjectProfileId.toString(),
            userkey: relationUserkey,
            name: profileData.name,
            address: profileData.address,
            avatarUrl: profileData.avatar,
          });

          // Get received reviews for this relation
          const activities = await ethosService.getReceivedActivities(relationUserkey, ['review', 'slash']);
          result.reviewsFound += activities.length;

          // Process each activity
          for (const activity of activities) {
            await this.processActivity(activity, vouch.id.toString(), result);
          }
        } catch (error) {
          const errorMsg = `Error processing relation ${vouch.subjectProfileId}: ${error}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      result.duration = Date.now() - startTime;
      this.lastRunAt = new Date();

      // Log the run
      await db.logMonitorRun({
        relationsChecked: result.relationsChecked,
        reviewsFound: result.reviewsFound,
        newNegative: result.newNegative,
        alertsSent: result.alertsSent,
        errors: result.errors.length > 0 ? result.errors.join('; ') : undefined,
        duration: result.duration,
      });

      logger.info(`Monitor cycle completed in ${result.duration}ms: ${result.newNegative} new negative reviews, ${result.alertsSent} alerts sent`);
    } catch (error) {
      logger.error('Monitor cycle failed:', error);
      result.errors.push(`Cycle failed: ${error}`);
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  // Process a single activity
  private async processActivity(
    activity: EthosActivity,
    relationId: string,
    result: MonitorResult
  ): Promise<void> {
    // Get activity ID from data.id (API structure)
    const activityId = String(activity.data?.id || activity.id || `${activity.type}_${Date.now()}`);

    // Check if already processed
    const exists = await db.reviewExists(activityId);
    if (exists) return;

    // Convert score string to number (API returns "positive", "negative", "neutral")
    let score = 0;
    const scoreValue = activity.data?.score;
    if (typeof scoreValue === 'string') {
      if (scoreValue === 'negative') score = -1;
      else if (scoreValue === 'positive') score = 1;
      else score = 0; // neutral
    } else if (typeof scoreValue === 'number') {
      score = scoreValue;
    }

    const isNegative = score < 0 || activity.type === 'slash';

    // Create review record
    const review = await db.createReview({
      id: `${activity.type}_${activityId}`,
      relationId,
      authorKey: ethosService.profileIdToUserkey(activity.author.profileId),
      authorName: activity.author.name || activity.author.username,
      authorAddr: activity.author.primaryAddress,
      score,
      comment: activity.data?.comment || null,
      activityId,
      createdAt: this.parseActivityTimestamp(activity),
    });

    // If negative, send alert
    if (isNegative) {
      result.newNegative++;

      const relation = await db.getRelationById(relationId);
      if (!relation) return;

      // Prepare auto-defense suggestion
      const defense = getRandomDefenseMessage(config_values.autoDefense.defaultScore);

      const payload: AlertPayload = {
        type: activity.type === 'slash' ? 'SLASH' : 'NEGATIVE_REVIEW',
        target: {
          name: relation.name,
          address: relation.address,
          profileUrl: ethosService.getProfileUrl(relation.address),
          profileId: parseInt(relationId),
        },
        attacker: {
          name: activity.author.name || activity.author.username,
          address: activity.author.primaryAddress,
          profileId: activity.author.profileId,
        },
        score,
        comment: activity.data?.comment || null,
        timestamp: new Date(),
        reviewId: review.id,
        relationId,
        autoDefense: config_values.autoDefense.enabled
          ? {
              enabled: true,
              requireConfirm: config_values.autoDefense.requireConfirm,
              suggestedScore: defense.score,
              suggestedComment: defense.message,
            }
          : undefined,
      };

      // Send alerts
      const alertResults = await alertService.sendAlert(payload);

      // Store alert records
      if (alertResults.telegram) {
        await db.createAlert({
          reviewId: review.id,
          relationId,
          type: payload.type === 'SLASH' ? 'SLASH' : 'NEGATIVE_REVIEW',
          channel: 'TELEGRAM',
          messageId: alertResults.telegram,
        });
        result.alertsSent++;
      }

      if (alertResults.discord) {
        await db.createAlert({
          reviewId: review.id,
          relationId,
          type: payload.type === 'SLASH' ? 'SLASH' : 'NEGATIVE_REVIEW',
          channel: 'DISCORD',
          messageId: alertResults.discord,
        });
        result.alertsSent++;
      }

      // Create pending defense if auto-defense enabled
      if (config_values.autoDefense.enabled) {
        await db.createDefense({
          reviewId: review.id,
          targetKey: relation.userkey,
          score: defense.score,
          comment: defense.message,
          status: 'PENDING',
        });
      }

      // Mark review as alerted
      await db.markReviewAlerted(review.id);
    }
  }

  // Execute defense (post positive review)
  async executeDefense(alertId: string, reviewId: string): Promise<boolean> {
    try {
      const alert = await db.getAlertById(alertId);
      if (!alert) {
        logger.error(`Alert not found: ${alertId}`);
        return false;
      }

      const pendingDefense = await db.getPendingDefense(reviewId);
      if (!pendingDefense) {
        logger.error(`No pending defense for review: ${reviewId}`);
        return false;
      }

      // Update defense status to confirmed
      await db.updateDefenseStatus(pendingDefense.id, 'CONFIRMED');

      // Post the review via Ethos API
      const result = await ethosService.postReview(
        pendingDefense.targetKey,
        pendingDefense.score,
        pendingDefense.comment
      );

      if (result.success) {
        await db.updateDefenseStatus(pendingDefense.id, 'POSTED', {
          ethosReviewId: result.reviewId,
          txHash: result.txHash,
        });
        await db.updateAlertStatus(alertId, 'CONFIRMED');
        logger.info(`Defense posted successfully for ${pendingDefense.targetKey}`);
        return true;
      } else {
        await db.updateDefenseStatus(pendingDefense.id, 'FAILED', {
          error: result.error,
        });
        logger.error(`Defense failed for ${pendingDefense.targetKey}: ${result.error}`);
        return false;
      }
    } catch (error) {
      logger.error('Execute defense error:', error);
      return false;
    }
  }

  // Manual defense with custom parameters
  async postCustomDefense(
    targetUserkey: string,
    score: number,
    comment: string,
    reviewId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await ethosService.postReview(targetUserkey, score, comment);

      if (result.success && reviewId) {
        // If linked to an existing review, update defense record
        const defense = await db.getPendingDefense(reviewId);
        if (defense) {
          await db.updateDefenseStatus(defense.id, 'POSTED', {
            ethosReviewId: result.reviewId,
            txHash: result.txHash,
          });
        }
      }

      return result;
    } catch (error) {
      logger.error('Custom defense error:', error);
      return { success: false, error: String(error) };
    }
  }

  // Parse activity timestamp (API returns Unix seconds, not milliseconds)
  private parseActivityTimestamp(activity: EthosActivity): Date {
    // Try timestamp first (Unix seconds)
    if (activity.timestamp && typeof activity.timestamp === 'number') {
      // If timestamp is in seconds (less than year 10000), convert to ms
      const ts = activity.timestamp < 10000000000 ? activity.timestamp * 1000 : activity.timestamp;
      return new Date(ts);
    }
    // Try createdAt string
    if (activity.createdAt) {
      const parsed = new Date(activity.createdAt);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    // Try data.createdAt (Unix seconds)
    if (activity.data?.createdAt) {
      const ts = Number(activity.data.createdAt);
      if (!isNaN(ts)) {
        return new Date(ts < 10000000000 ? ts * 1000 : ts);
      }
    }
    return new Date();
  }

  // Get monitor status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      intervalMinutes: config_values.scheduler.intervalMinutes,
      autoDefenseEnabled: config_values.autoDefense.enabled,
      autoDefenseRequireConfirm: config_values.autoDefense.requireConfirm,
    };
  }
}

export const monitorService = new MonitorService();
export default monitorService;
