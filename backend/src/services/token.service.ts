import jwt from 'jsonwebtoken';
import { config_values } from '../config/env.js';
import logger from '../utils/logger.js';
import ethosService from './ethos.service.js';
import fs from 'fs';
import path from 'path';

interface PrivyTokenPayload {
  sid: string;      // Session ID
  iss: string;      // Issuer (privy.io)
  iat: number;      // Issued at
  aud: string;      // Audience (app ID)
  sub: string;      // Subject (user DID)
  exp: number;      // Expiration
}

interface TokenStatus {
  valid: boolean;
  expiresAt: Date | null;
  expiresIn: number | null; // seconds
  isExpired: boolean;
  isExpiringSoon: boolean;  // < 1 hour
  userId: string | null;
  sessionId: string | null;
}

class TokenService {
  private currentToken: string | null = null;
  private tokenPayload: PrivyTokenPayload | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private onTokenExpiring: ((status: TokenStatus) => void) | null = null;

  constructor() {
    this.currentToken = config_values.ethos.privyToken || null;
    if (this.currentToken) {
      this.decodeToken(this.currentToken);
    }
  }

  // Decode JWT token (without verification - we don't have the public key)
  private decodeToken(token: string): PrivyTokenPayload | null {
    try {
      const decoded = jwt.decode(token) as PrivyTokenPayload;
      if (decoded) {
        this.tokenPayload = decoded;
        logger.info(`Token decoded: expires at ${new Date(decoded.exp * 1000).toISOString()}`);
        return decoded;
      }
    } catch (error) {
      logger.error('Failed to decode token:', error);
    }
    return null;
  }

  // Get current token status
  getStatus(): TokenStatus {
    if (!this.currentToken || !this.tokenPayload) {
      return {
        valid: false,
        expiresAt: null,
        expiresIn: null,
        isExpired: true,
        isExpiringSoon: true,
        userId: null,
        sessionId: null,
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = this.tokenPayload.exp - now;
    const isExpired = expiresIn <= 0;
    const isExpiringSoon = expiresIn < 3600; // < 1 hour

    return {
      valid: !isExpired,
      expiresAt: new Date(this.tokenPayload.exp * 1000),
      expiresIn: Math.max(0, expiresIn),
      isExpired,
      isExpiringSoon,
      userId: this.tokenPayload.sub,
      sessionId: this.tokenPayload.sid,
    };
  }

  // Update token
  async updateToken(newToken: string): Promise<{ success: boolean; status: TokenStatus; error?: string }> {
    try {
      // Decode the new token
      const payload = this.decodeToken(newToken);
      if (!payload) {
        return {
          success: false,
          status: this.getStatus(),
          error: 'Invalid token format',
        };
      }

      // Check if token is already expired
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now) {
        return {
          success: false,
          status: this.getStatus(),
          error: 'Token is already expired',
        };
      }

      // Update in memory
      this.currentToken = newToken;
      this.tokenPayload = payload;

      // Update Ethos service
      ethosService.setToken(newToken);

      // Update .env file
      await this.updateEnvFile(newToken);

      logger.info(`Token updated successfully, expires at ${new Date(payload.exp * 1000).toISOString()}`);

      return {
        success: true,
        status: this.getStatus(),
      };
    } catch (error) {
      logger.error('Failed to update token:', error);
      return {
        success: false,
        status: this.getStatus(),
        error: String(error),
      };
    }
  }

  // Update .env file with new token
  private async updateEnvFile(newToken: string): Promise<void> {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      let envContent = fs.readFileSync(envPath, 'utf-8');

      // Replace the token line
      const tokenRegex = /ETHOS_PRIVY_TOKEN=.*/;
      if (tokenRegex.test(envContent)) {
        envContent = envContent.replace(tokenRegex, `ETHOS_PRIVY_TOKEN=${newToken}`);
      } else {
        envContent += `\nETHOS_PRIVY_TOKEN=${newToken}`;
      }

      fs.writeFileSync(envPath, envContent);
      logger.info('.env file updated with new token');
    } catch (error) {
      logger.warn('Failed to update .env file:', error);
      // Don't throw - the in-memory update is still valid
    }
  }

  // Start monitoring token expiration
  startMonitoring(callback?: (status: TokenStatus) => void): void {
    this.onTokenExpiring = callback || null;

    // Check every 5 minutes
    this.checkInterval = setInterval(() => {
      this.checkTokenExpiration();
    }, 5 * 60 * 1000);

    // Initial check
    this.checkTokenExpiration();

    logger.info('Token expiration monitoring started');
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('Token expiration monitoring stopped');
  }

  // Check token expiration and trigger callback if needed
  private checkTokenExpiration(): void {
    const status = this.getStatus();

    if (status.isExpired) {
      logger.error('TOKEN EXPIRED! Please update your Privy token.');
      if (this.onTokenExpiring) {
        this.onTokenExpiring(status);
      }
    } else if (status.isExpiringSoon) {
      const hoursLeft = Math.floor((status.expiresIn || 0) / 3600);
      const minutesLeft = Math.floor(((status.expiresIn || 0) % 3600) / 60);
      logger.warn(`Token expiring soon! ${hoursLeft}h ${minutesLeft}m remaining.`);
      if (this.onTokenExpiring) {
        this.onTokenExpiring(status);
      }
    }
  }

  // Get current token
  getToken(): string | null {
    return this.currentToken;
  }

  // Format status for display
  formatStatus(): string {
    const status = this.getStatus();
    if (!status.valid) {
      return 'Token: EXPIRED or INVALID';
    }

    const hours = Math.floor((status.expiresIn || 0) / 3600);
    const minutes = Math.floor(((status.expiresIn || 0) % 3600) / 60);

    return `Token: Valid (expires in ${hours}h ${minutes}m)`;
  }
}

export const tokenService = new TokenService();
export default tokenService;
