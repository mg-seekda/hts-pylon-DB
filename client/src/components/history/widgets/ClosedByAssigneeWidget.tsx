import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, AlertCircle, BarChart3, Calendar, RefreshCw } from 'lucide-react';
import { HistoryWidgetProps } from '../historyWidgets';
import { apiService } from '../../../services/apiService';
import TimezoneUtils from '../../../utils/timezone';

interface ClosedByAssigneeData {
  bucket_start: string;
  assignee_id: string;
  assignee_name: string;
  count: number;
}

interface ChartDataPoint {
  bucket_start: string;
  [assigneeName: string]: string | number;
}

const ClosedByAssigneeWidget: React.FC<HistoryWidgetProps> = () => {
  // Get current week as default (Monday to current day)
  const getCurrentWeekRange = () => {
    const today = new Date();
    const monday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so 6 days back
    monday.setDate(today.getDate() - daysToMonday);
    
    return {
      from: monday.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    };
  };

  // Widget manages its own date range and bucket
  const [dateRange, setDateRange] = useState(getCurrentWeekRange());
  const [bucket, setBucket] = useState<'day' | 'week'>('day');
  const [data, setData] = useState<ClosedByAssigneeData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [hiddenAssignees, setHiddenAssignees] = useState<Set<string>>(new Set());
  const [selectedPreset, setSelectedPreset] = useState<string>('current-week');

  // Color palette for assignees
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  const getAssigneeColor = (index: number) => {
    return colors[index % colors.length];
  };

  // Helper functions for time period options
  const getCurrentMonthRange = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    return {
      from: firstDay.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    };
  };

  const getLastWeekRange = () => {
    const today = new Date();
    const lastWeekEnd = new Date(today);
    lastWeekEnd.setDate(today.getDate() - 7);
    
    const lastWeekStart = new Date(lastWeekEnd);
    const dayOfWeek = lastWeekEnd.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    lastWeekStart.setDate(lastWeekEnd.getDate() - daysToMonday);
    
    return {
      from: lastWeekStart.toISOString().split('T')[0],
      to: lastWeekEnd.toISOString().split('T')[0]
    };
  };

  const getLastMonthRange = () => {
    const today = new Date();
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    
    return {
      from: lastMonthStart.toISOString().split('T')[0],
      to: lastMonthEnd.toISOString().split('T')[0]
    };
  };

  // Handle preset selection
  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    switch (preset) {
      case 'current-week':
        setDateRange(getCurrentWeekRange());
        break;
      case 'current-month':
        setDateRange(getCurrentMonthRange());
        break;
      case 'last-week':
        setDateRange(getLastWeekRange());
        break;
      case 'last-month':
        setDateRange(getLastMonthRange());
        break;
      case 'custom':
        // Don't change date range for custom, let user select manually
        break;
      default:
        break;
    }
  };

  // Update preset selection when date range changes manually
  useEffect(() => {
    const currentWeek = getCurrentWeekRange();
    const currentMonth = getCurrentMonthRange();
    const lastWeek = getLastWeekRange();
    const lastMonth = getLastMonthRange();

    if (JSON.stringify(dateRange) === JSON.stringify(currentWeek)) {
      setSelectedPreset('current-week');
    } else if (JSON.stringify(dateRange) === JSON.stringify(currentMonth)) {
      setSelectedPreset('current-month');
    } else if (JSON.stringify(dateRange) === JSON.stringify(lastWeek)) {
      setSelectedPreset('last-week');
    } else if (JSON.stringify(dateRange) === JSON.stringify(lastMonth)) {
      setSelectedPreset('last-month');
    } else {
      setSelectedPreset('custom');
    }
  }, [dateRange]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getClosedByAssignee({
        from: dateRange.from,
        to: dateRange.to,
        bucket: bucket
      });

      const fetchedData = response.data || [];
      
      setData(fetchedData);

      // Process data for chart
      processChartData(fetchedData);
    } catch (err) {
      console.error('Error fetching closed by assignee data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, bucket]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const processChartData = (rawData: ClosedByAssigneeData[]) => {
    // Group data by bucket_start
    const groupedData: { [key: string]: ChartDataPoint } = {};
    const assigneeSet = new Set<string>();

    rawData.forEach(item => {
      const bucketKey = item.bucket_start;
      if (!groupedData[bucketKey]) {
        groupedData[bucketKey] = { bucket_start: bucketKey };
      }
      groupedData[bucketKey][item.assignee_name] = item.count;
      assigneeSet.add(item.assignee_name);
    });

    // Ensure all assignees have values for all dates (set to 0 if missing)
    const allAssignees = Array.from(assigneeSet);
    Object.values(groupedData).forEach(dataPoint => {
      allAssignees.forEach(assignee => {
        if (dataPoint[assignee] === undefined) {
          dataPoint[assignee] = 0;
        }
      });
    });

    // Convert to array and sort by date
    const chartDataArray = Object.values(groupedData).sort((a, b) => 
      new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime()
    );

    setChartData(chartDataArray);
    setAssignees(allAssignees);
  };

  const toggleAssignee = (assigneeName: string) => {
    const newHidden = new Set(hiddenAssignees);
    if (newHidden.has(assigneeName)) {
      newHidden.delete(assigneeName);
    } else {
      newHidden.add(assigneeName);
    }
    setHiddenAssignees(newHidden);
  };

  const formatTooltipLabel = (label: string) => {
    const date = new Date(label);
    return bucket === 'week' 
      ? `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Calculate total from all payload entries, ensuring we handle undefined values
      const total = payload.reduce((sum: number, entry: any) => {
        const value = entry.value;
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);
      
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">
            {formatTooltipLabel(label)}
          </p>
          <p className="text-blue-300 text-sm mb-2">
            Total: {total} tickets
          </p>
          {payload
            .filter((entry: any) => entry.value > 0) // Only show assignees with tickets
            .map((entry: any, index: number) => (
              <p key={index} className="text-sm" style={{ color: entry.color }}>
                {entry.name}: {entry.value}
              </p>
            ))}
        </div>
      );
    }
    return null;
  };

  const formatXAxisLabel = (tickItem: string) => {
    const date = new Date(tickItem);
    return bucket === 'week'
      ? `W${Math.ceil(date.getDate() / 7)}`
      : date.getDate().toString();
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-lg p-6 border border-gray-700"
      >
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading closed by assignee data...</span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-lg p-6 border border-gray-700"
      >
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-lg p-6 border border-gray-700"
      >
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold text-white">Closed by Assignee</h3>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center space-x-2 px-2 py-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm">Refresh</span>
            </button>
          </div>
          <p className="text-gray-400 text-sm">
            Tickets closed by assignee over time ({bucket === 'week' ? 'weekly' : 'daily'} view)
          </p>
        </div>

        {/* Compact filtering controls */}
        <div className="mb-4 flex items-center justify-between bg-gray-700/30 rounded-lg p-3 border border-gray-600/30">
          <div className="flex items-center space-x-3">
            {/* Date inputs */}
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            {/* Bucket selector */}
            <div className="flex bg-gray-600 rounded p-0.5">
              <button
                onClick={() => setBucket('day')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  bucket === 'day' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setBucket('week')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  bucket === 'week' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Week
              </button>
            </div>
          </div>

          {/* Quick buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setDateRange({ from: '2025-09-01', to: '2025-09-05' })}
              className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs hover:bg-blue-600/30 transition-colors"
            >
              Known Data
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                setDateRange({
                  from: weekAgo.toISOString().split('T')[0],
                  to: today.toISOString().split('T')[0]
                });
              }}
              className="px-2 py-1 bg-gray-600/50 text-gray-300 rounded text-xs hover:bg-gray-600 transition-colors"
            >
              Last 7 Days
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-gray-400 mb-4">
              <BarChart3 className="w-16 h-16 mx-auto mb-4" />
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">No Data Available</h4>
            <p className="text-gray-400 mb-4">
              No closed tickets found for the selected period
            </p>
            <div className="text-sm text-gray-500 space-y-1">
              <p>Selected period: {dateRange.from} to {dateRange.to}</p>
              <p>View: {bucket === 'week' ? 'Weekly' : 'Daily'} aggregation</p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => setDateRange(getCurrentWeekRange())}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Current Week
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-lg p-6 border border-gray-700"
    >
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold text-white">Closed by Assignee</h3>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-2 px-2 py-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Refresh</span>
          </button>
        </div>
        <p className="text-gray-400 text-sm">
          Tickets closed by assignee over time ({bucket === 'week' ? 'weekly' : 'daily'} view)
        </p>
      </div>

      {/* Compact filtering controls */}
      <div className="mb-4 flex items-center justify-between bg-gray-700/30 rounded-lg p-3 border border-gray-600/30">
        <div className="flex items-center space-x-3">
          {/* Time period dropdown - moved to front */}
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="current-week">Current Week</option>
            <option value="current-month">Current Month</option>
            <option value="last-week">Last Week</option>
            <option value="last-month">Last Month</option>
            <option value="custom">Custom Range</option>
          </select>

          {/* Date inputs */}
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          
          {/* Bucket selector */}
          <div className="flex bg-gray-600 rounded p-0.5">
            <button
              onClick={() => setBucket('day')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                bucket === 'day' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setBucket('week')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                bucket === 'week' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>


      {/* Legend */}
      {assignees.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {assignees.map((assignee, index) => (
              <button
                key={assignee}
                onClick={() => toggleAssignee(assignee)}
                className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm transition-colors ${
                  hiddenAssignees.has(assignee)
                    ? 'bg-gray-700 text-gray-500 opacity-50'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getAssigneeColor(index) }}
                />
                <span>{assignee}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="bucket_start" 
              tickFormatter={formatXAxisLabel}
              stroke="#9CA3AF"
              fontSize={12}
            />
            <YAxis 
              stroke="#9CA3AF"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {assignees.map((assignee, index) => (
              <Bar
                key={assignee}
                dataKey={assignee}
                stackId="assignees"
                fill={getAssigneeColor(index)}
                hide={hiddenAssignees.has(assignee)}
                name={assignee}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Total Tickets</div>
            <div className="text-white font-semibold">
              {data.reduce((sum, item) => sum + item.count, 0)}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Assignees</div>
            <div className="text-white font-semibold">{assignees.length}</div>
          </div>
          <div>
            <div className="text-gray-400">Period</div>
            <div className="text-white font-semibold">
              {chartData.length} {bucket === 'week' ? 'weeks' : 'days'}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Avg per {bucket === 'week' ? 'week' : 'day'}</div>
            <div className="text-white font-semibold">
              {Math.round(data.reduce((sum, item) => sum + item.count, 0) / chartData.length)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ClosedByAssigneeWidget;
