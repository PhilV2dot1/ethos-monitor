'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Bell,
  Send,
  MessageCircle,
  Twitter,
  Save,
  TestTube,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  Shield,
  Clock,
  Zap,
} from 'lucide-react';
import api from '@/lib/api';

interface NotificationSettings {
  telegram: {
    enabled: boolean;
    botToken: string;
    chatId: string;
  };
  discord: {
    enabled: boolean;
    webhookUrl: string;
  };
  twitter: {
    enabled: boolean;
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessSecret: string;
  };
}

interface AutoDefenseSettings {
  enabled: boolean;
  requireConfirm: boolean;
  defaultScore: number;
}

interface TokenStatus {
  valid: boolean;
  expiresAt: string | null;
  expiresIn: number;
  isExpiringSoon: boolean;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ channel: string; success: boolean; message: string } | null>(null);

  const [notifications, setNotifications] = useState<NotificationSettings>({
    telegram: { enabled: false, botToken: '', chatId: '' },
    discord: { enabled: false, webhookUrl: '' },
    twitter: { enabled: false, apiKey: '', apiSecret: '', accessToken: '', accessSecret: '' },
  });

  const [autoDefense, setAutoDefense] = useState<AutoDefenseSettings>({
    enabled: true,
    requireConfirm: true,
    defaultScore: 3,
  });

  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [newToken, setNewToken] = useState('');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [monitorInterval, setMonitorInterval] = useState(5);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [configRes, healthRes, settingsRes] = await Promise.all([
        api.getConfig(),
        api.health(),
        api.getSettings(),
      ]);

      if (configRes.success && configRes.data) {
        setAutoDefense(configRes.data.autoDefense);
        setMonitorInterval(configRes.data.monitorInterval);
      }

      if (healthRes.success && (healthRes as { data?: { token?: TokenStatus } }).data?.token) {
        setTokenStatus((healthRes as { data: { token: TokenStatus } }).data.token);
      }

      if (settingsRes.success && settingsRes.data) {
        setNotifications(settingsRes.data.notifications);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const result = await api.saveSettings({
        notifications,
        autoDefense,
        monitorInterval,
      });

      if (result.success) {
        setTestResult({ channel: 'settings', success: true, message: 'Settings saved successfully!' });
      } else {
        setTestResult({ channel: 'settings', success: false, message: result.error || 'Failed to save settings' });
      }
    } catch (error) {
      setTestResult({ channel: 'settings', success: false, message: 'Failed to save settings' });
    } finally {
      setSaving(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const testNotification = async (channel: 'telegram' | 'discord' | 'twitter') => {
    setTesting(channel);
    setTestResult(null);
    try {
      const result = await api.testNotification(channel);
      setTestResult({
        channel,
        success: result.success,
        message: result.success ? `${channel} notification sent!` : result.error || 'Test failed',
      });
    } catch (error) {
      setTestResult({ channel, success: false, message: 'Test failed' });
    } finally {
      setTesting(null);
    }
  };

  const updateToken = async () => {
    if (!newToken.trim()) return;

    setSaving(true);
    try {
      const result = await api.updateToken(newToken);
      if (result.success) {
        setTestResult({ channel: 'token', success: true, message: 'Token updated successfully!' });
        setNewToken('');
        loadSettings();
      } else {
        setTestResult({ channel: 'token', success: false, message: result.error || 'Failed to update token' });
      }
    } catch (error) {
      setTestResult({ channel: 'token', success: false, message: 'Failed to update token' });
    } finally {
      setSaving(false);
    }
  };

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-indigo-600" />
            Settings
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Configure notifications and auto-defense settings
          </p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save All Settings
        </button>
      </div>

      {/* Test Result Toast */}
      {testResult && (
        <div className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg z-50 ${
          testResult.success ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {testResult.success ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Token Status Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${tokenStatus?.valid ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <Shield className={`w-6 h-6 ${tokenStatus?.valid ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Ethos API Token</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Required for posting defense reviews</p>
              </div>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              tokenStatus?.valid
                ? tokenStatus.isExpiringSoon
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {tokenStatus?.valid ? (tokenStatus.isExpiringSoon ? 'Expiring Soon' : 'Valid') : 'Expired'}
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {tokenStatus?.expiresAt && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Clock className="w-4 h-4" />
              <span>Expires: {new Date(tokenStatus.expiresAt).toLocaleString()}</span>
            </div>
          )}
          <div className="flex gap-3">
            <input
              type="password"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              placeholder="Paste new Privy token here..."
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={updateToken}
              disabled={!newToken.trim() || saving}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              Update Token
            </button>
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">How to get your Privy token:</p>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>Go to <a href="https://app.ethos.network" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">app.ethos.network</a> and log in</li>
                <li>Open DevTools (F12) → Application → Cookies</li>
                <li>Copy the <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">privy-token</code> value</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Telegram Configuration */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Send className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Telegram</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Get instant alerts via Telegram bot</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.telegram.enabled}
                onChange={(e) => setNotifications(prev => ({
                  ...prev,
                  telegram: { ...prev.telegram, enabled: e.target.checked }
                }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
        <div className={`p-6 space-y-4 transition-opacity ${notifications.telegram.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Bot Token</label>
            <div className="relative">
              <input
                type={showSecrets['telegramToken'] ? 'text' : 'password'}
                value={notifications.telegram.botToken}
                onChange={(e) => setNotifications(prev => ({
                  ...prev,
                  telegram: { ...prev.telegram, botToken: e.target.value }
                }))}
                placeholder="123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => toggleSecret('telegramToken')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showSecrets['telegramToken'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Chat ID</label>
            <input
              type="text"
              value={notifications.telegram.chatId}
              onChange={(e) => setNotifications(prev => ({
                ...prev,
                telegram: { ...prev.telegram, chatId: e.target.value }
              }))}
              placeholder="Your chat ID (e.g., 123456789)"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              <ExternalLink className="w-4 h-4" />
              Create bot with @BotFather
            </a>
            <button
              onClick={() => testNotification('telegram')}
              disabled={testing === 'telegram' || !notifications.telegram.botToken || !notifications.telegram.chatId}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {testing === 'telegram' ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
              Test
            </button>
          </div>
        </div>
      </div>

      {/* Discord Configuration */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
                <MessageCircle className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Discord</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Receive alerts in your Discord channel</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.discord.enabled}
                onChange={(e) => setNotifications(prev => ({
                  ...prev,
                  discord: { ...prev.discord, enabled: e.target.checked }
                }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
        <div className={`p-6 space-y-4 transition-opacity ${notifications.discord.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Webhook URL</label>
            <div className="relative">
              <input
                type={showSecrets['discordWebhook'] ? 'text' : 'password'}
                value={notifications.discord.webhookUrl}
                onChange={(e) => setNotifications(prev => ({
                  ...prev,
                  discord: { ...prev.discord, webhookUrl: e.target.value }
                }))}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => toggleSecret('discordWebhook')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showSecrets['discordWebhook'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Server Settings → Integrations → Webhooks → New Webhook</span>
            </div>
            <button
              onClick={() => testNotification('discord')}
              disabled={testing === 'discord' || !notifications.discord.webhookUrl}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {testing === 'discord' ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
              Test
            </button>
          </div>
        </div>
      </div>

      {/* X/Twitter Configuration */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl">
                <Twitter className="w-6 h-6 text-slate-900 dark:text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">X (Twitter)</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Get notified via X/Twitter DM</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.twitter.enabled}
                onChange={(e) => setNotifications(prev => ({
                  ...prev,
                  twitter: { ...prev.twitter, enabled: e.target.checked }
                }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
        <div className={`p-6 space-y-4 transition-opacity ${notifications.twitter.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">API Key</label>
              <div className="relative">
                <input
                  type={showSecrets['twitterApiKey'] ? 'text' : 'password'}
                  value={notifications.twitter.apiKey}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    twitter: { ...prev.twitter, apiKey: e.target.value }
                  }))}
                  placeholder="Your API Key"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret('twitterApiKey')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showSecrets['twitterApiKey'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">API Secret</label>
              <div className="relative">
                <input
                  type={showSecrets['twitterApiSecret'] ? 'text' : 'password'}
                  value={notifications.twitter.apiSecret}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    twitter: { ...prev.twitter, apiSecret: e.target.value }
                  }))}
                  placeholder="Your API Secret"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret('twitterApiSecret')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showSecrets['twitterApiSecret'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Access Token</label>
              <div className="relative">
                <input
                  type={showSecrets['twitterAccessToken'] ? 'text' : 'password'}
                  value={notifications.twitter.accessToken}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    twitter: { ...prev.twitter, accessToken: e.target.value }
                  }))}
                  placeholder="Your Access Token"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret('twitterAccessToken')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showSecrets['twitterAccessToken'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Access Secret</label>
              <div className="relative">
                <input
                  type={showSecrets['twitterAccessSecret'] ? 'text' : 'password'}
                  value={notifications.twitter.accessSecret}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    twitter: { ...prev.twitter, accessSecret: e.target.value }
                  }))}
                  placeholder="Your Access Secret"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret('twitterAccessSecret')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showSecrets['twitterAccessSecret'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <a
              href="https://developer.twitter.com/en/portal/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              <ExternalLink className="w-4 h-4" />
              X Developer Portal
            </a>
            <button
              onClick={() => testNotification('twitter')}
              disabled={testing === 'twitter' || !notifications.twitter.apiKey}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {testing === 'twitter' ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
              Test
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Defense Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
              <Zap className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Auto-Defense</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Automatic response to negative reviews</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white">Enable Auto-Defense</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Automatically prepare defense responses</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoDefense.enabled}
                onChange={(e) => setAutoDefense(prev => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white">Require Confirmation</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Ask for confirmation before posting defense</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoDefense.requireConfirm}
                onChange={(e) => setAutoDefense(prev => ({ ...prev, requireConfirm: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Default Defense Score</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="5"
                value={autoDefense.defaultScore}
                onChange={(e) => setAutoDefense(prev => ({ ...prev, defaultScore: parseInt(e.target.value) }))}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
              />
              <span className="w-8 text-center font-bold text-indigo-600 text-lg">+{autoDefense.defaultScore}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Monitor Interval (minutes)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="30"
                value={monitorInterval}
                onChange={(e) => setMonitorInterval(parseInt(e.target.value))}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
              />
              <span className="w-12 text-center font-bold text-indigo-600 text-lg">{monitorInterval}m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
