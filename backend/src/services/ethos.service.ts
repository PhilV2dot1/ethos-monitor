import axios, { AxiosInstance, AxiosError } from 'axios';
import { config_values } from '../config/env.js';
import logger from '../utils/logger.js';
import type {
  EthosProfile,
  EthosVouch,
  EthosActivity,
  EthosScore,
  ActivityType,
} from '../models/types.js';

class EthosService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = config_values.ethos.apiUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-Ethos-Client': config_values.ethos.clientId,
      },
      timeout: 30000,
    });

    // Add auth header if token exists
    if (config_values.ethos.privyToken) {
      this.client.defaults.headers.common['Authorization'] =
        `Bearer ${config_values.ethos.privyToken}`;
    }

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          logger.error(`Ethos API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          logger.error(`Ethos API No Response: ${error.message}`);
        } else {
          logger.error(`Ethos API Error: ${error.message}`);
        }
        throw error;
      }
    );
  }

  // Update token (for token refresh)
  setToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Get profile by userkey (tries multiple endpoints)
  async getProfile(userkey: string): Promise<EthosProfile | null> {
    // If userkey is an address, try the ethos-everywhere-wallet endpoint first
    if (userkey.startsWith('address:') || userkey.startsWith('0x')) {
      const address = userkey.replace('address:', '');
      try {
        const response = await this.client.get(`/api/v2/user/by/ethos-everywhere-wallet/${address}`);
        logger.info(`Found user by ethos-everywhere-wallet: ${address}`);
        return response.data;
      } catch (error) {
        logger.warn(`ethos-everywhere-wallet lookup failed for ${address}, trying profiles endpoint`);
      }
    }

    // Try the standard profiles endpoint
    try {
      const response = await this.client.get(`/api/v2/profiles/${encodeURIComponent(userkey)}`);
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Get user by Ethos Everywhere wallet address
  async getUserByWallet(walletAddress: string): Promise<EthosProfile | null> {
    try {
      const response = await this.client.get(`/api/v2/user/by/ethos-everywhere-wallet/${walletAddress}`);
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        logger.warn(`No user found for wallet ${walletAddress}`);
        return null;
      }
      throw error;
    }
  }

  // Get vouches (relations) for a user
  async getVouches(userkey: string): Promise<EthosVouch[]> {
    try {
      // Extract profileId from userkey
      const profileId = this.extractProfileId(userkey);
      if (!profileId) {
        logger.warn(`Cannot extract profileId from userkey: ${userkey}`);
        return [];
      }

      // Use POST /api/v2/vouches with authorProfileIds array
      const response = await this.client.post('/api/v2/vouches', {
        authorProfileIds: [profileId],
        limit: 100,
      });

      const vouches = response.data?.values || response.data || [];
      logger.info(`Found ${vouches.length} vouches for profileId ${profileId}`);

      // Convert API response to EthosVouch format
      return vouches.map((v: {
        id?: number;
        archived?: boolean;
        authorProfileId: number;
        subjectProfileId: number;
        comment?: string | null;
        staked?: string;
        activityChecksum?: string;
        createdAt?: string;
        updatedAt?: string;
        unvouchedAt?: string | null;
        subjectUser?: {
          profileId: number;
          displayName?: string;
          username?: string;
          avatarUrl?: string;
          primaryAddress?: string;
        };
      }) => ({
        id: v.id || v.subjectProfileId,
        archived: v.archived || false,
        authorProfileId: v.authorProfileId,
        subjectProfileId: v.subjectProfileId,
        comment: v.comment || null,
        staked: v.staked || '0',
        activityChecksum: v.activityChecksum || '',
        createdAt: v.createdAt || new Date().toISOString(),
        updatedAt: v.updatedAt || new Date().toISOString(),
        unvouchedAt: v.unvouchedAt || null,
        // Include user info for easier processing
        subjectUser: v.subjectUser,
      }));
    } catch (error) {
      logger.error(`Failed to get vouches for ${userkey}:`, error);
      return [];
    }
  }

  // Extract profileId from userkey
  private extractProfileId(userkey: string): number | null {
    if (userkey.startsWith('profileId:')) {
      return parseInt(userkey.replace('profileId:', ''), 10);
    }
    // For other formats, we'd need to fetch the profile first
    logger.warn(`Userkey format not directly supported for vouches: ${userkey}`);
    return null;
  }

  // Get user score
  async getScore(userkey: string): Promise<EthosScore | null> {
    try {
      const response = await this.client.get(
        `/api/v2/score/${encodeURIComponent(userkey)}`
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to get score for ${userkey}:`, error);
      return null;
    }
  }

  // Get received activities (reviews, slashes, etc.)
  async getReceivedActivities(
    userkey: string,
    types: ActivityType[] = ['review', 'slash'],
    options?: { limit?: number; offset?: number }
  ): Promise<EthosActivity[]> {
    try {
      const response = await this.client.post('/api/v2/activities/profile/received', {
        userkey,
        types,
        pagination: {
          limit: options?.limit || 50,
          offset: options?.offset || 0,
        },
      });
      // API returns 'values' array
      const activities = response.data?.values || response.data?.activities || [];
      if (!Array.isArray(activities)) {
        logger.warn(`Unexpected activities response for ${userkey}:`, typeof activities);
        return [];
      }
      return activities;
    } catch (error) {
      logger.error(`Failed to get received activities for ${userkey}:`, error);
      return [];
    }
  }

  // Get given activities (reviews posted by user)
  async getGivenActivities(
    userkey: string,
    types: ActivityType[] = ['review'],
    options?: { limit?: number; offset?: number }
  ): Promise<EthosActivity[]> {
    try {
      const response = await this.client.post('/api/v2/activities/profile/given', {
        userkey,
        types,
        pagination: {
          limit: options?.limit || 50,
          offset: options?.offset || 0,
        },
      });
      // API returns 'values' array
      const activities = response.data?.values || response.data?.activities || [];
      if (!Array.isArray(activities)) {
        logger.warn(`Unexpected activities response for ${userkey}:`, typeof activities);
        return [];
      }
      return activities;
    } catch (error) {
      logger.error(`Failed to get given activities for ${userkey}:`, error);
      return [];
    }
  }

  // Get a specific activity by ID
  async getActivity(activityType: ActivityType, activityId: string): Promise<EthosActivity | null> {
    try {
      const response = await this.client.get(
        `/api/v2/activities/${activityType}/${activityId}`
      );
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Post a review (defense)
  async postReview(
    targetUserkey: string,
    score: number,
    comment: string
  ): Promise<{ success: boolean; reviewId?: string; txHash?: string; error?: string }> {
    try {
      // Note: This endpoint may require specific authentication
      // The exact endpoint might differ based on Ethos API updates
      const response = await this.client.post('/api/v2/reviews', {
        target: targetUserkey,
        score,
        comment,
      });

      logger.info(`Review posted for ${targetUserkey}: score=${score}`);
      return {
        success: true,
        reviewId: response.data?.id || response.data?.reviewId,
        txHash: response.data?.txHash,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response?.data
        ? JSON.stringify(axiosError.response.data)
        : axiosError.message;

      logger.error(`Failed to post review for ${targetUserkey}: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Get profile URL
  getProfileUrl(addressOrProfileId: string | number): string {
    return `https://app.ethos.network/profile/${addressOrProfileId}`;
  }

  // Helper to create userkey from profile ID
  profileIdToUserkey(profileId: number): string {
    return `profileId:${profileId}`;
  }

  // Helper to create userkey from address
  addressToUserkey(address: string): string {
    return `address:${address}`;
  }

  // Check API health
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v2/apps', { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export const ethosService = new EthosService();
export default ethosService;
