'use client';

import { useEffect, useState } from 'react';
import { Bell, RefreshCw, Filter } from 'lucide-react';
import api, { Alert } from '@/lib/api';
import AlertCard from '@/components/AlertCard';

type FilterStatus = 'all' | 'PENDING' | 'CONFIRMED' | 'IGNORED';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [total, setTotal] = useState(0);

  const fetchAlerts = async (filterStatus: FilterStatus) => {
    setIsLoading(true);
    try {
      const result = await api.getAlerts({
        status: filterStatus === 'all' ? undefined : filterStatus,
        limit: 100,
      });

      if (result.success && result.data) {
        setAlerts(result.data);
        setTotal(result.total || result.data.length);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts(filter);
  }, [filter]);

  const handleConfirm = async (alertId: string) => {
    try {
      await api.confirmDefense(alertId);
      await fetchAlerts(filter);
    } catch (error) {
      console.error('Error confirming defense:', error);
    }
  };

  const handleIgnore = async (alertId: string) => {
    try {
      await api.updateAlertStatus(alertId, 'IGNORED');
      await fetchAlerts(filter);
    } catch (error) {
      console.error('Error ignoring alert:', error);
    }
  };

  const statusCounts = {
    all: total,
    PENDING: alerts.filter(a => a.status === 'PENDING').length,
    CONFIRMED: alerts.filter(a => a.status === 'CONFIRMED').length,
    IGNORED: alerts.filter(a => a.status === 'IGNORED').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center">
            <Bell className="w-8 h-8 mr-3 text-indigo-600" />
            Alerts
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {total} alerts tracked
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2">
        <Filter className="w-5 h-5 text-slate-400" />
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          {(['all', 'PENDING', 'CONFIRMED', 'IGNORED'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${filter === f
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }
              `}
            >
              {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              <span className="ml-2 text-xs text-slate-400">
                ({statusCounts[f]})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onConfirm={handleConfirm}
              onIgnore={handleIgnore}
            />
          ))}

          {/* Empty State */}
          {alerts.length === 0 && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-12 text-center">
              <Bell className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
                No Alerts Found
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                {filter === 'PENDING'
                  ? 'No pending alerts. All clear!'
                  : filter === 'CONFIRMED'
                  ? 'No confirmed defenses yet.'
                  : filter === 'IGNORED'
                  ? 'No ignored alerts.'
                  : 'Alerts will appear here when negative reviews are detected.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
