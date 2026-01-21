'use client';

import { useState } from 'react';
import { Shield, Send, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

interface DefendFormProps {
  targetUserkey: string;
  targetName?: string;
  reviewId?: string;
  alertId?: string;
  initialScore?: number;
  initialComment?: string;
  onSuccess?: () => void;
}

export default function DefendForm({
  targetUserkey,
  targetName,
  reviewId,
  alertId,
  initialScore = 3,
  initialComment = '',
  onSuccess,
}: DefendFormProps) {
  const [score, setScore] = useState(initialScore);
  const [comment, setComment] = useState(initialComment);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.postDefense({
        targetUserkey,
        score,
        comment,
        reviewId,
        alertId,
      });

      if (result.success) {
        setSuccess(true);
        onSuccess?.();
      } else {
        setError(result.error || 'Failed to post defense');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSuggestion = async () => {
    setIsLoading(true);
    try {
      const result = await api.getDefenseSuggestion(score);
      if (result.success && result.data) {
        setComment(result.data.message);
      }
    } catch {
      // Ignore errors for suggestion refresh
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 text-center">
        <Shield className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
          Defense Posted Successfully!
        </h3>
        <p className="text-green-600 dark:text-green-400 mt-2">
          Your positive review has been submitted to Ethos Network.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Target Info */}
      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Defending</p>
        <p className="font-semibold text-slate-900 dark:text-white">
          {targetName || targetUserkey}
        </p>
      </div>

      {/* Score Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Score
        </label>
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScore(s)}
              className={`
                w-12 h-12 rounded-lg font-bold text-lg transition-all
                ${score === s
                  ? 'bg-indigo-600 text-white scale-110 shadow-lg'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }
              `}
            >
              +{s}
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Comment
          </label>
          <button
            type="button"
            onClick={refreshSuggestion}
            className="flex items-center space-x-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Get suggestion</span>
          </button>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
          placeholder="Write a positive review..."
          required
        />
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {comment.length}/1000 characters
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !comment.trim()}
        className={`
          w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-semibold text-white
          transition-all duration-200
          ${isLoading || !comment.trim()
            ? 'bg-slate-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl'
          }
        `}
      >
        {isLoading ? (
          <RefreshCw className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Send className="w-5 h-5" />
            <span>Post Defense (+{score})</span>
          </>
        )}
      </button>
    </form>
  );
}
