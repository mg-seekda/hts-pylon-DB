import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode, useRef } from 'react';
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
  cacheMetadata?: CacheMetadata;
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
  cacheMetadata?: CacheMetadata;
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
    kpis?: CacheMetadata;
    assignmentTable?: CacheMetadata;
    dailyFlow?: CacheMetadata;
    hourlyHeatmap?: CacheMetadata;
  };
}

type DataAction =
  | { type: 'SET_LOADING'; payload: { key: keyof DataState['loading']; value: boolean } }
  | { type: 'SET_KPIS'; payload: { kpis: KPIs; cacheMetadata?: CacheMetadata } }
  | { type: 'SET_ASSIGNMENT_TABLE'; payload: { assignmentTable: AssignmentTable; cacheMetadata?: CacheMetadata } }
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
        kpis: action.payload.kpis,
        loading: { ...state.loading, kpis: false },
        error: null,
        cacheStatus: action.payload.cacheMetadata ? {
          ...state.cacheStatus,
          kpis: action.payload.cacheMetadata
        } : state.cacheStatus,
      };
    case 'SET_ASSIGNMENT_TABLE':
      return {
        ...state,
        assignmentTable: action.payload.assignmentTable,
        loading: { ...state.loading, assignmentTable: false },
        error: null,
        cacheStatus: action.payload.cacheMetadata ? {
          ...state.cacheStatus,
          assignmentTable: action.payload.cacheMetadata
        } : state.cacheStatus,
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
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchKPIs = useCallback(async () => {
    try {
      const response = await apiService.getKPIs();
      const { cacheMetadata, ...kpis } = response;
      dispatch({ type: 'SET_KPIS', payload: { kpis, cacheMetadata } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch KPIs' });
    }
  }, []); // Remove dependency to prevent infinite loops

  const fetchAssignmentTable = useCallback(async () => {
    try {
      const response = await apiService.getAssignmentTable();
      const { cacheMetadata, ...assignmentTable } = response;
      dispatch({ type: 'SET_ASSIGNMENT_TABLE', payload: { assignmentTable, cacheMetadata } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch assignment table' });
    }
  }, []); // Remove dependency to prevent infinite loops






  const refreshDailyFlow = useCallback(async () => {
    try {
      const response = await apiService.getDailyFlow();
      console.log('Daily flow response:', response);
      
      // Extract the dailyFlow data and cache metadata from the response
      const dailyFlow = response?.dailyFlow;
      const cacheMetadata = response?.cacheMetadata;
      
      if (!dailyFlow) {
        console.error('No dailyFlow data in response:', response);
        throw new Error('Invalid response: missing dailyFlow data');
      }
      
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
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        response: (error as any)?.response?.data,
        status: (error as any)?.response?.status,
        fullError: error
      });
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch daily flow data';
      dispatch({ type: 'SET_ERROR', payload: `Daily Flow: ${errorMessage}` });
    }
  }, []); // Remove dependency to prevent infinite loops

  const refreshHourlyHeatmap = useCallback(async () => {
    try {
      // Refreshing hourly heatmap data
      const response = await apiService.getHourlyHeatmap();
      console.log('Hourly heatmap response:', response);
      
      // Extract the hourlyHeatmap data and cache metadata from the response
      const hourlyHeatmap = response?.hourlyHeatmap;
      const cacheMetadata = response?.cacheMetadata;
      
      if (!hourlyHeatmap) {
        console.error('No hourlyHeatmap data in response:', response);
        throw new Error('Invalid response: missing hourlyHeatmap data');
      }
      
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
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        response: (error as any)?.response?.data,
        status: (error as any)?.response?.status,
        fullError: error
      });
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch hourly heatmap data';
      dispatch({ type: 'SET_ERROR', payload: `Hourly Heatmap: ${errorMessage}` });
    }
  }, []); // Remove dependency to prevent infinite loops

  // Individual refresh functions with loading states
  const refreshKPIs = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'kpis', value: true } });
    try {
      await fetchKPIs();
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'kpis', value: false } });
    }
  }, [fetchKPIs]);

  const refreshAssignmentTable = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'assignmentTable', value: true } });
    try {
      await fetchAssignmentTable();
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'assignmentTable', value: false } });
    }
  }, [fetchAssignmentTable]);

  const refreshAll = useCallback(async () => {
    // Set loading states for refresh
    dispatch({ type: 'SET_LOADING', payload: { key: 'kpis', value: true } });
    dispatch({ type: 'SET_LOADING', payload: { key: 'assignmentTable', value: true } });
    dispatch({ type: 'SET_LOADING', payload: { key: 'dailyFlow', value: true } });
    dispatch({ type: 'SET_LOADING', payload: { key: 'hourlyHeatmap', value: true } });
    
    await Promise.all([
      fetchKPIs(),
      fetchAssignmentTable(),
      refreshDailyFlow(),
      refreshHourlyHeatmap(),
    ]);
    
    // Clear loading states
    dispatch({ type: 'SET_LOADING', payload: { key: 'kpis', value: false } });
    dispatch({ type: 'SET_LOADING', payload: { key: 'assignmentTable', value: false } });
    dispatch({ type: 'SET_LOADING', payload: { key: 'dailyFlow', value: false } });
    dispatch({ type: 'SET_LOADING', payload: { key: 'hourlyHeatmap', value: false } });
    
    // Update timestamp only once after all data is refreshed
    dispatch({ type: 'SET_LAST_UPDATED', payload: new Date().toISOString() });
  }, [fetchKPIs, fetchAssignmentTable, refreshDailyFlow, refreshHourlyHeatmap]);

  // Debounced refresh to prevent rapid successive calls
  const debouncedRefreshAll = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      refreshAll();
    }, 1000); // 1 second debounce
  }, [refreshAll]);

  // Initial data fetch
  useEffect(() => {
    const loadInitialData = async () => {
      // Set loading states for initial load
      dispatch({ type: 'SET_LOADING', payload: { key: 'kpis', value: true } });
      dispatch({ type: 'SET_LOADING', payload: { key: 'assignmentTable', value: true } });
      dispatch({ type: 'SET_LOADING', payload: { key: 'dailyFlow', value: true } });
      dispatch({ type: 'SET_LOADING', payload: { key: 'hourlyHeatmap', value: true } });
      
      // Fetch all data
      await Promise.all([
        fetchKPIs(),
        fetchAssignmentTable(),
        refreshDailyFlow(),
        refreshHourlyHeatmap(),
      ]);
      
      // Clear loading states
      dispatch({ type: 'SET_LOADING', payload: { key: 'kpis', value: false } });
      dispatch({ type: 'SET_LOADING', payload: { key: 'assignmentTable', value: false } });
      dispatch({ type: 'SET_LOADING', payload: { key: 'dailyFlow', value: false } });
      dispatch({ type: 'SET_LOADING', payload: { key: 'hourlyHeatmap', value: false } });
      
      // Set initial timestamp
      dispatch({ type: 'SET_LAST_UPDATED', payload: new Date().toISOString() });
    };
    
    loadInitialData();
    
    // Set up auto-refresh every 30 minutes to avoid rate limiting
    const interval = setInterval(() => {
      debouncedRefreshAll();
    }, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchKPIs, fetchAssignmentTable, refreshDailyFlow, refreshHourlyHeatmap]);

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
