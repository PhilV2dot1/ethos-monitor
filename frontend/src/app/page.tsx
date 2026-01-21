'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  MessageSquare,
  Bell,
  Shield,
  Activity,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import api, { Stats, Alert, MonitorLog } from '@/lib/api';
import StatsCard from '@/components/StatsCard';
import AlertCard from '@/components/AlertCard';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingAlerts, setPendingAlerts] = useState<Alert[]>([]);
  const [recentRuns, setRecentRuns] = useState<MonitorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, alertsRes] = await Promise.all([
        api.getStats(),
        api.getPendingAlerts(),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
        setRecentRuns(statsRes.data.recentRuns || []);
      }

      if (alertsRes.success && alertsRes.data) {
        setPendingAlerts(alertsRes.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const triggerMonitor = async () => {
    setIsTriggering(true);
    try {
      await api.triggerMonitor();
      await fetchData();
    } catch (error) {
      console.error('Error triggering monitor:', error);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleConfirm = async (alertId: string) => {
    try {
      await api.confirmDefense(alertId);
      await fetchData();
    } catch (error) {
      console.error('Error confirming defense:', error);
    }
  };

  const handleIgnore = async (alertId: string) => {
    try {
      await api.updateAlertStatus(alertId, 'IGNORED');
      await fetchData();
    } catch (error) {
      console.error('Error ignoring alert:', error);
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Monitor and protect your Ethos reputation
          </p>
        </div>
        <button
          onClick={triggerMonitor}
          disabled={isTriggering}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-lg font-medium
            transition-all duration-200
            ${isTriggering
              ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl'
            }
          `}
        >
          <RefreshCw className={`w-5 h-5 ${isTriggering ? 'animate-spin' : ''}`} />
          <span>{isTriggering ? 'Scanning...' : 'Scan Now'}</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Relations"
          value={stats?.activeRelations || 0}
          subtitle={`${stats?.totalRelations || 0} total`}
          icon={Users}
          color="indigo"
        />
        <StatsCard
          title="Reviews"
          value={stats?.totalReviews || 0}
          subtitle={`${stats?.negativeReviews || 0} negative`}
          icon={MessageSquare}
          color="blue"
        />
        <StatsCard
          title="Pending Alerts"
          value={stats?.pendingAlerts || 0}
          subtitle={`${stats?.totalAlerts || 0} total`}
          icon={Bell}
          color={stats?.pendingAlerts ? 'yellow' : 'green'}
        />
        <StatsCard
          title="Defenses"
          value={stats?.successfulDefenses || 0}
          subtitle={`${stats?.defensesSent || 0} attempted`}
          icon={Shield}
          color="green"
        />
      </div>

      {/* Monitor Status */}
      {stats?.monitorStatus && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`
                p-3 rounded-full
                ${stats.monitorStatus.isRunning
                  ? 'bg-yellow-100 dark:bg-yellow-900/30'
                  : 'bg-green-100 dark:bg-green-900/30'
                }
              `}>
                <Activity className={`
                  w-6 h-6
                  ${stats.monitorStatus.isRunning
                    ? 'text-yellow-600 dark:text-yellow-400 animate-pulse'
                    : 'text-green-600 dark:text-green-400'
                  }
                `} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Monitor Status
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {stats.monitorStatus.isRunning
                    ? 'Scanning in progress...'
                    : `Last scan: ${stats.monitorStatus.lastRunAt
                        ? new Date(stats.monitorStatus.lastRunAt).toLocaleString()
                        : 'Never'
                      }`
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Interval
              </p>
              <p className="font-semibold text-slate-900 dark:text-white">
                Every {stats.monitorStatus.intervalMinutes} min
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending Alerts */}
      {pendingAlerts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
              <AlertTriangle className="w-6 h-6 text-yellow-500 mr-2" />
              Pending Alerts
            </h2>
            <Link
              href="/alerts"
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-4">
            {pendingAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onConfirm={handleConfirm}
                onIgnore={handleIgnore}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
            Recent Scans
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Relations</th>
                  <th className="pb-3 font-medium">Reviews</th>
                  <th className="pb-3 font-medium">Negative</th>
                  <th className="pb-3 font-medium">Alerts</th>
                  <th className="pb-3 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-slate-100 dark:border-slate-700/50"
                  >
                    <td className="py-3 text-slate-900 dark:text-white">
                      {new Date(run.runAt).toLocaleString()}
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {run.relationsChecked}
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {run.reviewsFound}
                    </td>
                    <td className="py-3">
                      <span className={run.newNegative > 0 ? 'text-red-600 font-medium' : 'text-slate-600 dark:text-slate-300'}>
                        {run.newNegative}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {run.alertsSent}
                    </td>
                    <td className="py-3 text-slate-500 dark:text-slate-400">
                      {run.duration}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && pendingAlerts.length === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-8 text-center">
          <Shield className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-green-800 dark:text-green-200">
            All Clear!
          </h3>
          <p className="text-green-600 dark:text-green-400 mt-2">
            No pending alerts. Your relations are protected.
          </p>
        </div>
      )}
    </div>
  );
}
