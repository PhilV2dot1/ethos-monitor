import { PrismaClient } from '@prisma/client';

// Type aliases for string-based enums (SQLite doesn't support native enums)
type AlertType = 'NEGATIVE_REVIEW' | 'SLASH' | 'UNVOUCH';
type AlertChannel = 'TELEGRAM' | 'DISCORD' | 'TWITTER' | 'ALL';
type AlertStatus = 'PENDING' | 'CONFIRMED' | 'IGNORED' | 'EXPIRED';
type DefenseStatus = 'PENDING' | 'CONFIRMED' | 'POSTED' | 'FAILED';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

export const db = {
  // Relations
  async upsertRelation(data: {
    id: string;
    userkey: string;
    name?: string | null;
    address: string;
    avatarUrl?: string | null;
    score?: number;
  }) {
    return prisma.relation.upsert({
      where: { id: data.id },
      update: {
        name: data.name,
        avatarUrl: data.avatarUrl,
        score: data.score,
        updatedAt: new Date(),
      },
      create: {
        id: data.id,
        userkey: data.userkey,
        name: data.name,
        address: data.address,
        avatarUrl: data.avatarUrl,
        score: data.score || 0,
      },
    });
  },

  async getRelations(activeOnly = true) {
    return prisma.relation.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            reviews: true,
            alerts: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async getRelationById(id: string) {
    return prisma.relation.findUnique({
      where: { id },
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
        },
        alerts: {
          orderBy: { sentAt: 'desc' },
        },
      },
    });
  },

  // Reviews
  async reviewExists(activityId: string) {
    const review = await prisma.review.findUnique({
      where: { activityId },
    });
    return !!review;
  },

  async createReview(data: {
    id: string;
    relationId: string;
    authorKey: string;
    authorName?: string | null;
    authorAddr?: string | null;
    score: number;
    comment?: string | null;
    activityId?: string;
    txHash?: string | null;
    createdAt: Date;
  }) {
    return prisma.review.create({
      data: {
        ...data,
        isNegative: data.score < 0,
      },
    });
  },

  async getReviews(options?: {
    negative?: boolean;
    relationId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (options?.negative !== undefined) where.isNegative = options.negative;
    if (options?.relationId) where.relationId = options.relationId;

    const [data, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          relation: true,
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.review.count({ where }),
    ]);

    return { data, total };
  },

  async markReviewAlerted(id: string) {
    return prisma.review.update({
      where: { id },
      data: { alerted: true },
    });
  },

  // Alerts
  async createAlert(data: {
    reviewId: string;
    relationId: string;
    type: AlertType;
    channel: AlertChannel;
    messageId?: string;
  }) {
    return prisma.alert.create({ data });
  },

  async getAlerts(options?: {
    status?: AlertStatus;
    relationId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (options?.status) where.status = options.status;
    if (options?.relationId) where.relationId = options.relationId;

    const [data, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        include: {
          review: true,
          relation: true,
        },
        orderBy: { sentAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.alert.count({ where }),
    ]);

    return { data, total };
  },

  async updateAlertStatus(id: string, status: AlertStatus) {
    return prisma.alert.update({
      where: { id },
      data: {
        status,
        respondedAt: new Date(),
      },
    });
  },

  async getAlertById(id: string) {
    return prisma.alert.findUnique({
      where: { id },
      include: {
        review: true,
        relation: true,
      },
    });
  },

  // Defenses
  async createDefense(data: {
    reviewId: string;
    targetKey: string;
    score: number;
    comment: string;
    status?: DefenseStatus;
  }) {
    return prisma.defense.create({
      data: {
        ...data,
        status: data.status || 'PENDING',
      },
    });
  },

  async updateDefenseStatus(
    id: string,
    status: DefenseStatus,
    extra?: { ethosReviewId?: string; txHash?: string; error?: string }
  ) {
    return prisma.defense.update({
      where: { id },
      data: {
        status,
        postedAt: status === 'POSTED' ? new Date() : undefined,
        ...extra,
      },
    });
  },

  async getPendingDefense(reviewId: string) {
    return prisma.defense.findFirst({
      where: {
        reviewId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
  },

  // Stats
  async getStats() {
    const [
      totalRelations,
      activeRelations,
      totalReviews,
      negativeReviews,
      totalAlerts,
      pendingAlerts,
      defensesSent,
      successfulDefenses,
    ] = await Promise.all([
      prisma.relation.count(),
      prisma.relation.count({ where: { isActive: true } }),
      prisma.review.count(),
      prisma.review.count({ where: { isNegative: true } }),
      prisma.alert.count(),
      prisma.alert.count({ where: { status: 'PENDING' } }),
      prisma.defense.count(),
      prisma.defense.count({ where: { status: 'POSTED' } }),
    ]);

    return {
      totalRelations,
      activeRelations,
      totalReviews,
      negativeReviews,
      totalAlerts,
      pendingAlerts,
      defensesSent,
      successfulDefenses,
    };
  },

  // Monitor Logs
  async logMonitorRun(data: {
    relationsChecked: number;
    reviewsFound: number;
    newNegative: number;
    alertsSent: number;
    errors?: string;
    duration: number;
  }) {
    return prisma.monitorLog.create({ data });
  },

  async getRecentMonitorLogs(limit = 10) {
    return prisma.monitorLog.findMany({
      orderBy: { runAt: 'desc' },
      take: limit,
    });
  },

  // Config
  async getConfig(key: string) {
    const config = await prisma.config.findUnique({ where: { key } });
    return config?.value;
  },

  async setConfig(key: string, value: string) {
    return prisma.config.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  },

  // Cleanup
  async disconnect() {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  },
};

export default db;
