/**
 * Centralized API client & Authentication Session manager
 * for Ration Distribution System Frontend.
 */

// Determine base API URL (relative or fallback)
const API_BASE_URL = window.API_BASE_URL || '';

const AUTH_STORAGE_KEY = 'ration_auth_session';

/**
 * Storage helpers for authentication session
 */
export const authStorage = {
  getToken() {
    try {
      const session = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
      return session?.token || null;
    } catch {
      return null;
    }
  },

  getSession() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    } catch {
      return null;
    }
  },

  setSession(data) {
    if (!data) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      token: data.token,
      role: data.role,
      user: data.user || data.data || {},
      loginTime: new Date().toISOString(),
      isLoggedIn: true
    }));
  },

  clearSession() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },

  isAuthenticated() {
    return !!this.getToken();
  }
};

/**
 * Core HTTP Request Wrapper
 */
export async function apiRequest(endpoint, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    requiresAuth = false,
  } = options;

  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (requiresAuth) {
    const token = authStorage.getToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const config = {
    method,
    headers: requestHeaders,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    config.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, config);
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { message: await response.text() };
    }

    if (!response.ok) {
      const errorMessage = data?.message || data?.error || `HTTP ${response.status}: Request failed`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`API Request Error [${method} ${endpoint}]:`, error);
    throw error;
  }
}

/**
 * Authentication & Registration API Endpoints
 */
export const authApi = {
  /**
   * Admin Login
   * @param {Object} credentials - { adminId, password }
   */
  async adminLogin(credentials) {
    const data = await apiRequest('/api/auth/admin/login', {
      method: 'POST',
      body: credentials,
    });
    if (data.token) {
      authStorage.setSession({
        token: data.token,
        role: 'admin',
        user: data.data || {},
      });
    }
    return data;
  },

  /**
   * Distributor Login
   * @param {Object} credentials - { distributorId, password }
   */
  async distributorLogin(credentials) {
    const data = await apiRequest('/api/auth/distributor/login', {
      method: 'POST',
      body: credentials,
    });
    if (data.token) {
      authStorage.setSession({
        token: data.token,
        role: 'distributor',
        user: data.data || {},
      });
    }
    return data;
  },

  /**
   * Beneficiary / User Login
   * @param {Object} credentials - { rationCardNumber, password }
   */
  async beneficiaryLogin(credentials) {
    const data = await apiRequest('/api/auth/beneficiary/login', {
      method: 'POST',
      body: credentials,
    });
    if (data.token) {
      authStorage.setSession({
        token: data.token,
        role: 'user',
        user: data.data || {},
      });
    }
    return data;
  },

  /**
   * Distributor Registration
   * @param {Object} payload - { name, distributorId, fpsCode, mobileNumber, district, taluk, password }
   */
  async registerDistributor(payload) {
    return await apiRequest('/api/auth/distributor/register', {
      method: 'POST',
      body: payload,
    });
  },

  /**
   * Beneficiary / User Registration
   * @param {Object} payload - { fullName, rationCardNumber, mobileNumber, familyMemberCount, district, taluk, village, address, password }
   */
  async registerBeneficiary(payload) {
    return await apiRequest('/api/auth/beneficiary/register', {
      method: 'POST',
      body: payload,
    });
  },

  /**
   * Logout helper
   */
  logout() {
    authStorage.clearSession();
    window.location.href = 'login.html';
  }
};

/**
 * Admin Portal API Endpoints
 */
export const adminApi = {
  // 1. Distributor Management
  async getAllDistributors(params = {}) {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.district && params.district !== 'ALL') query.append('district', params.district);
    if (params.taluk) query.append('taluk', params.taluk);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await apiRequest(`/api/admin/distributors${qs}`, { requiresAuth: true });
  },

  async getPendingDistributors() {
    return await apiRequest('/api/admin/distributors/pending', { requiresAuth: true });
  },

  async approveDistributor(id) {
    return await apiRequest(`/api/admin/distributors/${id}/approve`, {
      method: 'PATCH',
      requiresAuth: true,
    });
  },

  async rejectDistributor(id) {
    return await apiRequest(`/api/admin/distributors/${id}/reject`, {
      method: 'PATCH',
      requiresAuth: true,
    });
  },

  async suspendDistributor(id) {
    return await apiRequest(`/api/admin/distributors/${id}/suspend`, {
      method: 'PATCH',
      requiresAuth: true,
    });
  },

  async activateDistributor(id) {
    return await apiRequest(`/api/admin/distributors/${id}/activate`, {
      method: 'PATCH',
      requiresAuth: true,
    });
  },

  // 2. Central Inventory
  async getCentralInventory() {
    return await apiRequest('/api/admin/inventory', { requiresAuth: true });
  },

  async addRiceStock(quantity) {
    return await apiRequest('/api/admin/inventory/rice', {
      method: 'POST',
      body: { quantity },
      requiresAuth: true,
    });
  },

  async addOilStock(quantity) {
    return await apiRequest('/api/admin/inventory/oil', {
      method: 'POST',
      body: { quantity },
      requiresAuth: true,
    });
  },

  async updateCentralInventory(payload) {
    return await apiRequest('/api/admin/inventory', {
      method: 'PUT',
      body: payload,
      requiresAuth: true,
    });
  },

  // 3. Stock Dispatch
  async dispatchRice(payload) {
    return await apiRequest('/api/admin/dispatch/rice', {
      method: 'POST',
      body: payload,
      requiresAuth: true,
    });
  },

  async dispatchOil(payload) {
    return await apiRequest('/api/admin/dispatch/oil', {
      method: 'POST',
      body: payload,
      requiresAuth: true,
    });
  },

  async getDispatchHistory() {
    return await apiRequest('/api/admin/dispatch/history', { requiresAuth: true });
  },

  // 4. Reports
  async getSummaryReport() {
    return await apiRequest('/api/admin/reports/summary', { requiresAuth: true });
  },

  async getDailyTransactions(date) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return await apiRequest(`/api/admin/reports/transactions/daily${qs}`, { requiresAuth: true });
  },

  async getMonthlyTransactions(month, year) {
    const query = new URLSearchParams();
    if (month) query.append('month', month);
    if (year) query.append('year', year);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await apiRequest(`/api/admin/reports/transactions/monthly${qs}`, { requiresAuth: true });
  },

  // 5. Notifications
  async sendNotificationToDistributor(payload) {
    return await apiRequest('/api/admin/notifications/distributor', {
      method: 'POST',
      body: payload,
      requiresAuth: true,
    });
  },

  async sendNotificationToAllDistributors(payload) {
    return await apiRequest('/api/admin/notifications/distributors/all', {
      method: 'POST',
      body: payload,
      requiresAuth: true,
    });
  },

  async sendNotificationToBeneficiary(payload) {
    return await apiRequest('/api/admin/notifications/beneficiary', {
      method: 'POST',
      body: payload,
      requiresAuth: true,
    });
  },

  async sendNotificationToAllBeneficiaries(payload) {
    return await apiRequest('/api/admin/notifications/beneficiaries/all', {
      method: 'POST',
      body: payload,
      requiresAuth: true,
    });
  },
};

export const distributorApi = {
  // 1. Dashboard & Inventory & Profile
  async getDashboardSummary() {
    return await apiRequest('/api/distributor/dashboard', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getInventory() {
    return await apiRequest('/api/distributor/inventory', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getProfile() {
    return await apiRequest('/api/distributor/profile', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async updateProfile(payload) {
    return await apiRequest('/api/distributor/profile', {
      method: 'PUT',
      body: payload,
      requiresAuth: true,
    });
  },

  async changePassword(payload) {
    return await apiRequest('/api/distributor/profile/change-password', {
      method: 'PUT',
      body: payload,
      requiresAuth: true,
    });
  },

  // 2. Beneficiary Management
  async getAssignedBeneficiaries() {
    return await apiRequest('/api/distributor/beneficiaries', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async searchBeneficiary(rationCardNumber) {
    const query = rationCardNumber ? `?rationCardNumber=${encodeURIComponent(rationCardNumber)}` : '';
    return await apiRequest(`/api/distributor/beneficiaries/search${query}`, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getBeneficiaryDetails(id) {
    return await apiRequest(`/api/distributor/beneficiaries/${id}`, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  // 3. Monthly Allocation
  async createAllocation(payload) {
    return await apiRequest('/api/distributor/allocations', {
      method: 'POST',
      body: payload,
      requiresAuth: true,
    });
  },

  async updateAllocation(id, payload) {
    return await apiRequest(`/api/distributor/allocations/${id}`, {
      method: 'PUT',
      body: payload,
      requiresAuth: true,
    });
  },

  async getAllocationHistory(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.month) searchParams.append('month', params.month);
    if (params.year) searchParams.append('year', params.year);
    if (params.rationCardNumber) searchParams.append('rationCardNumber', params.rationCardNumber);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return await apiRequest(`/api/distributor/allocations/history${qs}`, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  // 4. Transactions
  async getTodayTransactions() {
    return await apiRequest('/api/distributor/transactions/today', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getMonthlyTransactions(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.month) searchParams.append('month', params.month);
    if (params.year) searchParams.append('year', params.year);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return await apiRequest(`/api/distributor/transactions/monthly${qs}`, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async searchTransactions(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.rationCardNumber) searchParams.append('rationCardNumber', params.rationCardNumber);
    if (params.beneficiaryId) searchParams.append('beneficiaryId', params.beneficiaryId);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return await apiRequest(`/api/distributor/transactions/search${qs}`, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  // 5. Notifications
  async getNotifications() {
    return await apiRequest('/api/distributor/notifications', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getUnreadNotifications() {
    return await apiRequest('/api/distributor/notifications/unread', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async markNotificationAsRead(id) {
    return await apiRequest(`/api/distributor/notifications/${id}/read`, {
      method: 'PATCH',
      requiresAuth: true,
    });
  },

  async markAllNotificationsAsRead() {
    return await apiRequest('/api/distributor/notifications/read-all', {
      method: 'PATCH',
      requiresAuth: true,
    });
  },

  async sendNotificationToBeneficiaries(payload) {
    return await apiRequest('/api/distributor/notifications/beneficiaries', {
      method: 'POST',
      body: payload,
      requiresAuth: true,
    });
  },
};

export const beneficiaryApi = {
  // 1. Dashboard
  async getDashboardSummary() {
    return await apiRequest('/api/beneficiary/dashboard', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  // 2. Profile
  async getProfile() {
    return await apiRequest('/api/beneficiary/profile', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async updateProfile(payload) {
    return await apiRequest('/api/beneficiary/profile', {
      method: 'PUT',
      body: payload,
      requiresAuth: true,
    });
  },

  async changePassword(payload) {
    return await apiRequest('/api/beneficiary/change-password', {
      method: 'PUT',
      body: payload,
      requiresAuth: true,
    });
  },

  // 3. Allocation
  async getCurrentAllocation() {
    return await apiRequest('/api/beneficiary/allocation/current', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getAllocationHistory() {
    return await apiRequest('/api/beneficiary/allocation/history', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getAllocationDetails(month, year) {
    const query = new URLSearchParams();
    if (month) query.append('month', month);
    if (year) query.append('year', year);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await apiRequest(`/api/beneficiary/allocation/details${qs}`, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  // 4. Transactions
  async getTransactions() {
    return await apiRequest('/api/beneficiary/transactions', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getTodayLatestTransaction() {
    return await apiRequest('/api/beneficiary/transactions/today/latest', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getTransactionDetails(id) {
    return await apiRequest(`/api/beneficiary/transactions/${id}`, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  // 5. Notifications
  async getNotifications() {
    return await apiRequest('/api/beneficiary/notifications', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getUnreadNotifications() {
    return await apiRequest('/api/beneficiary/notifications/unread', {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async markNotificationAsRead(id) {
    return await apiRequest(`/api/beneficiary/notifications/${id}/read`, {
      method: 'PATCH',
      requiresAuth: true,
    });
  },

  async markAllNotificationsAsRead() {
    return await apiRequest('/api/beneficiary/notifications/read-all', {
      method: 'PATCH',
      requiresAuth: true,
    });
  },
};

// Also expose as window global helper if needed by non-module scripts
if (typeof window !== 'undefined') {
  window.RationAuthApi = authApi;
  window.RationAdminApi = adminApi;
  window.RationDistributorApi = distributorApi;
  window.RationBeneficiaryApi = beneficiaryApi;
  window.RationAuthStorage = authStorage;
  window.rationApiRequest = apiRequest;
}
