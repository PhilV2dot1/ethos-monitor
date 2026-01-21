'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  Zap,
  User,
  ExternalLink,
  Check,
  X,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import type { Alert } from '@/lib/api';

interface AlertCardProps {
  alert: Alert;
  onConfirm?: (id: string) => void;
  onIgnore?: (id: string) => void;
}

export default function AlertCard({ alert, onConfirm, onIgnore }: AlertCardProps) {
  const isSlash = alert.type === 'SLASH';
  const isPending = alert.status === 'PENDING';

  const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    IGNORED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <div className={`
      bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 card-hover
      border-l-4 ${isSlash ? 'border-red-500' : 'border-orange-500'}
    `}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`
            p-2 rounded-full
            ${isSlash
              ? 'bg-red-100 dark:bg-red-900/30'
              : 'bg-orange-100 dark:bg-orange-900/30'
            }
          `}>
            {isSlash
              ? <Zap className="w-5 h-5 text-red-600 dark:text-red-400" />
              : <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            }
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {isSlash ? 'Slash Detected' : 'Negative Review'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {format(new Date(alert.sentAt), 'PPp', { locale: fr })}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[alert.status]}`}>
          {alert.status}
        </span>
      </div>

      {/* Content */}
      {alert.relation && (
        <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                {alert.relation.name || 'Unknown'}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                {alert.relation.address.slice(0, 6)}...{alert.relation.address.slice(-4)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Review Info */}
      {alert.review && (
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className={`
              px-2 py-1 rounded text-sm font-bold
              ${alert.review.score < 0
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              }
            `}>
              {alert.review.score > 0 ? '+' : ''}{alert.review.score}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              by {alert.review.authorName || 'Anonymous'}
            </span>
          </div>
          {alert.review.comment && (
            <p className="text-slate-600 dark:text-slate-300 italic">
              &ldquo;{alert.review.comment.slice(0, 150)}
              {alert.review.comment.length > 150 ? '...' : ''}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        {isPending ? (
          <div className="flex space-x-2">
            <button
              onClick={() => onConfirm?.(alert.id)}
              className="flex items-center space-x-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Defend</span>
            </button>
            <button
              onClick={() => onIgnore?.(alert.id)}
              className="flex items-center space-x-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Ignore</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              Responded {alert.respondedAt && format(new Date(alert.respondedAt), 'PPp', { locale: fr })}
            </span>
          </div>
        )}

        <Link
          href={`/defend/${alert.reviewId}`}
          className="flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <span>Details</span>
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
