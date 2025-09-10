import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import KPISection from './components/KPISection';
import MainContent from './components/MainContent';
import HistoryPage from './pages/HistoryPage';

import { DataProvider } from './context/DataContext';

const Dashboard: React.FC = () => {
  return (
    <div className="ml-64 min-h-screen flex justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full"
        style={{ transform: 'scale(0.85)', transformOrigin: 'center' }}
      >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="mb-4 px-6 pt-6"
      >
        <KPISection />
      </motion.div>
      
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="px-6 pb-6"
        >
          <MainContent />
        </motion.div>
      </motion.div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <DataProvider>
      <Router>
        <div className="min-h-screen bg-gray-900 text-gray-100">
          <Sidebar />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </div>
      </Router>
    </DataProvider>
  );
};

export default App;
