import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Clock, RefreshCw, BarChart3, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import InfoIcon from '../../InfoIcon';
import TimezoneUtils from '../../../utils/timezone';

interface TicketLifecycleData {
  date: string;
  status: string;
  avgDurationSeconds: number;
  avgDurationFormatted: string;
  countSegments: number;
}

interface TicketLifecycleResponse {
  data: TicketLifecycleData[];
  grouping: 'day' | 'week';
  hoursMode: 'wall' | 'business';
  from: string;
  to: string;
  totalSamples: number;
  ingestionMetadata?: {
    lastIngestionDate: string | null;
    nextScheduledRun: string | null;
    isRunning: boolean;
  };
}

const TicketLifecycleWidget: React.FC = () => {
  const [data, setData] = useState<TicketLifecycleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoursMode, setHoursMode] = useState<'wall' | 'business'>('business');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [ingestionMetadata, setIngestionMetadata] = useState<{
    lastIngestionDate: string | null;
    nextScheduledRun: string | null;
    isRunning: boolean;
  } | null>(null);
  
  // Date range and grouping state
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [grouping, setGrouping] = useState<'day' | 'week'>('day');
  const [selectedPreset, setSelectedPreset] = useState<string>('current-week');
  
  // Refs to access current values without causing re-renders
  const fromDateRef = useRef(fromDate);
  const toDateRef = useRef(toDate);
  const groupingRef = useRef(grouping);
  const hoursModeRef = useRef(hoursMode);
  const selectedStatusesRef = useRef(selectedStatuses);

  // Keep refs in sync with state
  useEffect(() => {
    fromDateRef.current = fromDate;
  }, [fromDate]);

  useEffect(() => {
    toDateRef.current = toDate;
  }, [toDate]);

  useEffect(() => {
    groupingRef.current = grouping;
  }, [grouping]);

  useEffect(() => {
    hoursModeRef.current = hoursMode;
  }, [hoursMode]);

  useEffect(() => {
    selectedStatusesRef.current = selectedStatuses;
  }, [selectedStatuses]);


  // Component to display last ingestion date
  const LastIngestionInfo = () => {
    if (!ingestionMetadata?.lastIngestionDate) return null;

    const formatDate = (dateString: string) => {
      return dayjs(dateString).format('MMM DD, YYYY [at] HH:mm');
    };

    return (
      <div className="text-xs text-gray-400 mt-1">
        <span className="text-yellow-400">⚠️</span> Last data ingestion: {formatDate(ingestionMetadata.lastIngestionDate)}
        {ingestionMetadata.nextScheduledRun && (
          <span className="ml-2">
            • Next run: {dayjs(ingestionMetadata.nextScheduledRun).format('MMM DD, HH:mm')}
          </span>
        )}
      </div>
    );
  };

  // Initialize with current week as default
  useEffect(() => {
    const initializeWithCurrentWeek = () => {
      // Always default to current week
      const currentWeek = getCurrentWeekRange();
      setFromDate(currentWeek.from);
      setToDate(currentWeek.to);
      setSelectedPreset('current-week');
    };

    initializeWithCurrentWeek();
  }, []);

  // Color palette for different statuses
  const statusColors: { [key: string]: string } = {
    'New': '#A78BFA',
    'Open': '#3B82F6',
    'In Progress': '#F59E0B',
    'Pending': '#8B5CF6',
    'Waiting on Customer': '#EF4444',
    'On Hold': '#6B7280',
    'Closed': '#10B981',
    'Cancelled': '#F97316',
    'Resolved': '#059669',
    'Waiting on You': '#F59E0B'
  };

  const fetchData = useCallback(async () => {
    // Don't fetch if dates are not set
    if (!fromDateRef.current || !toDateRef.current) {
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        from: fromDateRef.current,
        to: toDateRef.current,
        grouping: groupingRef.current,
        hoursMode: hoursModeRef.current
      });

      if (selectedStatusesRef.current.length > 0) {
        const statusString = selectedStatusesRef.current.join(',');
        params.append('status', statusString);
      }

      const url = `/api/ticket-lifecycle/data?${params}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: TicketLifecycleResponse = await response.json();
      setData(result);
      setIngestionMetadata(result.ingestionMetadata || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Error fetching ticket lifecycle data:', err);
    } finally {
      setLoading(false);
    }
  }, []); // Remove dependencies to prevent infinite loops

  const fetchStatuses = async () => {
    try {
      const response = await fetch('/api/ticket-lifecycle/statuses');
      if (response.ok) {
        const result = await response.json();
        setAvailableStatuses(result.statuses);
        setSelectedStatuses(result.statuses); // Select all by default
      }
    } catch (err) {
      console.error('Error fetching statuses:', err);
    }
  };

  // Removed initial fetchData call - now handled by selectedStatuses useEffect

  useEffect(() => {
    fetchStatuses();
  }, []);

  // Fetch data when selectedStatuses changes
  useEffect(() => {
    if (fromDate && toDate && selectedStatuses.length > 0) {
      fetchData();
    }
  }, [fetchData, selectedStatuses, fromDate, toDate, grouping, hoursMode]); // Include fetchData in dependencies

  const formatDate = (dateString: string) => {
    if (grouping === 'week') {
      return dateString; // Already formatted as "2024-W01"
    }
    return dayjs(dateString).format('MMM DD');
  };

  const formatDuration = (seconds: number) => {
    // If less than a minute, show seconds
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Calculate total duration from all payload entries
      const totalDuration = payload.reduce((sum: number, entry: any) => {
        const value = entry.value;
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);
      
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">
            {formatDate(label)}
          </p>
          <p className="text-blue-300 text-sm mb-2">
            Total: {formatDuration(totalDuration)}
          </p>
          {payload
            .filter((entry: any) => entry.value > 0) // Only show statuses with duration
            .map((entry: any, index: number) => (
              <p key={index} className="text-sm" style={{ color: entry.color }}>
                {entry.name}: {formatDuration(entry.value)}
              </p>
            ))}
        </div>
      );
    }
    return null;
  };

  // Transform data for chart
  const chartData = React.useMemo(() => {
    if (!data?.data) return [];

    const groupedData: { [key: string]: any } = {};

    data.data.forEach(item => {
      const key = item.date;
      if (!groupedData[key]) {
        groupedData[key] = { date: key };
      }
      // Convert to number to ensure proper chart rendering
      groupedData[key][item.status] = Number(item.avgDurationSeconds);
      groupedData[key][`${item.status}_count`] = Number(item.countSegments);
    });

    return Object.values(groupedData);
  }, [data]);

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleRefresh = () => {
    fetchData();
  };


  const handleBucketChange = (newBucket: 'day' | 'week') => {
    setGrouping(newBucket);
  };

  // Helper functions for time period options
  const getCurrentWeekRange = () => {
    const weekStart = TimezoneUtils.getStartOfWeek();
    const weekEnd = TimezoneUtils.getEndOfWeek();
    
    return {
      from: weekStart.format('YYYY-MM-DD'),
      to: weekEnd.format('YYYY-MM-DD')
    };
  };

  const getCurrentMonthRange = () => {
    const today = dayjs();
    const firstDay = today.startOf('month');
    
    return {
      from: firstDay.format('YYYY-MM-DD'),
      to: today.format('YYYY-MM-DD')
    };
  };

  const getLastWeekRange = () => {
    const today = dayjs();
    const lastWeekEnd = today.subtract(7, 'day');
    const lastWeekStart = lastWeekEnd.startOf('week').add(1, 'day');
    
    return {
      from: lastWeekStart.format('YYYY-MM-DD'),
      to: lastWeekEnd.format('YYYY-MM-DD')
    };
  };

  const getLastMonthRange = () => {
    const today = dayjs();
    const lastMonthEnd = today.subtract(1, 'month').endOf('month');
    const lastMonthStart = lastMonthEnd.startOf('month');
    
    return {
      from: lastMonthStart.format('YYYY-MM-DD'),
      to: lastMonthEnd.format('YYYY-MM-DD')
    };
  };

  // Handle preset selection
  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    switch (preset) {
      case 'current-week':
        const currentWeek = getCurrentWeekRange();
        setFromDate(currentWeek.from);
        setToDate(currentWeek.to);
        break;
      case 'current-month':
        const currentMonth = getCurrentMonthRange();
        setFromDate(currentMonth.from);
        setToDate(currentMonth.to);
        break;
      case 'last-week':
        const lastWeek = getLastWeekRange();
        setFromDate(lastWeek.from);
        setToDate(lastWeek.to);
        break;
      case 'last-month':
        const lastMonth = getLastMonthRange();
        setFromDate(lastMonth.from);
        setToDate(lastMonth.to);
        break;
      case 'custom':
        // Don't change date range for custom, let user select manually
        break;
      default:
        break;
    }
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
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading ticket lifecycle data...</span>
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

  if (!data || data.data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-lg p-6 border border-gray-700 min-h-[725px] relative flex flex-col"
      >
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xl font-semibold text-white">Ticket Lifecycle</h3>
              <LastIngestionInfo />
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center space-x-2 px-2 py-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm">Refresh</span>
            </button>
          </div>
          <p className="text-gray-400 text-sm">
            Average time spent in each ticket status ({grouping === 'week' ? 'weekly' : 'daily'} view)
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
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            {/* Bucket selector */}
            <div className="flex bg-gray-600 rounded p-0.5">
              <button
                onClick={() => handleBucketChange('day')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  grouping === 'day' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => handleBucketChange('week')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  grouping === 'week' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Week
              </button>
            </div>
          </div>

          {/* Time Mode - moved to right side and made smaller */}
          <div className="flex items-center space-x-2">
            <div className="flex bg-gray-600 rounded p-0.5">
              <button
                onClick={() => setHoursMode('business')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  hoursMode === 'business' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Business
              </button>
              <button
                onClick={() => setHoursMode('wall')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  hoursMode === 'wall' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Wall
              </button>
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          {/* Empty space to match the legend height in the main widget */}
        </div>
        
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-gray-400 mb-4">
              <BarChart3 className="w-16 h-16 mx-auto mb-4" />
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">No Data Available</h4>
            <p className="text-gray-400 mb-4">
              No ticket lifecycle data found for the selected period
            </p>
            <div className="text-sm text-gray-500 space-y-1">
              <p>Selected period: {fromDate} to {toDate}</p>
              <p>View: {grouping === 'week' ? 'Weekly' : 'Daily'} aggregation</p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => {
                  const currentWeek = getCurrentWeekRange();
                  setFromDate(currentWeek.from);
                  setToDate(currentWeek.to);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Current Week
              </button>
            </div>
          </div>
        </div>
        
        {/* Info Icon */}
        <InfoIcon
          title="Ticket Lifecycle"
          description="Shows average time spent in each ticket status over time. Tracks how long tickets remain in different states, helping identify bottlenecks and process efficiency. Data is processed once daily for the previous day/week, so today's data may not be available yet."
          features={[
            'Stacked bars show time distribution across statuses',
            'Business Hours: Only counts Mon-Fri 9-17 Vienna time',
            'Wall Hours: Counts all 24/7 time including weekends',
            'Status filters: Toggle individual statuses on/off',
            'Day/Week view: Switch between daily and weekly aggregation',
            'Hover bars for detailed time breakdowns',
            'Color-coded statuses for easy identification',
            'Data updates once daily for previous day/week',
            'Today\'s data may not be available until next day',
            'Last ingestion date shown above the chart'
          ]}
          position="bottom-right"
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-lg p-6 border border-gray-700 min-h-[725px] relative flex flex-col"
    >
      {/* Header - Sticky to top */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-green-400" />
              <h3 className="text-xl font-semibold text-white">Ticket Lifecycle</h3>
            </div>
            <LastIngestionInfo />
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center space-x-2 px-2 py-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Refresh</span>
          </button>
        </div>
        <p className="text-gray-400 text-sm mb-3">
          Average time spent in each ticket status ({grouping === 'week' ? 'weekly' : 'daily'} view)
        </p>
        <div className="border-t border-gray-600"></div>
      </div>

      {/* Middle section - Vertically centered content */}
      <div className="flex-1 flex flex-col justify-center">
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
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            {/* Bucket selector */}
            <div className="flex bg-gray-600 rounded p-0.5">
              <button
                onClick={() => handleBucketChange('day')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  grouping === 'day' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => handleBucketChange('week')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  grouping === 'week' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Week
              </button>
            </div>
          </div>

          {/* Time Mode - moved to right side and made smaller */}
          <div className="flex items-center space-x-2">
            <div className="flex bg-gray-600 rounded p-0.5">
              <button
                onClick={() => setHoursMode('business')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  hoursMode === 'business' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Business
              </button>
              <button
                onClick={() => setHoursMode('wall')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  hoursMode === 'wall' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Wall
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        {availableStatuses.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {availableStatuses.map((status, index) => (
                <button
                  key={status}
                  onClick={() => handleStatusToggle(status)}
                  className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm transition-colors ${
                    !selectedStatuses.includes(status)
                      ? 'bg-gray-700 text-gray-500 opacity-50'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: statusColors[status] || '#6B7280' }}
                  />
                  <span>{status}</span>
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
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => formatDuration(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {selectedStatuses.map(status => (
                <Bar
                  key={status}
                  dataKey={status}
                  stackId="status"
                  fill={statusColors[status] || '#6B7280'}
                  hide={!selectedStatuses.includes(status)}
                  name={status}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Stats - Sticky to bottom */}
      <div className="mt-auto pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Total Samples</div>
            <div className="text-white font-semibold">
              {data.totalSamples.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Statuses</div>
            <div className="text-white font-semibold">{selectedStatuses.length}</div>
          </div>
          <div>
            <div className="text-gray-400">Period</div>
            <div className="text-white font-semibold">
              {chartData.length} {grouping === 'week' ? 'weeks' : 'days'}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Avg per {grouping === 'week' ? 'week' : 'day'}</div>
            <div className="text-white font-semibold">
              {chartData.length > 0 ? Math.round(data.totalSamples / chartData.length) : 0}
            </div>
          </div>
        </div>
      </div>
      
      {/* Info Icon */}
      <InfoIcon
        title="Ticket Lifecycle"
        description="Shows average time spent in each ticket status over time. Tracks how long tickets remain in different states, helping identify bottlenecks and process efficiency. Data is processed once daily for the previous day/week, so today's data may not be available yet."
        features={[
          'Stacked bars show time distribution across statuses',
          'Business Hours: Only counts Mon-Fri 9-17 Vienna time',
          'Wall Hours: Counts all 24/7 time including weekends',
          'Status filters: Toggle individual statuses on/off',
          'Day/Week view: Switch between daily and weekly aggregation',
          'Hover bars for detailed time breakdowns',
          'Color-coded statuses for easy identification',
          'Data updates once daily for previous day/week',
          'Today\'s data may not be available until next day',
          'Last ingestion date shown above the chart'
        ]}
        position="bottom-right"
      />
    </motion.div>
  );
};

export default TicketLifecycleWidget;
