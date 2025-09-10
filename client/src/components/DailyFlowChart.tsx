import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { useData } from '../context/DataContext';
import { openPylon, PYLON_VIEWS } from '../utils/pylonUtils';
import dayjs from 'dayjs';
import InfoIcon from './InfoIcon';
import CacheStatus from './CacheStatus';

const DailyFlowChart: React.FC = () => {
  const { state, refreshDailyFlow } = useData();
  const { analytics, loading, cacheStatus } = state;


  const formatDate = (dateString: string) => {
    return dayjs(dateString).format('MMM DD');
  };

  const handleBarClick = (dataKey: string) => {
    if (dataKey === 'closed') {
      openPylon(PYLON_VIEWS.CLOSED_BY_ASSIGNEE);
    } else {
      // For 'created' and 'cancelled' series
      openPylon(PYLON_VIEWS.ALL);
    }
  };

  // Only show loading if we have no data at all (stale-while-revalidate pattern)
  if (loading.dailyFlow && !analytics?.dailyFlow?.data?.length) {
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
              disabled={loading.dailyFlow}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading.dailyFlow ? 'animate-spin' : ''}`} />
              {loading.dailyFlow ? 'Refreshing...' : 'Refresh Daily Flow'}
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="flex items-center justify-center py-6" style={{ height: '320px' }}>
            <div className="text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-highlight mx-auto mb-3" />
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
              disabled={loading.dailyFlow}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading.dailyFlow ? 'animate-spin' : ''}`} />
              {loading.dailyFlow ? 'Refreshing...' : 'Refresh Daily Flow'}
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
    <div className="card h-full flex flex-col relative">
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
            <CacheStatus 
              metadata={cacheStatus.dailyFlow} 
              className="mt-1" 
            />
          </div>
          <button
            onClick={refreshDailyFlow}
            disabled={loading.dailyFlow}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading.dailyFlow ? 'animate-spin' : ''}`} />
            {loading.dailyFlow ? 'Refreshing...' : 'Refresh Daily Flow'}
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
                  backgroundColor: '#111827', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB',
                  fontSize: '12px',
                  padding: '8px 12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                }}
                labelStyle={{
                  color: '#F9FAFB',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
                itemStyle={{
                  color: '#F9FAFB',
                  fontSize: '12px'
                }}
                labelFormatter={(value) => `Date: ${formatDate(value)}`}
              />
              <Bar 
                dataKey="created" 
                fill="#A78BFA" 
                name="Created" 
                onClick={() => handleBarClick('created')}
                style={{ cursor: 'pointer' }}
              />
              <Bar 
                dataKey="closed" 
                fill="#10B981" 
                name="Closed" 
                onClick={() => handleBarClick('closed')}
                style={{ cursor: 'pointer' }}
              />
              <Bar 
                dataKey="cancelled" 
                fill="#F97316" 
                name="Cancelled" 
                onClick={() => handleBarClick('cancelled')}
                style={{ cursor: 'pointer' }}
              />
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
      
      {/* Info Icon */}
      <InfoIcon
        title="Daily Flow Chart"
        description="Shows ticket creation, closure, and cancellation trends over the last 14 days. Each bar represents a day with three data series showing different ticket lifecycle events."
        features={[
          'Purple bars: Tickets created each day',
          'Green bars: Tickets closed each day',
          'Orange bars: Tickets cancelled each day',
          'Click bars to open corresponding tickets in Pylon',
          'Hover for detailed daily statistics',
          'Updated automatically with latest data'
        ]}
        position="bottom-right"
      />
    </div>
  );
};

export default DailyFlowChart;
