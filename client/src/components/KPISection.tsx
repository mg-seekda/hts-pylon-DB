import React from 'react';
import { motion } from 'framer-motion';
import { Ticket, Plus, Clock, AlertTriangle, RefreshCw, CheckCircle, Timer } from 'lucide-react';
import { useData } from '../context/DataContext';

const KPISection: React.FC = () => {
  const { state, refreshKPIs } = useData();
  const { kpis, loading } = state;

  const kpiCards = [
    {
      title: 'Created Today',
      value: kpis?.createdToday || 0,
      icon: Plus,
      color: 'text-purple-400',
      bgColor: 'bg-purple-900/20',
      borderColor: 'border-purple-700',
    },
    {
      title: 'Total Open',
      value: kpis?.totalOpen || 0,
      icon: Ticket,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/20',
      borderColor: 'border-blue-700',
    },
    {
      title: 'On Hold',
      value: kpis?.onHold || 0,
      icon: AlertTriangle,
      color: 'text-orange-400',
      bgColor: 'bg-orange-900/20',
      borderColor: 'border-orange-700',
    },
    {
      title: 'Open >24h',
      value: kpis?.openOver24h || 0,
      icon: Clock,
      color: 'text-red-400',
      bgColor: 'bg-red-900/20',
      borderColor: 'border-red-700',
    },
    {
      title: 'Closed Today',
      value: kpis?.closedToday || 0,
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-900/20',
      borderColor: 'border-green-700',
    },
    {
      title: 'Avg Resolution Time\n(last 30 days)',
      value: kpis?.avgResolutionTime || 0,
      icon: Timer,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-900/20',
      borderColor: 'border-cyan-700',
      format: (value: number) => `${value}h`
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Key Performance Indicators</h2>
        <button
          onClick={refreshKPIs}
          disabled={loading.kpis}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${loading.kpis ? 'animate-spin' : ''}`} />
          Refresh KPIs
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        {kpiCards.map((kpi, index) => {
        const Icon = kpi.icon;
        
        return (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className={`border ${kpi.borderColor} ${kpi.bgColor} p-4 relative shadow-lg rounded-lg`}
          >
            <div className="absolute top-3 left-3">
              <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
            </div>
            
            <div className="kpi-value mb-2 text-center">
              {loading.kpis ? (
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-700 rounded w-12 mx-auto"></div>
                </div>
              ) : (
                <motion.span
                  key={kpi.value}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl font-bold text-white"
                >
                  {kpi.format ? kpi.format(kpi.value) : kpi.value.toLocaleString()}
                </motion.span>
              )}
            </div>
            
            <div className="kpi-label text-xs text-gray-300 font-medium whitespace-pre-line text-center">
              {kpi.title === 'Avg Resolution Time\n(last 30 days)' ? (
                <>
                  <span className="font-medium">AVG RESOLUTION TIME</span>
                  <br />
                  <span className="font-light">(last 30 days)</span>
                </>
              ) : (
                kpi.title
              )}
            </div>
          </motion.div>
        );
      })}
      </div>
    </div>
  );
};

export default KPISection;
