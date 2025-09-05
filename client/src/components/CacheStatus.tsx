import React from 'react';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { CacheMetadata } from '../context/DataContext';

interface CacheStatusProps {
  metadata?: CacheMetadata;
  className?: string;
}

const CacheStatus: React.FC<CacheStatusProps> = ({ metadata, className = '' }) => {
  if (!metadata) return null;

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getStatusIcon = () => {
    if (metadata.warning) {
      return <AlertTriangle className="w-3 h-3 text-yellow-400" />;
    }
    if (metadata.servingCached) {
      return <RefreshCw className="w-3 h-3 text-blue-400" />;
    }
    return <CheckCircle className="w-3 h-3 text-green-400" />;
  };

  const getStatusText = () => {
    if (metadata.warning) {
      return 'Cached data (API error)';
    }
    if (metadata.servingCached) {
      return 'Cached data (refreshing)';
    }
    return 'Fresh data';
  };

  const getStatusColor = () => {
    if (metadata.warning) {
      return 'text-yellow-400';
    }
    if (metadata.servingCached) {
      return 'text-blue-400';
    }
    return 'text-green-400';
  };

  return (
    <div className={`flex items-center gap-1 text-xs ${className}`}>
      {getStatusIcon()}
      <span className={getStatusColor()}>
        {getStatusText()}
      </span>
      <span className="text-gray-400">
        • {formatTime(metadata.cachedAt)}
      </span>
      {metadata.warning && (
        <span className="text-yellow-400 text-xs ml-1" title={metadata.warning}>
          ⚠️
        </span>
      )}
    </div>
  );
};

export default CacheStatus;
