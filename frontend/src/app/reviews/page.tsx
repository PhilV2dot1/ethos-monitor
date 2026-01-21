'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, RefreshCw, Filter, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api, { Review } from '@/lib/api';

type FilterType = 'all' | 'positive' | 'negative';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [total, setTotal] = useState(0);

  const fetchReviews = async (filterType: FilterType) => {
    setIsLoading(true);
    try {
      const result = await api.getReviews({
        negative: filterType === 'negative' ? true : filterType === 'positive' ? false : undefined,
        limit: 100,
      });

      if (result.success && result.data) {
        setReviews(result.data);
        setTotal(result.total || result.data.length);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(filter);
  }, [filter]);

  const filterCounts = {
    all: total,
    positive: reviews.filter(r => !r.isNegative).length,
    negative: reviews.filter(r => r.isNegative).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center">
            <MessageSquare className="w-8 h-8 mr-3 text-indigo-600" />
            Reviews
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {total} reviews tracked
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2">
        <Filter className="w-5 h-5 text-slate-400" />
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          {(['all', 'positive', 'negative'] as FilterType[]).map((f) => (
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
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-2 text-xs text-slate-400">
                ({filterCounts[f]})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className={`
                bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 card-hover
                border-l-4
                ${review.isNegative ? 'border-red-500' : 'border-green-500'}
              `}
            >
              <div className="flex items-start justify-between">
                {/* Left: Author and Target */}
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <span className={`
                      px-3 py-1 rounded-full text-sm font-bold
                      ${review.score < 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      }
                    `}>
                      {review.score > 0 ? '+' : ''}{review.score}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-sm">
                      by {review.authorName || review.authorAddr?.slice(0, 10) + '...' || 'Anonymous'}
                    </span>
                  </div>

                  {/* Target */}
                  {review.relation && (
                    <div className="mb-3">
                      <span className="text-sm text-slate-500 dark:text-slate-400">To: </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {review.relation.name || review.relation.address.slice(0, 10) + '...'}
                      </span>
                    </div>
                  )}

                  {/* Comment */}
                  {review.comment && (
                    <p className="text-slate-600 dark:text-slate-300">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                  )}
                </div>

                {/* Right: Date and Actions */}
                <div className="text-right ml-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {format(new Date(review.createdAt), 'PPp', { locale: fr })}
                  </p>
                  {review.alerted && (
                    <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded text-xs">
                      Alerted
                    </span>
                  )}
                  {review.relation && (
                    <a
                      href={`https://app.ethos.network/profile/${review.relation.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-end space-x-1 text-indigo-600 dark:text-indigo-400 hover:underline text-sm mt-2"
                    >
                      <span>View Profile</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Empty State */}
          {reviews.length === 0 && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-12 text-center">
              <MessageSquare className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
                No Reviews Found
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                {filter === 'negative'
                  ? 'No negative reviews detected yet.'
                  : filter === 'positive'
                  ? 'No positive reviews tracked yet.'
                  : 'Reviews will appear here when detected.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
