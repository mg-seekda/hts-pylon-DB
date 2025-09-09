import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Clock, ExternalLink, ChevronDown, BarChart3 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { openPylon, PYLON_VIEWS } from '../utils/pylonUtils';
import dayjs from 'dayjs';

const Header: React.FC = () => {
  const { state, refreshAll } = useData();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleRefresh = async () => {
    await refreshAll();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const pylonMenuItems = [
    { key: 'ALL', label: 'All Issues', url: PYLON_VIEWS.ALL },
    { key: 'MY', label: 'My Issues', url: PYLON_VIEWS.MY },
    { key: 'UNASSIGNED', label: 'Unassigned Issues', url: PYLON_VIEWS.UNASSIGNED },
    { key: 'CLOSED_BY_ASSIGNEE', label: 'Closed by Assignee', url: PYLON_VIEWS.CLOSED_BY_ASSIGNEE, warning: '⚠️ date filter manual' },
  ];

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="mb-8"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img 
            src="/Seekda_Aspire_Logo_23_1_no_outline-2.svg" 
            alt="Seekda Aspire Logo" 
            className="h-12 w-auto"
          />
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              {location.pathname === '/history' ? 'History Dashboard' : 'HTS Dashboard'}
            </h1>
            <p className="text-gray-400">
              {location.pathname === '/history' 
                ? 'Historical analysis and trends for ticket data'
                : 'Hotel Technology Support - Pylon Integration'
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {state.lastUpdated && (
            <div className="flex items-center text-sm text-gray-400">
              <Clock className="w-4 h-4 mr-2" />
              Last updated: {dayjs(state.lastUpdated).format('HH:mm:ss')}
            </div>
          )}
          
          {/* History Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/history')}
            className={`btn flex items-center space-x-2 ${
              location.pathname === '/history' 
                ? 'btn-primary' 
                : 'btn-secondary'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>History</span>
          </motion.button>
          
          {/* Pylon Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in Pylon</span>
              <ChevronDown className="w-4 h-4" />
            </motion.button>
            
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50"
              >
                <div className="py-2">
                  {pylonMenuItems.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        openPylon(item.url);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span>{item.label}</span>
                        {item.warning && (
                          <span className="text-xs text-yellow-400">{item.warning}</span>
                        )}
                      </div>
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={Object.values(state.loading).some(loading => loading)}
            className="btn btn-primary flex items-center space-x-2"
          >
            <RefreshCw 
              className={`w-4 h-4 ${Object.values(state.loading).some(loading => loading) ? 'animate-spin' : ''}`} 
            />
            <span>Refresh</span>
          </motion.button>
        </div>
      </div>
      
      {state.error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-danger-900 border border-danger-700 rounded-lg text-danger-200"
        >
          <p className="font-medium">Error:</p>
          <p>{state.error}</p>
        </motion.div>
      )}
    </motion.header>
  );
};

export default Header;
