import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Users, User, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useData } from '../context/DataContext';


const TicketAssignmentTable: React.FC = () => {
  const { state, refreshAssignmentTable } = useData();
  const { assignmentTable, loading } = state;
  

  
  // Sorting state - default to closed today descending
  const [sortColumn, setSortColumn] = useState<string>('closedToday');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleTicketClick = async (assigneeId: string, status: string) => {
    try {
      // This would typically open a new window/tab with the filtered Pylon view
      // For now, we'll just log the action
      console.log(`Opening Pylon view for assignee: ${assigneeId}, status: ${status}`);
      
      // In a real implementation, you would construct the Pylon URL and open it
      // const pylonUrl = `https://your-pylon-instance.com/tickets?assignee=${assigneeId}&status=${status}`;
      // window.open(pylonUrl, '_blank');
    } catch (error) {
      console.error('Error opening Pylon view:', error);
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Ticket Assignment
          </h2>
        </div>
        <div className="card-body">
          <p className="text-gray-600 dark:text-gray-400">No assignment data available</p>
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
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Ticket Assignment
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Total: {assignmentTable.totalTickets} tickets
            </p>
          </div>
          <button
            onClick={refreshAssignmentTable}
            disabled={loading.assignmentTable}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading.assignmentTable ? 'animate-spin' : ''}`} />
            Refresh Table
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
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
                      <div className="relative">
                        <img 
                          src={user.avatarUrl} 
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover mr-3 border border-gray-300 dark:border-gray-600"
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
                          <Users className="w-4 h-4 text-gray-900 dark:text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center mr-3">
                        <Users className="w-4 h-4 text-gray-900 dark:text-white" />
                      </div>
                    )}
                    <div>
                      <div className="text-gray-900 dark:text-white">{user.name}</div>
                      {user.email && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">{user.email}</div>
                      )}
                    </div>
                  </div>
                </td>
                
                {assignmentTable.statuses.map((status) => (
                  <td key={status} className="text-center">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTicketClick(user.id, status)}
                      className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
                      disabled={user.statusCounts[status] === 0}
                    >
                      {user.statusCounts[status] || 0}
                    </motion.button>
                  </td>
                ))}
                
                <td className="text-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleTicketClick(user.id, 'closed_today')}
                    className="text-success-400 hover:text-success-300 font-medium transition-colors"
                    disabled={user.closedToday === 0}
                  >
                    {user.closedToday || 0}
                  </motion.button>
                </td>
                
                <td className="text-center font-semibold text-gray-900 dark:text-white">
                  {user.totalOpen}
                </td>
              </motion.tr>
            ))}
            
            {/* Totals Row */}
            <motion.tr
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sortedUsers.length * 0.05 + 0.1 }}
              className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-800/50 font-semibold"
            >
              <td className="font-bold text-gray-900 dark:text-white">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center mr-3">
                    <Users className="w-4 h-4 text-gray-900 dark:text-white" />
                  </div>
                  <span>TOTALS</span>
                </div>
              </td>
              
              {assignmentTable.statuses.map((status) => (
                <td key={status} className="text-center">
                  <span className="text-primary-400 font-bold">
                    {totals.statusCounts[status]}
                  </span>
                </td>
              ))}
              
              <td className="text-center">
                <span className="text-success-400 font-bold">
                  {totals.closedToday}
                </span>
              </td>
              
              <td className="text-center">
                <span className="text-gray-900 dark:text-white font-bold">
                  {totals.totalOpen}
                </span>
              </td>
            </motion.tr>
          </tbody>
        </table>
      </div>
      
      <div className="px-4 py-3 border-t border-gray-700">
        <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center">
          <ExternalLink className="w-3 h-3 mr-1" />
          Click numbers to view tickets in Pylon
        </p>
      </div>
    </div>
  );
};

export default TicketAssignmentTable;
