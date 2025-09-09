import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Clock, RefreshCw, Calendar, BarChart3, ChevronDown } from 'lucide-react';
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
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
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
                formatter={(value, name) => [
                  formatDuration(value as number),
                  name // Status names are already properly formatted from the API
                ]}
              />
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

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Ticket Lifecycle</h3>
            <InfoIcon 
              title="Ticket Lifecycle"
              description="Shows average time spent in each ticket status. Toggle between Wall Hours (24/7) and Business Hours (Mon-Fri 9-17 Vienna time)."
            />
          </div>
          <div className="flex items-center gap-2">
            <CacheStatus />
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="btn btn-ghost btn-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="card-body">
        {/* Date Range and Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Date Range */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-400">From:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setIsCustomRange(true);
                setSelectedPreset('');
              }}
              className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-400">To:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setIsCustomRange(true);
                setSelectedPreset('');
              }}
              className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Grouping */}
          <div className="flex items-center space-x-2">
            <div className="flex bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => handleBucketChange('day')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  grouping === 'day'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => handleBucketChange('week')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  grouping === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Week
              </button>
            </div>
          </div>

          {/* Time Mode */}
          <div className="flex items-center space-x-2">
            <div className="flex bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setHoursMode('business')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  hoursMode === 'business'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Business Hours
              </button>
              <button
                onClick={() => setHoursMode('wall')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  hoursMode === 'wall'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Wall Hours
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {availableStatuses.map(status => (
            <button
              key={status}
              onClick={() => handleStatusToggle(status)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                selectedStatuses.includes(status)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Dynamic Content */}
        {renderContent()}
      </div>
    </div>
  );
};

export default TicketLifecycleWidget;
