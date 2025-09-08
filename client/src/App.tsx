import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from './components/Header';
import Breadcrumb from './components/Breadcrumb';
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
      className="container mx-auto px-4 py-4"
    >
      <Header />
      
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <Breadcrumb />
      </motion.div>
      
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
  );
};

const App: React.FC = () => {
  return (
    <DataProvider>
      <Router>
        <div className="min-h-screen bg-gray-900 text-gray-100">
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
