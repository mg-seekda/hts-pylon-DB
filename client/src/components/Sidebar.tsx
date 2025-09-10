import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  History, 
  RefreshCw, 
  ExternalLink,
  Users,
  User,
  AlertCircle,
  CheckCircle,
  Github
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { PYLON_VIEWS } from '../utils/pylonUtils';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { state, refreshAll } = useData();
  const { lastUpdated } = state;

  const navigationItems = [
    {
      path: '/',
      label: 'Dashboard',
      icon: BarChart3,
      description: 'Live analytics and KPIs'
    },
    {
      path: '/history',
      label: 'History',
      icon: History,
      description: 'Historical data and trends'
    }
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const formatLastUpdated = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <motion.div
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-700 flex flex-col z-50"
    >
      {/* Logo and Title */}
      <div className="p-6 border-b border-gray-700">
        <div className="text-center">
          <img 
            src="/Seekda_Aspire_Logo_23_1_no_outline-2.svg" 
            alt="Seekda Aspire Logo" 
            className="w-full h-auto mx-auto mb-3 px-2"
          />
          <h1 className="text-sm font-medium text-white">HTS Dashboard</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                <div className="flex-1">
                  <div className="font-medium">{item.label}</div>
                  <div className={`text-xs ${active ? 'text-blue-100' : 'text-gray-500 group-hover:text-gray-300'}`}>
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Global Controls */}
      <div className="p-4 border-t border-gray-700 space-y-4">
        {/* Last Updated */}
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Last Updated</div>
          <div className="text-sm text-gray-300 font-mono">
            {formatLastUpdated(lastUpdated)}
          </div>
        </div>

        {/* Global Refresh Button */}
        <button
          onClick={refreshAll}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh All</span>
        </button>

        {/* Pylon Links */}
        <div className="space-y-2">
          <div className="text-xs text-gray-500 mb-2">Quick Links</div>
          <a
            href="https://app.usepylon.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors duration-200"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="text-sm">Pylon App</span>
          </a>
          <a
            href={PYLON_VIEWS.ALL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors duration-200"
          >
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">All Issues</span>
          </a>
          <a
            href={PYLON_VIEWS.MY}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors duration-200"
          >
            <User className="w-4 h-4" />
            <span className="text-sm">My Issues</span>
          </a>
          <a
            href={PYLON_VIEWS.UNASSIGNED}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors duration-200"
          >
            <Users className="w-4 h-4" />
            <span className="text-sm">Unassigned</span>
          </a>
          <a
            href={PYLON_VIEWS.CLOSED_BY_ASSIGNEE}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors duration-200"
          >
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Closed by Assignee</span>
          </a>
          
          {/* Divider */}
          <div className="border-t border-gray-700 my-2"></div>
          
          <a
            href="https://github.com/mg-seekda/hts-pylon-DB"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors duration-200"
          >
            <Github className="w-4 h-4" />
            <span className="text-sm">GitHub</span>
          </a>
        </div>
      </div>
    </motion.div>
  );
};

export default Sidebar;
