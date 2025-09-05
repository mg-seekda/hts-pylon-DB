import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, RefreshCw, ExternalLink } from 'lucide-react';
import { useData } from '../context/DataContext';
import { openPylon, PYLON_VIEWS } from '../utils/pylonUtils';
import InfoIcon from './InfoIcon';

const HourlyHeatmap: React.FC = () => {
  const { state, refreshHourlyHeatmap } = useData();
  const { analytics, loading } = state;
  const data = analytics?.hourlyHeatmap?.data || [];

  // Debug logging
  console.log('HourlyHeatmap - analytics:', analytics);
  console.log('HourlyHeatmap - heatmap data:', data);
  console.log('HourlyHeatmap - data length:', data.length);
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number; count: number } | null>(null);

  // Days of the week (Monday to Sunday)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Hours 0-23
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Create a map for quick lookup (convert Sunday=0 to Monday=0)
  const dataMap = new Map<string, number>();
  data.forEach(item => {
    // Convert day: Sunday=0, Monday=1, ..., Saturday=6
    // To: Monday=0, Tuesday=1, ..., Sunday=6
    const newDay = item.day === 0 ? 6 : item.day - 1;
    const key = `${newDay}-${item.hour}`;
    dataMap.set(key, item.count);
  });

  // Calculate max count for color intensity
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const nonZeroData = data.filter(d => d.count > 0);
  const avgCount = nonZeroData.length > 0 ? nonZeroData.reduce((sum, d) => sum + d.count, 0) / nonZeroData.length : 0;
  
  // Calculate percentiles for better color distribution
  const sortedCounts = nonZeroData.map(d => d.count).sort((a, b) => a - b);
  const p25 = sortedCounts[Math.floor(sortedCounts.length * 0.25)] || 1;
  const p50 = sortedCounts[Math.floor(sortedCounts.length * 0.5)] || 2;
  const p75 = sortedCounts[Math.floor(sortedCounts.length * 0.75)] || 3;

  // Get color intensity based on count with better scaling for sparse data
  const getColorIntensity = (count: number): string => {
    if (count === 0) return 'bg-gray-800'; // Empty
    if (count === 1) return 'bg-green-900'; // Level 1 - single ticket (always visible)
    if (count <= p25) return 'bg-green-800'; // Level 2 - 25th percentile
    if (count <= p50) return 'bg-green-600'; // Level 3 - 50th percentile
    if (count <= p75) return 'bg-green-500'; // Level 4 - 75th percentile
    return 'bg-green-400'; // Level 5 - highest
  };

  // Get hover color (slightly brighter)
  const getHoverColor = (count: number): string => {
    if (count === 0) return 'bg-gray-700';
    if (count === 1) return 'bg-green-800';
    if (count <= p25) return 'bg-green-700';
    if (count <= p50) return 'bg-green-500';
    if (count <= p75) return 'bg-green-400';
    return 'bg-green-300';
  };

  // Format time for tooltip (24h format)
  const formatTime = (hour: number): string => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  // Format day for tooltip
  const formatDay = (day: number): string => {
    return days[day];
  };

  // Get the actual date for a given day of the week (Monday=0, Sunday=6)
  const getDateForDay = (dayIndex: number): string => {
    const today = new Date();
    const currentDay = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    // Convert to Monday=0, Tuesday=1, ..., Sunday=6
    const currentMondayIndex = currentDay === 0 ? 6 : currentDay - 1;
    
    // Calculate the date for the requested day
    const daysDiff = dayIndex - currentMondayIndex;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysDiff);
    
    // Format as yyyy-mm-dd
    const year = targetDate.getFullYear();
    const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
    const day = targetDate.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  if (loading.hourlyHeatmap) {
    return (
      <div className="card h-full flex flex-col">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Hourly Heatmap
              </h2>
              <p className="text-sm text-gray-300 mt-1">
                Ticket creation patterns by day and hour
              </p>
            </div>
            <button
              onClick={refreshHourlyHeatmap}
              disabled={loading.hourlyHeatmap}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading.hourlyHeatmap ? 'animate-spin' : ''}`} />
              Refresh Heatmap
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="flex items-center justify-center py-6" style={{ height: '320px' }}>
            <div className="text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-3" />
              <p className="text-gray-300">Loading heatmap data...</p>
            </div>
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
              <Calendar className="w-5 h-5 mr-2" />
              Hourly Heatmap
            </h2>
            <p className="text-sm text-gray-300 mt-1">
              Ticket creation patterns by day and hour
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openPylon(PYLON_VIEWS.ALL)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-800 hover:bg-blue-700 text-blue-200 rounded-lg border border-blue-600 transition-colors"
              title="Open all issues in Pylon"
              aria-label="Open all issues in Pylon"
            >
              <ExternalLink className="w-4 h-4" />
              More
            </button>
            <button
              onClick={refreshHourlyHeatmap}
              disabled={loading.hourlyHeatmap}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading.hourlyHeatmap ? 'animate-spin' : ''}`} />
              Refresh Analytics
            </button>
          </div>
        </div>
      </div>
      <div className="card-body flex-1 flex flex-col">
        <div className="relative flex-1 flex flex-col justify-center">
            {/* Tooltip */}
            {hoveredCell && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute z-10 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white shadow-lg pointer-events-none min-w-[140px]"
                style={{
                  left: Math.min(Math.max(hoveredCell.hour * 24 + 12, 70), 400), // Better positioning with bounds for 24px cells
                  top: Math.min(Math.max(hoveredCell.day * 24 + 12, 30), 100),
                  transform: 'translate(-50%, -100%)',
                } as React.CSSProperties}
              >
                <div className="font-medium text-green-400">
                  {formatDay(hoveredCell.day)} {getDateForDay(hoveredCell.day)} {formatTime(hoveredCell.hour)}
                </div>
                <div className="text-gray-300">
                  {hoveredCell.count} ticket{hoveredCell.count !== 1 ? 's' : ''} created
                </div>
                {hoveredCell.count > 0 && (
                  <div className="text-xs text-gray-300 mt-1">
                    {hoveredCell.count === 1 ? 'Single ticket' : 
                     hoveredCell.count <= p25 ? 'Low activity' :
                     hoveredCell.count <= p50 ? 'Medium activity' :
                     hoveredCell.count <= p75 ? 'High activity' : 'Peak activity'}
                  </div>
                )}
              </motion.div>
            )}

            {/* Heatmap Content Container */}
            <div className="flex flex-col justify-between h-full py-3">
              {/* Heatmap Grid */}
              <div className="space-y-1.5 overflow-x-auto">
                {/* Hour labels row */}
                <div className="flex items-center gap-4 min-w-fit">
                  <div className="w-6 text-xs text-gray-400 flex-shrink-0"></div> {/* Empty space for day labels */}
                  <div className="flex gap-0.5 min-w-fit">
                    {hours.map(hour => (
                      <div key={hour} className="w-6 h-6 text-xs text-gray-400 text-center flex items-center justify-center flex-shrink-0">
                        {hour % 2 === 0 ? hour : ''}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Day rows */}
                {days.map((day, dayIndex) => (
                  <div key={day} className="flex items-center gap-4 min-w-fit">
                    {/* Day label */}
                    <div className="w-6 text-xs text-gray-400 text-right pr-6 flex-shrink-0">
                      {day}
                    </div>
                    
                    {/* Hour cells for this day */}
                    <div className="flex gap-0.5 min-w-fit">
                      {hours.map(hour => {
                        const count = dataMap.get(`${dayIndex}-${hour}`) || 0;
                        const isHovered = hoveredCell?.day === dayIndex && hoveredCell?.hour === hour;
                        
                        return (
                          <motion.div
                            key={`${dayIndex}-${hour}`}
                            className={`
                              w-6 h-6 rounded-sm cursor-pointer transition-all duration-200 flex-shrink-0
                              ${isHovered ? getHoverColor(count) : getColorIntensity(count)}
                              hover:ring-1 hover:ring-green-400 hover:ring-opacity-50
                              focus:outline-none focus:ring-1 focus:ring-green-400 focus:ring-opacity-50
                            `}
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            onMouseEnter={() => setHoveredCell({ day: dayIndex, hour, count })}
                            onMouseLeave={() => setHoveredCell(null)}
                            onFocus={() => setHoveredCell({ day: dayIndex, hour, count })}
                            onBlur={() => setHoveredCell(null)}
                            tabIndex={0}
                            role="button"
                            aria-label={`${formatDay(dayIndex)} ${getDateForDay(dayIndex)} ${formatTime(hour)}: ${count} tickets created`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

            {/* Legend */}
            <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
              <span>Less</span>
              <div className="flex items-center gap-0.5">
                <div className="w-6 h-6 rounded-sm bg-gray-800" title="No activity"></div>
                <div className="w-6 h-6 rounded-sm bg-green-900" title="1 ticket"></div>
                <div className="w-6 h-6 rounded-sm bg-green-800" title={`2-${p25} tickets`}></div>
                <div className="w-6 h-6 rounded-sm bg-green-600" title={`${p25+1}-${p50} tickets`}></div>
                <div className="w-6 h-6 rounded-sm bg-green-500" title={`${p50+1}-${p75} tickets`}></div>
                <div className="w-6 h-6 rounded-sm bg-green-400" title={`${p75+1}+ tickets`}></div>
              </div>
              <span>More</span>
            </div>
            
            {/* Data Summary */}
            <div className="mt-2 text-xs text-gray-300 text-center">
              {nonZeroData.length > 0 && (
                <span>
                  {nonZeroData.length} active time slots • Max: {maxCount} tickets • Avg: {avgCount.toFixed(1)} tickets
                </span>
              )}
            </div>
            </div>
          </div>
      </div>
      
      {/* Info Icon */}
      <InfoIcon
        title="Hourly Heatmap"
        description="Visualizes ticket creation patterns across days of the week and hours of the day. Each cell represents a specific time slot, with color intensity indicating the number of tickets created."
        features={[
          'Green intensity shows ticket creation volume',
          'Lighter green = more tickets created',
          'Hover cells for detailed statistics',
          'Monday to Sunday rows, 24-hour columns',
          'Helps identify peak activity times',
          'Shows weekly patterns and trends'
        ]}
        position="bottom-right"
      />
    </div>
  );
};

export default HourlyHeatmap;
