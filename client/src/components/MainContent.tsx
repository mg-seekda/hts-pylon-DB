import React from 'react';
import { motion } from 'framer-motion';
import TicketAssignmentTable from './TicketAssignmentTable';
import DailyFlowChart from './DailyFlowChart';
import HourlyHeatmap from './HourlyHeatmap';

const MainContent: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Row 1: Analytics Charts (Side by Side) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* Left Column - Daily Flow Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex flex-col"
        >
          <DailyFlowChart />
        </motion.div>
        
        {/* Right Column - Hourly Heatmap */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-col"
        >
          <HourlyHeatmap />
        </motion.div>
      </div>
      
      {/* Row 2: Ticket Assignment Table (Full Width) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <TicketAssignmentTable />
      </motion.div>
    </div>
  );
};

export default MainContent;
