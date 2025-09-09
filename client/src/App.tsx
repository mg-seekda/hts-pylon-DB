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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="ml-64 p-6"
      style={{ transform: 'scale(0.8)', transformOrigin: 'top left' }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="mb-8"
      >
        <KPISection />
      </motion.div>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <MainContent />
      </motion.div>
    </motion.div>
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
