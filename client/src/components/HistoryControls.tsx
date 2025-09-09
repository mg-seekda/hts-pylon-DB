import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronDown } from 'lucide-react';
import TimezoneUtils from '../utils/timezone';

export interface DateRange {
  from: string;
  to: string;
}

export interface HistoryControlsProps {
  onRangeChange: (range: DateRange, bucket: 'day' | 'week') => void;
  initialRange?: DateRange;
  initialBucket?: 'day' | 'week';
}

const HistoryControls: React.FC<HistoryControlsProps> = ({
  onRangeChange,
  initialRange,
  initialBucket = 'day'
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [bucket, setBucket] = useState<'day' | 'week'>(initialBucket);
  const [isCustomRange, setIsCustomRange] = useState<boolean>(false);
  const [isPresetOpen, setIsPresetOpen] = useState<boolean>(false);

  const presets = TimezoneUtils.getDatePresets();

  // Initialize with default values
  useEffect(() => {
    if (initialRange) {
      setCustomFrom(initialRange.from);
      setCustomTo(initialRange.to);
      setIsCustomRange(true);
    } else {
      // Default to this week
      const thisWeek = presets.thisWeek;
      setCustomFrom(thisWeek.from);
      setCustomTo(thisWeek.to);
      onRangeChange(thisWeek, bucket);
    }
  }, [initialRange, bucket, onRangeChange, presets.thisWeek]);

  const handlePresetSelect = (presetKey: string) => {
    const preset = presets[presetKey as keyof typeof presets];
    if (preset) {
      setSelectedPreset(presetKey);
      setCustomFrom(preset.from);
      setCustomTo(preset.to);
      setIsCustomRange(false);
      setIsPresetOpen(false);
      onRangeChange(preset, bucket);
    }
  };

  const handleCustomRangeChange = useCallback(() => {
    if (customFrom && customTo) {
      try {
        const validatedRange = TimezoneUtils.validateDateRange(customFrom, customTo);
        onRangeChange(validatedRange, bucket);
      } catch (error) {
        // You might want to show an error message to the user
      }
    }
  }, [customFrom, customTo, bucket, onRangeChange]);

  const handleBucketChange = (newBucket: 'day' | 'week') => {
    setBucket(newBucket);
    if (customFrom && customTo) {
      onRangeChange({ from: customFrom, to: customTo }, newBucket);
    }
  };

  // Handle custom range changes
  useEffect(() => {
    if (isCustomRange && customFrom && customTo) {
      handleCustomRangeChange();
    }
  }, [customFrom, customTo, bucket, isCustomRange, handleCustomRangeChange]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700"
    >
      <div className="flex flex-wrap items-center gap-4">
        {/* Preset Selector */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsPresetOpen(!isPresetOpen)}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <Calendar className="w-4 h-4" />
            <span>{selectedPreset ? presets[selectedPreset as keyof typeof presets]?.label : 'Select Preset'}</span>
            <ChevronDown className="w-4 h-4" />
          </motion.button>

          {isPresetOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-2 w-48 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-50"
            >
              <div className="py-2">
                {Object.entries(presets).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => handlePresetSelect(key)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-600 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setIsCustomRange(true);
                    setIsPresetOpen(false);
                    setSelectedPreset('');
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-600 transition-colors border-t border-gray-600"
                >
                  Custom Range
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Custom Date Range */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">From:</label>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              setIsCustomRange(true);
              setSelectedPreset('');
            }}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">To:</label>
          <input
            type="date"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value);
              setIsCustomRange(true);
              setSelectedPreset('');
            }}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Bucket Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">Group by:</label>
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => handleBucketChange('day')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                bucket === 'day'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => handleBucketChange('week')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                bucket === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Week
            </button>
          </div>
        </div>

        {/* Timezone Indicator */}
        <div className="text-xs text-gray-500 ml-auto">
          Europe/Vienna
        </div>
      </div>
    </motion.div>
  );
};

export default HistoryControls;
