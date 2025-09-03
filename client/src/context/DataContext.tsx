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
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
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
}

interface DataState {
  kpis: KPIs | null;
  assignmentTable: AssignmentTable | null;
  analytics: AnalyticsData | null;
  loading: {
    kpis: boolean;
    assignmentTable: boolean;
    analytics: boolean;
  };
  error: string | null;
  lastUpdated: string | null;
}

type DataAction =
  | { type: 'SET_LOADING'; payload: { key: keyof DataState['loading']; value: boolean } }
  | { type: 'SET_KPIS'; payload: KPIs }
  | { type: 'SET_ASSIGNMENT_TABLE'; payload: AssignmentTable }
  | { type: 'SET_ANALYTICS'; payload: AnalyticsData }
  | { type: 'UPDATE_DAILY_FLOW'; payload: any }
  | { type: 'UPDATE_HOURLY_HEATMAP'; payload: any }
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
  },
  error: null,
  lastUpdated: null,
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
          ...state.analytics,
          dailyFlow: action.payload,
        },
        loading: { ...state.loading, analytics: false },
        error: null,
      };
    case 'UPDATE_HOURLY_HEATMAP':
      return {
        ...state,
        analytics: {
          ...state.analytics,
          hourlyHeatmap: action.payload,
        },
        loading: { ...state.loading, analytics: false },
        error: null,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: {
          kpis: false,
          assignmentTable: false,
          analytics: false,
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
  fetchAnalytics: () => Promise<void>;
  refreshKPIs: () => Promise<void>;
  refreshAssignmentTable: () => Promise<void>;
  refreshAnalytics: () => Promise<void>;
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



  const fetchAnalytics = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'analytics', value: true } });
    try {
      const [analytics, hourlyHeatmap] = await Promise.all([
        apiService.getAnalytics(),
        apiService.getHourlyHeatmap()
      ]);
      
      // Merge the hourly heatmap data into analytics
      const mergedAnalytics = {
        ...analytics,
        hourlyHeatmap
      };
      
      dispatch({ type: 'SET_ANALYTICS', payload: mergedAnalytics });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch analytics' });
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

  const refreshAnalytics = useCallback(async () => {
    dispatch({ type: 'SET_LAST_UPDATED', payload: new Date().toISOString() });
    await fetchAnalytics();
  }, [fetchAnalytics]);

  const refreshDailyFlow = useCallback(async () => {
    dispatch({ type: 'SET_LAST_UPDATED', payload: new Date().toISOString() });
    try {
      const dailyFlow = await apiService.getDailyFlow();
      // Update only the daily flow part of analytics
      dispatch({ type: 'UPDATE_DAILY_FLOW', payload: dailyFlow });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch daily flow data' });
    }
  }, []);

  const refreshHourlyHeatmap = useCallback(async () => {
    dispatch({ type: 'SET_LAST_UPDATED', payload: new Date().toISOString() });
    try {
      const hourlyHeatmap = await apiService.getHourlyHeatmap();
      // Update only the hourly heatmap part of analytics
      dispatch({ type: 'UPDATE_HOURLY_HEATMAP', payload: hourlyHeatmap });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch hourly heatmap data' });
    }
  }, []);

  const refreshAll = useCallback(async () => {
    dispatch({ type: 'SET_LAST_UPDATED', payload: new Date().toISOString() });
    await Promise.all([
      fetchKPIs(),
      fetchAssignmentTable(),
      fetchAnalytics(),
    ]);
  }, [fetchKPIs, fetchAssignmentTable, fetchAnalytics]);

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
    fetchAnalytics,
    refreshKPIs,
    refreshAssignmentTable,
    refreshAnalytics,
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
