'use client';

import { useEffect, useState } from 'react';
import { Users, RefreshCw, ExternalLink, MessageSquare, Bell } from 'lucide-react';
import api, { Relation } from '@/lib/api';

export default function RelationsPage() {
  const [relations, setRelations] = useState<Relation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchRelations = async () => {
    setIsLoading(true);
    try {
      const result = await api.getRelations();
      if (result.success && result.data) {
        setRelations(result.data);
      }
    } catch (error) {
      console.error('Error fetching relations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshFromEthos = async () => {
    setIsRefreshing(true);
    try {
      const result = await api.refreshRelations();
      if (result.success) {
        await fetchRelations();
      }
    } catch (error) {
      console.error('Error refreshing relations:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRelations();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center">
            <Users className="w-8 h-8 mr-3 text-indigo-600" />
            Relations
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {relations.length} relations being monitored
          </p>
        </div>
        <button
          onClick={refreshFromEthos}
          disabled={isRefreshing}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-lg font-medium
            transition-all duration-200
            ${isRefreshing
              ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg'
            }
          `}
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh from Ethos'}</span>
        </button>
      </div>

      {/* Relations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {relations.map((relation) => (
          <div
            key={relation.id}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 card-hover"
          >
            {/* Avatar and Name */}
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                {relation.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                  {relation.name || 'Unknown'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-mono truncate">
                  {relation.address}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center space-x-1 text-slate-500 dark:text-slate-400">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-xs">Reviews</span>
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {relation._count?.reviews || 0}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center space-x-1 text-slate-500 dark:text-slate-400">
                  <Bell className="w-4 h-4" />
                  <span className="text-xs">Alerts</span>
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {relation._count?.alerts || 0}
                </p>
              </div>
            </div>

            {/* Ethos Score */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Ethos Score
              </span>
              <span className={`
                px-3 py-1 rounded-full text-sm font-bold
                ${relation.score >= 0
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                }
              `}>
                {relation.score > 0 ? '+' : ''}{relation.score}
              </span>
            </div>

            {/* Status and Link */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
              <span className={`
                flex items-center space-x-1 text-sm
                ${relation.isActive
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-slate-400'
                }
              `}>
                <span className={`w-2 h-2 rounded-full ${relation.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                <span>{relation.isActive ? 'Active' : 'Inactive'}</span>
              </span>
              <a
                href={`https://app.ethos.network/profile/${relation.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
              >
                <span>View on Ethos</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {relations.length === 0 && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-12 text-center">
          <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
            No Relations Found
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6">
            Click &ldquo;Refresh from Ethos&rdquo; to sync your vouches.
          </p>
          <button
            onClick={refreshFromEthos}
            disabled={isRefreshing}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh from Ethos</span>
          </button>
        </div>
      )}
    </div>
  );
}
