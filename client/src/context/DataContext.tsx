import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { apiService } from '../services/apiService';

// Types
export interface KPIs {
  totalOpen: number;
  createdToday: number;
  onHold: number;
  openOver24h: number;
  closedToday: number;
  avgResolutionTime: number; // in hours
  newTickets: number;
  externalIssues: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  status: string; // User status: 'active', 'inactive', etc.
  statusCounts: Record<string, number>;
  closedToday: number;
  totalOpen: number;
}

export interface AssignmentTable {
  users: User[];
  unassigned: User;
  statuses: string[];
  totalTickets: number;
}

export interface Ticket {
  id: string;
  title: string;
  state: string;
  assignee?: {
    id: string;
    email: string;
  };
  account?: {
    id: string;
  };
  created_at: string;
  custom_fields?: {
    closed_at?: {
      slug: string;
      value: string;
    };
  };
}





export interface DailyFlowData {
  date: string;
  created: number;
  closed: number;
}

export interface HeatmapData {
  day: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hour: number; // 0-23
  count: number;
}

export interface CacheMetadata {
  cachedAt: string;
  isStale: boolean;
  servingCached: boolean;
  warning?: string;
}

export interface AnalyticsData {
  dailyFlow?: {
    data: DailyFlowData[];
    period: string;
  };
  hourlyHeatmap?: {
    data: HeatmapData[];
    period: string;
  };
  resolutionTime?: {
    average: number;
    median: number;
    count: number;
  };
  oldestTickets?: {
    tickets: Ticket[];
    count: number;
  };
  topAccounts?: {
    accounts: Array<{
      accountId: string;
      count: number;
    }>;
    count: number;
  };
  generatedAt?: string;
  cacheMetadata?: CacheMetadata;
}

interface DataState {
  kpis: KPIs | null;
  assignmentTable: AssignmentTable | null;
  analytics: AnalyticsData | null;
  loading: {
    kpis: boolean;
    assignmentTable: boolean;
    analytics: boolean;
    dailyFlow: boolean;
    hourlyHeatmap: boolean;
  };
  error: string | null;
  lastUpdated: string | null;
  cacheStatus: {
    dailyFlow?: CacheMetadata;
    hourlyHeatmap?: CacheMetadata;
  };
}

type DataAction =
  | { type: 'SET_LOADING'; payload: { key: keyof DataState['loading']; value: boolean } }
  | { type: 'SET_KPIS'; payload: KPIs }
  | { type: 'SET_ASSIGNMENT_TABLE'; payload: AssignmentTable }
  | { type: 'SET_ANALYTICS'; payload: AnalyticsData }
  | { type: 'UPDATE_DAILY_FLOW'; payload: any }
  | { type: 'UPDATE_HOURLY_HEATMAP'; payload: any }
  | { type: 'UPDATE_CACHE_STATUS'; payload: { key: keyof DataState['cacheStatus']; metadata: CacheMetadata } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_LAST_UPDATED'; payload: string };

const initialState: DataState = {
  kpis: null,
  assignmentTable: null,
  analytics: null,
  loading: {
    kpis: false,
    assignmentTable: false,
    analytics: false,
    dailyFlow: false,
    hourlyHeatmap: false,
  },
  error: null,
  lastUpdated: null,
  cacheStatus: {},
};

const dataReducer = (state: DataState, action: DataAction): DataState => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.key]: action.payload.value,
        },
      };
    case 'SET_KPIS':
      return {
        ...state,
        kpis: action.payload,
        loading: { ...state.loading, kpis: false },
        error: null,
      };
    case 'SET_ASSIGNMENT_TABLE':
      return {
        ...state,
        assignmentTable: action.payload,
        loading: { ...state.loading, assignmentTable: false },
        error: null,
      };

    case 'SET_ANALYTICS':
      return {
        ...state,
        analytics: action.payload,
        loading: { ...state.loading, analytics: false },
        error: null,
      };
    case 'UPDATE_DAILY_FLOW':
      return {
        ...state,
        analytics: {
          ...(state.analytics || {}),
          dailyFlow: action.payload,
        },
        loading: { ...state.loading, dailyFlow: false },
        error: null,
      };
    case 'UPDATE_HOURLY_HEATMAP':
      return {
        ...state,
        analytics: {
          ...(state.analytics || {}),
          hourlyHeatmap: action.payload,
        },
        loading: { ...state.loading, hourlyHeatmap: false },
        error: null,
      };
    case 'UPDATE_CACHE_STATUS':
      return {
        ...state,
        cacheStatus: {
          ...state.cacheStatus,
          [action.payload.key]: action.payload.metadata,
        },
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: {
          kpis: false,
          assignmentTable: false,
          analytics: false,
          dailyFlow: false,
          hourlyHeatmap: false,
        },
      };
    case 'SET_LAST_UPDATED':
      return {
        ...state,
        lastUpdated: action.payload,
      };
    default:
      return state;
  }
};

interface DataContextType {
  state: DataState;
  fetchKPIs: () => Promise<void>;
  fetchAssignmentTable: () => Promise<void>;
  refreshKPIs: () => Promise<void>;
  refreshAssignmentTable: () => Promise<void>;
  refreshDailyFlow: () => Promise<void>;
  refreshHourlyHeatmap: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(dataReducer, initialState);

  const fetchKPIs = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'kpis', value: true } });
    try {
      const kpis = await apiService.getKPIs();
      dispatch({ type: 'SET_KPIS', payload: kpis });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch KPIs' });
    }
  }, []);

  const fetchAssignmentTable = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'assignmentTable', value: true } });
    try {
      const assignmentTable = await apiService.getAssignmentTable();
      dispatch({ type: 'SET_ASSIGNMENT_TABLE', payload: assignmentTable });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch assignment table' });
    }
  }, []);




  const refreshKPIs = useCallback(async () => {
    dispatch({ type: 'SET_LAST_UPDATED', payload: new Date().toISOString() });
    await fetchKPIs();
  }, [fetchKPIs]);

  const refreshAssignmentTable = useCallback(async () => {
    dispatch({ type: 'SET_LAST_UPDATED', payload: new Date().toISOString() });
    await fetchAssignmentTable();
  }, [fetchAssignmentTable]);


  const refreshDailyFlow = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'dailyFlow', value: true } });
    dispatch({ type: 'SET_LAST_UPDATED', payload: new Date().toISOString() });
    try {
      const response = await apiService.getDailyFlow();
      
      // Extract the dailyFlow data and cache metadata from the response
      const dailyFlow = response.dailyFlow;
      const cacheMetadata = response.cacheMetadata;
      
      // Update only the daily flow part of analytics
      dispatch({ type: 'UPDATE_DAILY_FLOW', payload: dailyFlow });
      
      // Update cache status if metadata is available
      if (cacheMetadata) {
        dispatch({ 
          type: 'UPDATE_CACHE_STATUS', 
          payload: { key: 'dailyFlow', metadata: cacheMetadata } 
        });
      }
      
      // Clear any previous errors
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error) {
      console.error('Error refreshing daily flow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch daily flow data';
      dispatch({ type: 'SET_ERROR', payload: `Daily Flow: ${errorMessage}` });
    }
  }, []);

  const refreshHourlyHeatmap = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'hourlyHeatmap', value: true } });
    dispatch({ type: 'SET_LAST_UPDATED', payload: new Date().toISOString() });
    try {
      // Refreshing hourly heatmap data
      const response = await apiService.getHourlyHeatmap();
      
      // Extract the hourlyHeatmap data and cache metadata from the response
      const hourlyHeatmap = response.hourlyHeatmap;
      const cacheMetadata = response.cacheMetadata;
      
      // Update only the hourly heatmap part of analytics
      dispatch({ type: 'UPDATE_HOURLY_HEATMAP', payload: hourlyHeatmap });
      
      // Update cache status if metadata is available
      if (cacheMetadata) {
        dispatch({ 
          type: 'UPDATE_CACHE_STATUS', 
          payload: { key: 'hourlyHeatmap', metadata: cacheMetadata } 
        });
      }
      
      // Clear any previous errors
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error) {
      console.error('Error refreshing hourly heatmap:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch hourly heatmap data';
      dispatch({ type: 'SET_ERROR', payload: `Hourly Heatmap: ${errorMessage}` });
    }
  }, []);

  const refreshAll = useCallback(async () => {
    dispatch({ type: 'SET_LAST_UPDATED', payload: new Date().toISOString() });
    await Promise.all([
      fetchKPIs(),
      fetchAssignmentTable(),
      refreshDailyFlow(),
      refreshHourlyHeatmap(),
    ]);
  }, [fetchKPIs, fetchAssignmentTable, refreshDailyFlow, refreshHourlyHeatmap]);

  // Initial data fetch
  useEffect(() => {
    refreshAll();
    
    // Set up auto-refresh every 30 minutes to avoid rate limiting
    const interval = setInterval(refreshAll, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [refreshAll]);

  const value: DataContextType = {
    state,
    fetchKPIs,
    fetchAssignmentTable,
    refreshKPIs,
    refreshAssignmentTable,
    refreshDailyFlow,
    refreshHourlyHeatmap,
    refreshAll,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
