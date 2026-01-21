'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shield, ArrowLeft, RefreshCw, AlertTriangle, User, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import api, { Alert, Defense } from '@/lib/api';
import DefendForm from '@/components/DefendForm';

export default function DefendPage() {
  const params = useParams();
  const router = useRouter();
  const reviewId = params.id as string;

  const [alert, setAlert] = useState<(Alert & { pendingDefense?: Defense }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlert = async () => {
      setIsLoading(true);
      try {
        // First try to find by alert ID
        const result = await api.getAlert(reviewId);

        if (result.success && result.data) {
          setAlert(result.data);
        } else {
          // Try to find by review ID in alerts
          const alertsResult = await api.getAlerts({ limit: 100 });
          if (alertsResult.success && alertsResult.data) {
            const found = alertsResult.data.find(a => a.reviewId === reviewId);
            if (found) {
              const fullAlert = await api.getAlert(found.id);
              if (fullAlert.success && fullAlert.data) {
                setAlert(fullAlert.data);
              }
            }
          }
        }

        if (!alert) {
          setError('Alert not found');
        }
      } catch (err) {
        console.error('Error fetching alert:', err);
        setError('Failed to load alert data');
      } finally {
        setIsLoading(false);
      }
    };

    if (reviewId) {
      fetchAlert();
    }
  }, [reviewId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-200">
            {error || 'Alert not found'}
          </h2>
          <p className="text-red-600 dark:text-red-400 mt-2 mb-6">
            The alert you&apos;re looking for could not be found.
          </p>
          <Link
            href="/alerts"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Alerts</span>
          </Link>
        </div>
      </div>
    );
  }

  const isSlash = alert.type === 'SLASH';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button */}
      <Link
        href="/alerts"
        className="inline-flex items-center space-x-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to Alerts</span>
      </Link>

      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className={`
          p-3 rounded-xl
          ${isSlash
            ? 'bg-red-100 dark:bg-red-900/30'
            : 'bg-orange-100 dark:bg-orange-900/30'
          }
        `}>
          <Shield className={`w-8 h-8 ${isSlash ? 'text-red-600' : 'text-orange-600'}`} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Defend Against {isSlash ? 'Slash' : 'Negative Review'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Post a positive review to counter the negative impact
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attack Details */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Attack Details
          </h2>

          {/* Target */}
          {alert.relation && (
            <div className="mb-6">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Target</p>
              <div className="flex items-center space-x-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {alert.relation.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {alert.relation.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                    {alert.relation.address.slice(0, 8)}...{alert.relation.address.slice(-6)}
                  </p>
                </div>
                <a
                  href={`https://app.ethos.network/profile/${alert.relation.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              </div>
            </div>
          )}

          {/* Attacker */}
          {alert.review && (
            <div className="mb-6">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Attacker</p>
              <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-red-200 dark:bg-red-800 flex items-center justify-center">
                  <User className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {alert.review.authorName || 'Anonymous'}
                  </p>
                  {alert.review.authorAddr && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                      {alert.review.authorAddr.slice(0, 8)}...{alert.review.authorAddr.slice(-6)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Review Content */}
          {alert.review && (
            <div className="mb-6">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Review</p>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="px-2 py-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 rounded font-bold text-sm">
                    {alert.review.score > 0 ? '+' : ''}{alert.review.score}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {format(new Date(alert.review.createdAt), 'PPp', { locale: fr })}
                  </span>
                </div>
                {alert.review.comment && (
                  <p className="text-slate-700 dark:text-slate-300 italic">
                    &ldquo;{alert.review.comment}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <span className="text-sm text-slate-500 dark:text-slate-400">Status</span>
            <span className={`
              px-3 py-1 rounded-full text-sm font-medium
              ${alert.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : ''}
              ${alert.status === 'CONFIRMED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : ''}
              ${alert.status === 'IGNORED' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300' : ''}
            `}>
              {alert.status}
            </span>
          </div>
        </div>

        {/* Defense Form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Post Defense
          </h2>

          {alert.status === 'PENDING' && alert.relation ? (
            <DefendForm
              targetUserkey={alert.relation.userkey}
              targetName={alert.relation.name || undefined}
              reviewId={alert.reviewId}
              alertId={alert.id}
              initialScore={alert.pendingDefense?.score || 3}
              initialComment={alert.pendingDefense?.comment || ''}
              onSuccess={() => router.push('/alerts')}
            />
          ) : (
            <div className="text-center py-8">
              {alert.status === 'CONFIRMED' ? (
                <>
                  <Shield className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                    Already Defended
                  </h3>
                  <p className="text-green-600 dark:text-green-400 mt-2">
                    A defense has been posted for this review.
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                    Alert Ignored
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">
                    This alert has been marked as ignored.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
