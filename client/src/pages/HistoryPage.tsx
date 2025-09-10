import React from 'react';
import { motion } from 'framer-motion';
import { getEnabledWidgets } from '../components/history/historyWidgets';

const HistoryPage: React.FC = () => {
  const enabledWidgets = getEnabledWidgets();

  return (
    <div className="ml-64 min-h-screen flex justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full"
        style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}
      >

        <div className="pt-6 pb-0">
          {/* Widgets Grid */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
          {enabledWidgets.length === 0 ? (
            <div className="col-span-1 lg:col-span-2 bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Widgets Available</h3>
              <p className="text-gray-400">
                No history widgets are currently enabled. Check the widget registry to enable widgets.
              </p>
            </div>
          ) : (
            enabledWidgets.map((widget, index) => (
              <motion.div
                key={widget.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
              >
                <widget.Component />
              </motion.div>
            ))
          )}
          </motion.div>

          {/* Footer Info */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="pt-6 border-t border-gray-700"
          >
            <div className="text-center text-sm text-gray-500">
              <p>
                Data is cached and refreshed automatically. All times are displayed in Europe/Vienna timezone.
              </p>
              <p className="mt-1">
                Showing {enabledWidgets.length} widget{enabledWidgets.length !== 1 ? 's' : ''} with individual filtering
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default HistoryPage;