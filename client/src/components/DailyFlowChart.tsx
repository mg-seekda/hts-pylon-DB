import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { useData } from '../context/DataContext';
import dayjs from 'dayjs';

const DailyFlowChart: React.FC = () => {
  const { state, refreshDailyFlow } = useData();
  const { analytics, loading } = state;

  // Debug logging
  console.log('DailyFlowChart - analytics:', analytics);
  console.log('DailyFlowChart - dailyFlow data:', analytics?.dailyFlow?.data);

  const formatDate = (dateString: string) => {
    return dayjs(dateString).format('MMM DD');
  };

  if (loading.analytics) {
    return (
      <div className="card h-full flex flex-col">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Daily Flow (14 days)
              </h2>
              <p className="text-sm text-gray-300 mt-1">
                Ticket creation, closure, and cancellation trends
              </p>
            </div>
            <button
              onClick={refreshDailyFlow}
              disabled={loading.analytics}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading.analytics ? 'animate-spin' : ''}`} />
              Refresh Daily Flow
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="flex items-center justify-center py-6" style={{ height: '320px' }}>
            <div className="text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-3" />
              <p className="text-gray-300">Loading analytics data...</p>
              <p className="text-sm text-gray-300 mt-1">This may take a few seconds</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="card h-full flex flex-col">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Daily Flow (14 days)
              </h2>
              <p className="text-sm text-gray-300 mt-1">
                Ticket creation, closure, and cancellation trends
              </p>
            </div>
            <button
              onClick={refreshDailyFlow}
              disabled={loading.analytics}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading.analytics ? 'animate-spin' : ''}`} />
              Refresh Daily Flow
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="flex items-center justify-center" style={{ height: '320px' }}>
            <p className="text-gray-300">No analytics data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Daily Flow (14 days)
            </h2>
            <p className="text-sm text-gray-300 mt-1">
              Ticket creation and closure trends
            </p>
          </div>
          <button
            onClick={refreshDailyFlow}
            disabled={loading.analytics}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading.analytics ? 'animate-spin' : ''}`} />
            Refresh Analytics
          </button>
        </div>
      </div>
      <div className="card-body">
        <div style={{ height: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.dailyFlow?.data || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                tickFormatter={formatDate}
              />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
                labelFormatter={(value) => `Date: ${formatDate(value)}`}
              />
              <Bar dataKey="created" fill="#A78BFA" name="Created" />
              <Bar dataKey="closed" fill="#10B981" name="Closed" />
              <Bar dataKey="cancelled" fill="#F97316" name="Cancelled" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Color Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#A78BFA' }}></div>
            <span className="text-sm text-gray-300">Created</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10B981' }}></div>
            <span className="text-sm text-gray-300">Closed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#F97316' }}></div>
            <span className="text-sm text-gray-300">Cancelled</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyFlowChart;
