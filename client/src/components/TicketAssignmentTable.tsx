import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Users, User, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useData } from '../context/DataContext';
import { openPylon, resolveAssignmentLink } from '../utils/pylonUtils';
import InfoIcon from './InfoIcon';
import Tooltip from './Tooltip';
import CacheStatus from './CacheStatus';


const TicketAssignmentTable: React.FC = () => {
  const { state, refreshAssignmentTable } = useData();
  const { assignmentTable, loading, cacheStatus } = state;
  

  
  // Sorting state - default to closed today descending
  const [sortColumn, setSortColumn] = useState<string>('closedToday');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Get current user email (you might want to get this from context or props)
  const currentUserEmail = 'current-user@example.com'; // TODO: Get from auth context

  const handleCellClick = (row: any, columnKey: 'new' | 'waiting' | 'hold' | 'closedToday' | 'totalOpen') => {
    const url = resolveAssignmentLink(row, columnKey, currentUserEmail);
    openPylon(url);
  };

  const handleKeyDown = (event: React.KeyboardEvent, row: any, columnKey: 'new' | 'waiting' | 'hold' | 'closedToday' | 'totalOpen') => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCellClick(row, columnKey);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const statusClasses: Record<string, string> = {
      'new': 'status-new',
      'waiting_on_you': 'status-waiting-on-you',
      'waiting_on_customer': 'status-waiting-on-customer',
      'on_hold': 'status-on-hold',
      'closed': 'status-closed',
    };
    return statusClasses[status] || 'status-new';
  };

  const formatStatusName = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getUserStatusColor = (status: string) => {
    return status === 'active' ? 'bg-green-500' : 'bg-gray-500';
  };

  const getUserStatusText = (status: string) => {
    return status === 'active' ? 'Online' : 'Out of Office';
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ChevronUp className="w-4 h-4 opacity-30" />;
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  if (loading.assignmentTable) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Ticket Assignment
          </h2>
        </div>
        <div className="card-body">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!assignmentTable) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Ticket Assignment
          </h2>
        </div>
        <div className="card-body">
          <p className="text-gray-300">No assignment data available</p>
        </div>
      </div>
    );
  }

  const allUsers = [assignmentTable.unassigned, ...assignmentTable.users];

  // Sort users based on current sort settings
  const sortedUsers = [...allUsers].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let aValue: number | string;
    let bValue: number | string;
    
    if (sortColumn === 'name') {
      aValue = a.name.toLowerCase();
      bValue = b.name.toLowerCase();
    } else if (sortColumn === 'closedToday') {
      aValue = a.closedToday || 0;
      bValue = b.closedToday || 0;
    } else if (sortColumn === 'total') {
      aValue = a.totalOpen || 0;
      bValue = b.totalOpen || 0;
    } else {
      // Status column
      aValue = a.statusCounts[sortColumn] || 0;
      bValue = b.statusCounts[sortColumn] || 0;
    }
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? 
        aValue.localeCompare(bValue) : 
        bValue.localeCompare(aValue);
    } else {
      return sortDirection === 'asc' ? 
        (aValue as number) - (bValue as number) : 
        (bValue as number) - (aValue as number);
    }
  });

  // Calculate totals for each column
  const totals = {
    statusCounts: {} as Record<string, number>,
    closedToday: 0,
    totalOpen: 0
  };

  // Initialize status counts
  assignmentTable.statuses.forEach(status => {
    totals.statusCounts[status] = 0;
  });

  // Sum up all values
  sortedUsers.forEach(user => {
    assignmentTable.statuses.forEach(status => {
      totals.statusCounts[status] += user.statusCounts[status] || 0;
    });
    totals.closedToday += user.closedToday || 0;
    totals.totalOpen += user.totalOpen || 0;
  });

  return (
    <div className="card relative flex-1 flex flex-col">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Ticket Assignment
            </h2>
            <p className="text-sm text-gray-300 mt-1">
              Total: {assignmentTable.totalTickets} tickets
            </p>
            <CacheStatus 
              metadata={cacheStatus.assignmentTable} 
              className="mt-1" 
            />
          </div>
          <button
            onClick={refreshAssignmentTable}
            disabled={loading.assignmentTable}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading.assignmentTable ? 'animate-spin' : ''}`} />
            Refresh Table
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto flex-1">
        <table className="table">
          <thead>
            <tr>
              <th 
                className="text-left cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Agent
                  {getSortIcon('name')}
                </div>
              </th>
              {assignmentTable.statuses.map((status) => (
                <th 
                  key={status} 
                  className="text-center cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => handleSort(status)}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className={`status-badge ${getStatusBadgeClass(status)}`}>
                      {formatStatusName(status)}
                    </span>
                    {getSortIcon(status)}
                  </div>
                </th>
              ))}
              <th 
                className="text-center cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort('closedToday')}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="status-badge status-closed">
                    Closed Today
                  </span>
                  {getSortIcon('closedToday')}
                </div>
              </th>
              <th 
                className="text-center cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort('total')}
              >
                <div className="flex items-center justify-center gap-2">
                  Total open
                  {getSortIcon('total')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user, index) => (
              <motion.tr
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-gray-750 transition-colors"
              >
                <td className="font-medium">
                  <div className="flex items-center">
                    {user.id === 'unassigned' ? (
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center mr-3">
                        <User className="w-4 h-4 text-gray-300" />
                      </div>
                    ) : user.avatarUrl ? (
                      <div className="relative group">
                        <img 
                          src={user.avatarUrl} 
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover mr-3 border border-gray-600"
                          onError={(e) => {
                            // Hide the image and show fallback
                            const img = e.currentTarget;
                            const fallback = img.nextElementSibling as HTMLElement;
                            if (fallback) {
                              img.style.display = 'none';
                              fallback.style.display = 'flex';
                            }
                          }}
                        />
                        {/* Fallback icon (hidden by default) */}
                        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center mr-3 hidden absolute top-0 left-0">
                          <Users className="w-4 h-4 text-white" />
                        </div>
                        {/* Status indicator dot */}
                        {user.status && (
                          <div className={`absolute -bottom-0 right-2 w-3 h-3 rounded-full border-2 border-gray-800 ${getUserStatusColor(user.status)}`}></div>
                        )}
                        {/* Tooltip */}
                        {user.status && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            {getUserStatusText(user.status)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative group">
                        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center mr-3">
                          <Users className="w-4 h-4 text-white" />
                        </div>
                        {/* Status indicator dot */}
                        {user.status && (
                          <div className={`absolute -bottom-1 right-1 w-3 h-3 rounded-full border-2 border-gray-800 ${getUserStatusColor(user.status)}`}></div>
                        )}
                        {/* Tooltip */}
                        {user.status && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            {getUserStatusText(user.status)}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="group">
                      <div className="text-white">{user.name}</div>
                      {user.email && (
                        <div className="text-xs text-gray-300">{user.email}</div>
                      )}
                      {/* Tooltip for name/email area */}
                      {user.status && (
                        <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          Status: {getUserStatusText(user.status)}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                
                {assignmentTable.statuses.map((status) => (
                  <td key={status} className="text-center">
                    <Tooltip content="Open in Pylon" position="top">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCellClick(user, status as 'new' | 'waiting' | 'hold')}
                        onKeyDown={(e) => handleKeyDown(e, user, status as 'new' | 'waiting' | 'hold')}
                        className="text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
                        disabled={user.statusCounts[status] === 0}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${status} tickets in Pylon`}
                      >
                        {user.statusCounts[status] || 0}
                      </motion.button>
                    </Tooltip>
                  </td>
                ))}
                
                <td className="text-center">
                  <Tooltip content="Open in Pylon" position="top">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCellClick(user, 'closedToday')}
                      onKeyDown={(e) => handleKeyDown(e, user, 'closedToday')}
                      className="text-success-400 hover:text-success-300 font-medium transition-colors cursor-pointer"
                      disabled={user.closedToday === 0}
                      role="button"
                      tabIndex={0}
                      aria-label="Open closed today tickets in Pylon"
                    >
                      {user.closedToday || 0}
                    </motion.button>
                  </Tooltip>
                </td>
                
                <td className="text-center">
                  <Tooltip content="Open in Pylon" position="top">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCellClick(user, 'totalOpen')}
                      onKeyDown={(e) => handleKeyDown(e, user, 'totalOpen')}
                      className="text-white hover:text-gray-300 font-semibold transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label="Open total open tickets in Pylon"
                    >
                      {user.totalOpen}
                    </motion.button>
                  </Tooltip>
                </td>
              </motion.tr>
            ))}
            
            {/* Totals Row */}
            <motion.tr
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sortedUsers.length * 0.05 + 0.1 }}
              className="border-t-2 border-gray-600 bg-gray-800/50 font-semibold"
            >
              <td className="font-bold text-white">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center mr-3">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <span>TOTALS</span>
                </div>
              </td>
              
              {assignmentTable.statuses.map((status) => (
                <td key={status} className="text-center">
                  <Tooltip content="Open in Pylon" position="top">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCellClick({ isTotals: true }, status as 'new' | 'waiting' | 'hold')}
                      onKeyDown={(e) => handleKeyDown(e, { isTotals: true }, status as 'new' | 'waiting' | 'hold')}
                      className="text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={`Open all ${status} tickets in Pylon`}
                    >
                      {totals.statusCounts[status]}
                    </motion.button>
                  </Tooltip>
                </td>
              ))}
              
              <td className="text-center">
                <Tooltip content="Open in Pylon" position="top">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCellClick({ isTotals: true }, 'closedToday')}
                    onKeyDown={(e) => handleKeyDown(e, { isTotals: true }, 'closedToday')}
                    className="text-success-400 hover:text-success-300 font-bold transition-colors cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label="Open all closed today tickets in Pylon"
                  >
                    {totals.closedToday}
                  </motion.button>
                </Tooltip>
              </td>
              
              <td className="text-center">
                <Tooltip content="Open in Pylon" position="top">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCellClick({ isTotals: true }, 'totalOpen')}
                    onKeyDown={(e) => handleKeyDown(e, { isTotals: true }, 'totalOpen')}
                    className="text-white hover:text-gray-300 font-bold transition-colors cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label="Open all total open tickets in Pylon"
                  >
                    {totals.totalOpen}
                  </motion.button>
                </Tooltip>
              </td>
            </motion.tr>
          </tbody>
        </table>
      </div>
      
      <div className="px-4 py-2 border-t border-gray-700">
        <p className="text-xs text-gray-300 flex items-center">
          <ExternalLink className="w-3 h-3 mr-1" />
          Click numbers to view tickets in Pylon
        </p>
      </div>
      
      {/* Info Icon */}
      <InfoIcon
        title="Ticket Assignment Table"
        description="Shows ticket distribution across team members and different status categories. Displays workload distribution, individual performance metrics, and team capacity overview."
        features={[
          'Agent column: Team member names and avatars',
          'Status columns: New, Waiting, On Hold ticket counts',
          'Closed Today: Tickets closed by each agent today',
          'Total Open: Current open ticket count per agent',
          'Click any number to view tickets in Pylon',
          'Sort by clicking column headers',
          'Totals row shows team-wide statistics'
        ]}
        position="bottom-right"
      />
    </div>
  );
};

export default TicketAssignmentTable;
