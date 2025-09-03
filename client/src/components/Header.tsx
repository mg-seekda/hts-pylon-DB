import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Clock } from 'lucide-react';
import { useData } from '../context/DataContext';
import dayjs from 'dayjs';

const Header: React.FC = () => {
  const { state, refreshAll } = useData();

  const handleRefresh = async () => {
    await refreshAll();
  };

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
              HTS Dashboard
            </h1>
            <p className="text-gray-400">
              Hotel Technology Support - Pylon Integration
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
