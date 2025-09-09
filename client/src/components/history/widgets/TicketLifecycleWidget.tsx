import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Clock, RefreshCw, Calendar, BarChart3, ChevronDown, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import InfoIcon from '../../InfoIcon';
import CacheStatus from '../../CacheStatus';
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
}

const TicketLifecycleWidget: React.FC = () => {
  const [data, setData] = useState<TicketLifecycleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoursMode, setHoursMode] = useState<'wall' | 'business'>('business');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  
  // Date range and grouping state
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [grouping, setGrouping] = useState<'day' | 'week'>('day');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [isCustomRange, setIsCustomRange] = useState<boolean>(false);
  const [isPresetOpen, setIsPresetOpen] = useState<boolean>(false);

  const presets = TimezoneUtils.getDatePresets();

  // Initialize with default values - fetch actual data range
  useEffect(() => {
    const initializeWithKnownData = async () => {
      try {
        const response = await fetch('/api/ticket-lifecycle/date-range');
        if (response.ok) {
          const data = await response.json();
          if (data.hasData) {
            setFromDate(data.fromFormatted);
            setToDate(data.toFormatted);
            setSelectedPreset('knownData');
          } else {
            // Fallback to current week if no data available
            const today = dayjs();
            const weekStart = today.startOf('week').add(1, 'day'); // Monday
            const weekEnd = today.endOf('week').subtract(1, 'day'); // Sunday
            setFromDate(weekStart.format('YYYY-MM-DD'));
            setToDate(weekEnd.format('YYYY-MM-DD'));
            setSelectedPreset('');
          }
        } else {
          // Fallback to current week if API fails
          const today = dayjs();
          const weekStart = today.startOf('week').add(1, 'day'); // Monday
          const weekEnd = today.endOf('week').subtract(1, 'day'); // Sunday
          setFromDate(weekStart.format('YYYY-MM-DD'));
          setToDate(weekEnd.format('YYYY-MM-DD'));
          setSelectedPreset('');
        }
      } catch (error) {
        console.error('Error fetching known data range:', error);
        // Fallback to current week if error
        const today = dayjs();
        const weekStart = today.startOf('week').add(1, 'day'); // Monday
        const weekEnd = today.endOf('week').subtract(1, 'day'); // Sunday
        setFromDate(weekStart.format('YYYY-MM-DD'));
        setToDate(weekEnd.format('YYYY-MM-DD'));
        setSelectedPreset('');
      }
    };

    initializeWithKnownData();
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
    if (!fromDate || !toDate) {
      console.log('Skipping fetch - dates not set yet', { fromDate, toDate });
      return;
    }

    console.log('Fetching ticket lifecycle data...', { fromDate, toDate, grouping, hoursMode, selectedStatuses });
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        grouping,
        hoursMode
      });

      if (selectedStatuses.length > 0) {
        console.log('Selected statuses before join:', selectedStatuses);
        const statusString = selectedStatuses.join(',');
        console.log('Status string after join:', statusString);
        params.append('status', statusString);
      }

      const url = `/api/ticket-lifecycle/data?${params}`;
      console.log('API URL:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: TicketLifecycleResponse = await response.json();
      console.log('Ticket lifecycle data received:', result);
      console.log('Result.data:', result.data);
      console.log('Result.data length:', result.data ? result.data.length : 'null');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Error fetching ticket lifecycle data:', err);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, grouping, hoursMode]);

  const fetchStatuses = async () => {
    try {
      const response = await fetch('/api/ticket-lifecycle/statuses');
      if (response.ok) {
        const result = await response.json();
        console.log('Statuses received from API:', result.statuses);
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
  }, [selectedStatuses, fetchData, fromDate, toDate]);

  const formatDate = (dateString: string) => {
    if (grouping === 'week') {
      return dateString; // Already formatted as "2024-W01"
    }
    return dayjs(dateString).format('MMM DD');
  };

  const formatDuration = (seconds: number) => {
    console.log('formatDuration called with:', seconds, 'type:', typeof seconds);
    
    // If less than a minute, show seconds
    if (seconds < 60) {
      const result = `${seconds}s`;
      console.log('formatDuration result (seconds):', result);
      return result;
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const result = `${hours}h ${minutes}m`;
    console.log('formatDuration result (hours/minutes):', result);
    return result;
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

    const result = Object.values(groupedData);
    console.log('Chart data transformation:', result);
    console.log('Original data:', data.data);
    console.log('First item structure:', data.data[0]);
    console.log('Grouped data keys:', Object.keys(groupedData));
    return result;
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

  const handlePresetSelect = (presetKey: string) => {
    const preset = presets[presetKey as keyof typeof presets];
    if (preset) {
      setSelectedPreset(presetKey);
      setFromDate(preset.from);
      setToDate(preset.to);
      setIsCustomRange(false);
      setIsPresetOpen(false);
    }
  };

  const handleBucketChange = (newBucket: 'day' | 'week') => {
    setGrouping(newBucket);
  };

  // Helper functions for time period options
  const getCurrentWeekRange = () => {
    const today = dayjs();
    const weekStart = today.startOf('week').add(1, 'day'); // Monday
    const weekEnd = today.endOf('week').subtract(1, 'day'); // Sunday
    
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

  // Render content based on state
  const renderContent = () => {
    if (loading && !data) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading lifecycle data...
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-400 mb-2">Error loading data</div>
            <div className="text-gray-400 text-sm mb-4">{error}</div>
            <button
              onClick={handleRefresh}
              className="btn btn-primary btn-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </button>
          </div>
        </div>
      );
    }

    console.log('Rendering chart, data state:', { data, hasData: !!data, dataLength: data?.data?.length });
    
    if (!data || data.data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-gray-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <div className="text-lg mb-2">No data yet</div>
            <div className="text-sm">Lifecycle tracking started on deployment date</div>
            <div className="text-xs mt-2">Debug: data={JSON.stringify(data)}</div>
          </div>
        </div>
      );
    }

    console.log('Rendering chart with data:', chartData);
    console.log('Selected statuses for chart:', selectedStatuses);
    
    return (
      <>
        {/* Chart */}
        <div style={{ height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                tickFormatter={formatDate}
              />
              <YAxis 
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
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
                  name={status}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        <div className="mt-4 pt-4 border-t border-gray-700">
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
      </>
    );
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
        className="bg-gray-800 rounded-lg p-6 border border-gray-700 min-h-[750px] relative flex flex-col"
      >
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold text-white">Ticket Lifecycle</h3>
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
                  const today = dayjs();
                  const weekStart = today.startOf('week').add(1, 'day');
                  const weekEnd = today.endOf('week').subtract(1, 'day');
                  setFromDate(weekStart.format('YYYY-MM-DD'));
                  setToDate(weekEnd.format('YYYY-MM-DD'));
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
          description="Shows average time spent in each ticket status over time. Tracks how long tickets remain in different states, helping identify bottlenecks and process efficiency."
          features={[
            'Stacked bars show time distribution across statuses',
            'Business Hours: Only counts Mon-Fri 9-17 Vienna time',
            'Wall Hours: Counts all 24/7 time including weekends',
            'Status filters: Toggle individual statuses on/off',
            'Day/Week view: Switch between daily and weekly aggregation',
            'Hover bars for detailed time breakdowns',
            'Color-coded statuses for easy identification'
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
      className="bg-gray-800 rounded-lg p-6 border border-gray-700 min-h-[750px] relative flex flex-col"
    >
      {/* Header - Sticky to top */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-green-400" />
            <h3 className="text-xl font-semibold text-white">Ticket Lifecycle</h3>
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
        description="Shows average time spent in each ticket status over time. Tracks how long tickets remain in different states, helping identify bottlenecks and process efficiency."
        features={[
          'Stacked bars show time distribution across statuses',
          'Business Hours: Only counts Mon-Fri 9-17 Vienna time',
          'Wall Hours: Counts all 24/7 time including weekends',
          'Status filters: Toggle individual statuses on/off',
          'Day/Week view: Switch between daily and weekly aggregation',
          'Hover bars for detailed time breakdowns',
          'Color-coded statuses for easy identification'
        ]}
        position="bottom-right"
      />
    </motion.div>
  );
};

export default TicketLifecycleWidget;
