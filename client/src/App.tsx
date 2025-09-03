import React from 'react';
import { motion } from 'framer-motion';
import Header from './components/Header';
import KPISection from './components/KPISection';
import MainContent from './components/MainContent';

import { DataProvider } from './context/DataContext';

const App: React.FC = () => {
  return (
    <DataProvider>
      <div className="min-h-screen bg-gray-900 text-gray-100">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="container mx-auto px-4 py-4"
        >
          <Header />
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <KPISection />
          </motion.div>
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-6"
          >
            <MainContent />
          </motion.div>
        </motion.div>
      </div>
    </DataProvider>
  );
};

export default App;
