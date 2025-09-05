import React from 'react';
import { motion } from 'framer-motion';
import { Ticket, Plus, Clock, AlertTriangle, RefreshCw, CheckCircle, Timer } from 'lucide-react';
import { useData } from '../context/DataContext';
import { openPylon, PYLON_VIEWS } from '../utils/pylonUtils';
import InfoIcon from './InfoIcon';
import Tooltip from './Tooltip';

const KPISection: React.FC = () => {
  const { state, refreshKPIs } = useData();
  const { kpis, loading } = state;

  const handleCardClick = (viewKey: keyof typeof PYLON_VIEWS) => {
    openPylon(PYLON_VIEWS[viewKey]);
  };

  const kpiCards = [
    // Row 1: Daily focus
    {
      title: 'Created Today',
      value: kpis?.createdToday || 0,
      icon: Plus,
      color: 'text-purple-400',
      bgColor: 'bg-purple-900/20',
      borderColor: 'border-purple-700',
      pylonView: 'ALL' as keyof typeof PYLON_VIEWS,
      info: {
        title: 'Created Today',
        description: 'Shows the total number of tickets created today. This helps track daily workload and incoming ticket volume.',
        features: [
          'Real-time count of new tickets',
          'Click to open all tickets in Pylon',
          'Updated automatically throughout the day'
        ]
      }
    },
    {
      title: 'Closed Today',
      value: kpis?.closedToday || 0,
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-900/20',
      borderColor: 'border-green-700',
      pylonView: 'CLOSED_BY_ASSIGNEE' as keyof typeof PYLON_VIEWS,
      info: {
        title: 'Closed Today',
        description: 'Displays the number of tickets closed today by the whole team. Tracks daily productivity and completion rate.',
        features: [
          'Shows tickets closed today',
          'Click to view closed tickets in Pylon',
          'Helps measure daily productivity'
        ]
      }
    },
    {
      title: 'New Tickets',
      value: kpis?.newTickets || 0,
      icon: Plus,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-900/20',
      borderColor: 'border-yellow-700',
      pylonView: 'ALL' as keyof typeof PYLON_VIEWS,
      info: {
        title: 'New Tickets',
        description: 'Indicates the number of new tickets that need attention. These are tickets in the initial state currentlywaiting for first response.',
        features: [
          'Tickets in "New" status',
          'Click to view all new tickets in Pylon',
          'Tickets requiring first response'
        ]
      }
    },
    {
      title: 'Open Tickets with Jira Link',
      value: kpis?.externalIssues || 0,
      icon: AlertTriangle,
      color: 'text-pink-400',
      bgColor: 'bg-pink-900/20',
      borderColor: 'border-pink-700',
      pylonView: 'ALL' as keyof typeof PYLON_VIEWS,
      info: {
        title: 'Open Tickets with Jira Link',
        description: 'Shows tickets that are open and have external Jira links, and are waiting for DEV or 2nd-LvL Support',
        features: [
          'Tickets with external Jira references',
          'Click to view all external tickets in Pylon',
          'Helps identify cross-system dependencies'
        ]
      }
    },
    // Row 2: Status & performance
    {
      title: 'Total Open',
      value: kpis?.totalOpen || 0,
      icon: Ticket,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/20',
      borderColor: 'border-blue-700',
      pylonView: 'ALL' as keyof typeof PYLON_VIEWS,
      info: {
        title: 'Total Open',
        description: 'The total number of open tickets across all statuses. Provides an overview of current workload and backlog size.',
        features: [
          'All tickets in statuses other than Closed or Cancelled',
          'Click to view all open tickets in Pylon',
          'Overall workload indicator'
        ]
      }
    },
    {
      title: 'On Hold',
      value: kpis?.onHold || 0,
      icon: AlertTriangle,
      color: 'text-orange-400',
      bgColor: 'bg-orange-900/20',
      borderColor: 'border-orange-700',
      pylonView: 'ALL' as keyof typeof PYLON_VIEWS,
      info: {
        title: 'On Hold',
        description: 'Tickets that are currently on hold, waiting for external dependencies, or other blockers.',
        features: [
          'Tickets in "on hold" status',
          'Click to view on-hold tickets in Pylon',
          'Identifies blocked work items'
        ]
      }
    },
    {
      title: 'Open >24h\n( New | On You )',
      value: kpis?.openOver24h || 0,
      icon: Clock,
      color: 'text-red-400',
      bgColor: 'bg-red-900/20',
      borderColor: 'border-red-700',
      pylonView: 'ALL' as keyof typeof PYLON_VIEWS,
      info: {
        title: 'Open >24h (New | On You)',
        description: 'Tickets that have been open for more than 24 hours in "New" or "Waiting on You" status. These may need priority attention.',
        features: [
          'Tickets open for more than 24 hours',
          'Includes "New" and "Waiting on You" statuses',
          'Click to view aging tickets in Pylon',
          'Helps identify overdue items'
        ]
      }
    },
    {
      title: 'Avg Resolution Time\n( last 30 days )',
      value: kpis?.avgResolutionTime || 0,
      icon: Timer,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-900/20',
      borderColor: 'border-cyan-700',
      format: (value: number) => `${value}h`,
      pylonView: null, // No link for this card
      info: {
        title: 'Average Resolution Time (last 30 days)',
        description: 'The average time taken to resolve tickets over the last 30 days. Measured in hours and helps track efficiency trends.',
        features: [
          'Calculated from last 30 days of data',
          'Shows average resolution time in hours',
          'Helps measure performance trends',
          'No Pylon link (calculated metric)'
        ]
      }
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {kpiCards.map((kpi, index) => {
        const Icon = kpi.icon;
        
        return (
          <Tooltip 
            key={kpi.title}
            content={kpi.pylonView ? 'Open in Pylon' : ''} 
            position="top"
            className={kpi.pylonView ? '' : 'pointer-events-none'}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className={`border ${kpi.borderColor} ${kpi.bgColor} p-4 relative shadow-lg rounded-lg h-28 flex flex-col justify-between ${
                kpi.pylonView ? 'cursor-pointer hover:shadow-xl transition-all duration-200' : ''
              }`}
              onClick={kpi.pylonView ? () => handleCardClick(kpi.pylonView!) : undefined}
              onKeyDown={kpi.pylonView ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardClick(kpi.pylonView!);
                }
              } : undefined}
              role={kpi.pylonView ? 'button' : undefined}
              tabIndex={kpi.pylonView ? 0 : undefined}
              aria-label={kpi.pylonView ? `Open ${kpi.title} in Pylon` : undefined}
            >
            <div className="absolute top-3 left-3">
              <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
            </div>
            
            {/* Info Icon */}
            <InfoIcon
              title={kpi.info.title}
              description={kpi.info.description}
              features={kpi.info.features}
              position="top-right"
            />
            
            <div className="flex-1 flex flex-col justify-center">
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
              
              <div className="kpi-label text-xs text-gray-300 whitespace-pre-line text-center">
                {kpi.title === 'Avg Resolution Time\n( last 30 days )' ? (
                  <>
                    <span className="font-medium text-gray-100" style={{ fontSize: '15px' }}>AVG RESOLUTION TIME</span>
                    <br />
                    <span className="font-light text-xs">( last 30 days )</span>
                  </>
                ) : kpi.title === 'Open >24h\n( New | On You )' ? (
                  <>
                    <span className="font-medium text-gray-100" style={{ fontSize: '15px' }}>OPEN &gt;24H</span>
                    <br />
                    <span className="font-light text-xs">( New | On You )</span>
                  </>
                ) : (
                  <span className="font-medium text-gray-100" style={{ fontSize: '15px' }}>{kpi.title}</span>
                )}
              </div>
            </div>
            </motion.div>
          </Tooltip>
        );
      })}
      </div>
    </div>
  );
};

export default KPISection;
