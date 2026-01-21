const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      error: 'Failed to connect to API',
    };
  }
}

// Types
export interface Relation {
  id: string;
  userkey: string;
  name: string | null;
  address: string;
  avatarUrl: string | null;
  score: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    reviews: number;
    alerts: number;
  };
}

export interface Review {
  id: string;
  relationId: string;
  authorKey: string;
  authorName: string | null;
  authorAddr: string | null;
  score: number;
  comment: string | null;
  isNegative: boolean;
  alerted: boolean;
  createdAt: string;
  relation?: Relation;
}

export interface Alert {
  id: string;
  reviewId: string;
  relationId: string;
  type: 'NEGATIVE_REVIEW' | 'SLASH' | 'UNVOUCH';
  channel: 'TELEGRAM' | 'DISCORD' | 'TWITTER' | 'ALL';
  status: 'PENDING' | 'CONFIRMED' | 'IGNORED' | 'EXPIRED';
  messageId: string | null;
  sentAt: string;
  respondedAt: string | null;
  review?: Review;
  relation?: Relation;
}

export interface Defense {
  id: string;
  reviewId: string;
  targetKey: string;
  score: number;
  comment: string;
  status: 'PENDING' | 'CONFIRMED' | 'POSTED' | 'FAILED';
  createdAt: string;
  postedAt: string | null;
}

export interface Stats {
  totalRelations: number;
  activeRelations: number;
  totalReviews: number;
  negativeReviews: number;
  totalAlerts: number;
  pendingAlerts: number;
  defensesSent: number;
  successfulDefenses: number;
  monitorStatus?: {
    isRunning: boolean;
    lastRunAt: string | null;
    intervalMinutes: number;
  };
}

export interface MonitorLog {
  id: string;
  runAt: string;
  relationsChecked: number;
  reviewsFound: number;
  newNegative: number;
  alertsSent: number;
  errors: string | null;
  duration: number;
}

// API Functions
export const api = {
  // Health check
  async health() {
    return fetchApi('/health');
  },

  // Stats
  async getStats(): Promise<ApiResponse<Stats & { recentRuns: MonitorLog[] }>> {
    return fetchApi('/api/stats');
  },

  // Relations
  async getRelations(activeOnly = true): Promise<ApiResponse<Relation[]>> {
    return fetchApi(`/api/relations?active=${activeOnly}`);
  },

  async getRelation(id: string): Promise<ApiResponse<Relation>> {
    return fetchApi(`/api/relations/${id}`);
  },

  async refreshRelations(): Promise<ApiResponse<{ total: number; updated: number }>> {
    return fetchApi('/api/relations/refresh', { method: 'POST' });
  },

  // Reviews
  async getReviews(options?: {
    negative?: boolean;
    relationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Review[]> & { total?: number }> {
    const params = new URLSearchParams();
    if (options?.negative !== undefined) params.set('negative', String(options.negative));
    if (options?.relationId) params.set('relationId', options.relationId);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    return fetchApi(`/api/reviews?${params.toString()}`);
  },

  async getNegativeReviews(): Promise<ApiResponse<Review[]>> {
    return fetchApi('/api/reviews/negative');
  },

  // Alerts
  async getAlerts(options?: {
    status?: string;
    relationId?: string;
    limit?: number;
  }): Promise<ApiResponse<Alert[]> & { total?: number }> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.relationId) params.set('relationId', options.relationId);
    if (options?.limit) params.set('limit', String(options.limit));
    return fetchApi(`/api/alerts?${params.toString()}`);
  },

  async getPendingAlerts(): Promise<ApiResponse<Alert[]>> {
    return fetchApi('/api/alerts/pending');
  },

  async getAlert(id: string): Promise<ApiResponse<Alert & { pendingDefense?: Defense }>> {
    return fetchApi(`/api/alerts/${id}`);
  },

  async updateAlertStatus(id: string, status: string): Promise<ApiResponse<Alert>> {
    return fetchApi(`/api/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Defense
  async postDefense(data: {
    targetUserkey: string;
    score: number;
    comment: string;
    reviewId?: string;
    alertId?: string;
  }): Promise<ApiResponse<void>> {
    return fetchApi('/api/defend', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async confirmDefense(alertId: string): Promise<ApiResponse<void>> {
    return fetchApi(`/api/defend/confirm/${alertId}`, { method: 'POST' });
  },

  async getDefenseSuggestion(score = 3): Promise<ApiResponse<{ score: number; message: string }>> {
    return fetchApi(`/api/defend/suggest?score=${score}`);
  },

  async getPendingDefenses(): Promise<ApiResponse<Array<{ alert: Alert; defense: Defense }>>> {
    return fetchApi('/api/defend/pending');
  },

  // Monitor
  async triggerMonitor(): Promise<ApiResponse<MonitorLog>> {
    return fetchApi('/api/monitor/run', { method: 'POST' });
  },

  async getMonitorStatus(): Promise<ApiResponse<{
    monitorRunning: boolean;
    isRunning: boolean;
    lastRunAt: string | null;
    intervalMinutes: number;
  }>> {
    return fetchApi('/api/monitor/status');
  },

  // Config
  async getConfig(): Promise<ApiResponse<{
    monitorInterval: number;
    autoDefense: {
      enabled: boolean;
      requireConfirm: boolean;
      defaultScore: number;
    };
    notifications: {
      telegram: boolean;
      discord: boolean;
      twitter: boolean;
    };
  }>> {
    return fetchApi('/api/config');
  },

  // Settings
  async getSettings(): Promise<ApiResponse<{
    notifications: {
      telegram: { enabled: boolean; botToken: string; chatId: string };
      discord: { enabled: boolean; webhookUrl: string };
      twitter: { enabled: boolean; apiKey: string; apiSecret: string; accessToken: string; accessSecret: string };
    };
  }>> {
    return fetchApi('/api/settings');
  },

  async saveSettings(settings: {
    notifications: {
      telegram: { enabled: boolean; botToken: string; chatId: string };
      discord: { enabled: boolean; webhookUrl: string };
      twitter: { enabled: boolean; apiKey: string; apiSecret: string; accessToken: string; accessSecret: string };
    };
    autoDefense: { enabled: boolean; requireConfirm: boolean; defaultScore: number };
    monitorInterval: number;
  }): Promise<ApiResponse<void>> {
    return fetchApi('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  async testNotification(channel: 'telegram' | 'discord' | 'twitter'): Promise<ApiResponse<void>> {
    return fetchApi(`/api/settings/test/${channel}`, { method: 'POST' });
  },

  async updateToken(token: string): Promise<ApiResponse<void>> {
    return fetchApi('/api/token/update', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
};

export default api;
