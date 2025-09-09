import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Home, BarChart3 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Breadcrumb: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const breadcrumbs = [
    {
      label: 'Dashboard',
      path: '/',
      icon: Home,
      active: location.pathname === '/'
    },
    {
      label: 'History',
      path: '/history',
      icon: BarChart3,
      active: location.pathname === '/history'
    }
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center space-x-2 text-sm text-gray-400 mb-4"
    >
      {breadcrumbs.map((breadcrumb, index) => (
        <React.Fragment key={breadcrumb.path}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(breadcrumb.path)}
            className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
              breadcrumb.active
                ? 'text-white bg-gray-700'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <breadcrumb.icon className="w-4 h-4" />
            <span>{breadcrumb.label}</span>
          </motion.button>
          
          {index < breadcrumbs.length - 1 && (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </React.Fragment>
      ))}
    </motion.nav>
  );
};

export default Breadcrumb;


