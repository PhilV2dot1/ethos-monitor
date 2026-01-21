// Types for Ethos API responses and internal use

// Ethos API Types
export interface EthosProfile {
  id: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  invitesAvailable: number;
  invitedBy: number | null;
  name: string | null;
  username: string | null;
  avatar: string | null;
  description: string | null;
  primaryAddress: string;
}

export interface EthosVouch {
  id: number;
  archived: boolean;
  authorProfileId: number;
  subjectProfileId: number;
  comment: string | null;
  staked: string;
  activityChecksum: string;
  createdAt: string;
  updatedAt: string;
  unvouchedAt: string | null;
  // Added from API response - includes subject user details
  subjectUser?: {
    profileId: number;
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
    primaryAddress?: string;
    userkeys?: string[];
  };
}

export interface EthosActivity {
  id?: string;
  type: ActivityType;
  data: ActivityData;
  createdAt?: string;
  timestamp?: number; // Unix timestamp from API
  author: {
    profileId: number;
    name: string | null;
    username: string | null;
    avatar: string | null;
    primaryAddress: string;
  };
  subject: {
    profileId: number;
    name: string | null;
    username: string | null;
    avatar: string | null;
    primaryAddress: string;
  };
}

export type ActivityType =
  | 'review'
  | 'slash'
  | 'vouch'
  | 'unvouch'
  | 'attestation'
  | 'vote'
  | 'reply';

export interface ActivityData {
  id?: number | string;
  score?: number | string; // API returns "positive", "negative", "neutral" for reviews
  comment?: string;
  archived?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: number | string; // Unix timestamp
}

export interface EthosScore {
  profileId: number;
  score: number;
  reviewsReceived: number;
  reviewsGiven: number;
  vouchesReceived: number;
  vouchesGiven: number;
}

// Internal Types
export interface AlertPayload {
  type: 'NEGATIVE_REVIEW' | 'SLASH' | 'UNVOUCH';
  target: {
    name: string | null;
    address: string;
    profileUrl: string;
    profileId: number;
  };
  attacker: {
    name: string | null;
    address: string;
    profileId: number;
  };
  score: number;
  comment: string | null;
  timestamp: Date;
  reviewId: string;
  relationId: string;
  autoDefense?: {
    enabled: boolean;
    requireConfirm: boolean;
    suggestedScore: number;
    suggestedComment: string;
  };
}

export interface DefensePayload {
  targetUserkey: string;
  score: number;
  comment: string;
  reviewId: string;
}

export interface MonitorResult {
  relationsChecked: number;
  reviewsFound: number;
  newNegative: number;
  alertsSent: number;
  errors: string[];
  duration: number;
}

// API Request/Response Types
export interface PaginatedRequest {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Telegram Callback Data
export interface TelegramCallbackData {
  action: 'confirm' | 'edit' | 'ignore';
  alertId: string;
  reviewId: string;
}

// Stats
export interface Stats {
  totalRelations: number;
  activeRelations: number;
  totalReviews: number;
  negativeReviews: number;
  totalAlerts: number;
  pendingAlerts: number;
  defensesSent: number;
  successfulDefenses: number;
}

// Defense Templates
export interface DefenseTemplate {
  score: number;
  messages: string[];
}

export const DEFENSE_TEMPLATES: DefenseTemplate[] = [
  {
    score: 3,
    messages: [
      "Trusted and reliable community member. I vouch for their credibility.",
      "Known for integrity and positive contributions to the ecosystem.",
      "Solid reputation backed by consistent positive interactions.",
      "A valued member of the community with proven trustworthiness.",
    ]
  },
  {
    score: 2,
    messages: [
      "Positive experience with this community member.",
      "Reliable and trustworthy in my interactions.",
      "Good standing member of the community.",
    ]
  }
];

export function getRandomDefenseMessage(score: number = 3): { score: number; message: string } {
  const template = DEFENSE_TEMPLATES.find(t => t.score === score) || DEFENSE_TEMPLATES[0];
  const message = template.messages[Math.floor(Math.random() * template.messages.length)];
  return { score: template.score, message };
}
