import axios from 'axios';
import { KPIs, AssignmentTable, AnalyticsData } from '../context/DataContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      // Handle authentication errors
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export const apiService = {
  // Health check
  async getHealth() {
    const response = await apiClient.get('/health');
    return response.data;
  },

  // KPIs
  async getKPIs(): Promise<KPIs> {
    const response = await apiClient.get('/tickets/kpis');
    return response.data;
  },

  // Assignment Table
  async getAssignmentTable(): Promise<AssignmentTable> {
    const response = await apiClient.get('/tickets/assignment-table');
    return response.data;
  },

  // Tickets by assignee and status
  async getTicketsByAssignee(assigneeId: string, status: string) {
    const response = await apiClient.get(`/tickets/by-assignee/${assigneeId}/${status}`);
    return response.data;
  },

  // Oldest tickets
  async getOldestTickets(limit: number = 10) {
    const response = await apiClient.get(`/tickets/oldest?limit=${limit}`);
    return response.data;
  },

  // Top accounts
  async getTopAccounts(limit: number = 5) {
    const response = await apiClient.get(`/tickets/top-accounts?limit=${limit}`);
    return response.data;
  },




  // Daily flow data
  async getDailyFlow() {
    const response = await apiClient.get('/analytics/daily-flow', {
      timeout: 30000 // 30 seconds timeout
    });
    return response.data;
  },

  // Hourly heatmap data
  async getHourlyHeatmap() {
    const response = await apiClient.get('/analytics/hourly-heatmap', {
      timeout: 30000 // 30 seconds timeout
    });
    return response.data;
  },

  // Resolution time
  async getResolutionTime() {
    const response = await apiClient.get('/analytics/resolution-time');
    return response.data;
  },

  // Users
  async getUsers() {
    const response = await apiClient.get('/users');
    return response.data;
  },

  // User by ID
  async getUser(userId: string) {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  },
};

export default apiService;
