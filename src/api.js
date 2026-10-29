import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// API Configuration
// Automatically detects platform and uses appropriate URL
const getApiBaseUrl = () => {
  if (__DEV__) {
    // Development mode
    if (Platform.OS === 'android') {
      // Using your computer's actual IP address that backend is running on
      // Backend shows: Running on http://192.168.25.205:5000
      return 'https://matchmytone.onrender.com/api';

      // If above doesn't work, try Android emulator standard IP:
      // return 'http://10.0.2.2:5000/api';
    } else if (Platform.OS === 'ios') {
      // iOS simulator can use localhost
      return 'http://localhost:5000/api';
    } else {
      // Web or other platforms
      return 'https://matchmytone.onrender.com/api';
    }
  } else {
    // Production mode
    return 'https://matchmytone.onrender.com/api';  // Update this with your production URL
  }
};

const API_BASE_URL = getApiBaseUrl();

// Log API URL for debugging
console.log('API Base URL:', API_BASE_URL);
console.log('Platform:', Platform.OS);

// Get stored token
const getToken = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    return token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

// Store token
const setToken = async (token) => {
  try {
    await AsyncStorage.setItem('authToken', token);
  } catch (error) {
    console.error('Error storing token:', error);
  }
};

// Remove token
const removeToken = async () => {
  try {
    await AsyncStorage.removeItem('authToken');
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

// Backend warm-up to handle Render cold starts
let isBackendWarmedUp = false;
const warmUpBackend = async () => {
  if (isBackendWarmedUp) return;
  try {
    console.log('[WARMUP] Waking up backend (Render cold start)...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for cold start
    await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    isBackendWarmedUp = true;
    console.log('[WARMUP] Backend is awake!');
  } catch (e) {
    console.warn('[WARMUP] Warm-up ping failed:', e.message);
    // Still proceed — the actual request might work
  }
};

// Make API request with authentication
// extra: { timeoutMs?: number } — default 15000; use longer for slow endpoints (e.g. email send)
const makeRequest = async (endpoint, method = 'GET', data = null, requiresAuth = true, extra = {}) => {
  const timeoutMs = typeof extra.timeoutMs === 'number' ? extra.timeoutMs : 15000;
  try {
    // Wake up backend if this is the first request (handles Render cold starts)
    await warmUpBackend();

    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`Making ${method} request to: ${url}`);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    };

    if (requiresAuth) {
      const token = await getToken();
      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }
    }

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
      console.log('Request body:', JSON.stringify(data, null, 2));
    }

    console.log('Sending request...');
    console.log('Request URL:', url);

    let response;
    try {
      response = await Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Request timeout after ${Math.round(timeoutMs / 1000)} seconds`)),
            timeoutMs
          )
        )
      ]);
      clearTimeout(timeoutId); // Clear timeout if request completes
      console.log(`Response status: ${response.status} ${response.statusText}`);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('Fetch error:', fetchError);
      if (fetchError.message.includes('timeout')) {
        throw new Error('Request timed out. The server may be starting up — please try again in a few seconds.');
      }
      throw fetchError;
    }

    // Handle non-JSON responses
    let result;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        const responseText = await response.text();
        console.log('Raw response text:', responseText);
        result = JSON.parse(responseText);
        console.log('Parsed response data:', JSON.stringify(result, null, 2));
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid JSON response from server');
      }
    } else {
      const text = await response.text();
      console.error('Non-JSON response:', text);
      throw new Error(text || 'Request failed');
    }

    if (!response.ok) {
      // Try to extract error message from response
      let errorMsg = result?.error || result?.message || result?.msg || `Request failed with status ${response.status}`;

      // Handle specific HTTP status codes
      if (response.status === 401) {
        errorMsg = result?.error || result?.message || result?.msg || 'Invalid credentials. Please check your username and password.';
        // Use console.log for expected authentication errors to avoid LogBox
        console.log('Authentication failed:', errorMsg);
      } else if (response.status === 404) {
        errorMsg = result?.error || result?.message || result?.msg || 'Resource not found.';
        console.log('Resource not found:', errorMsg);
      } else if (response.status === 500) {
        errorMsg = result?.error || result?.message || result?.msg || 'Server error. Please try again later.';
        console.error('Server error:', errorMsg);
      } else if (response.status >= 500) {
        // Only use console.error for server errors
        console.error('Request failed:', errorMsg);
        console.error('Response status:', response.status);
        console.error('Response data:', result);
      } else {
        // Use console.warn for client errors (400, 409, etc.) — expected validation errors
        console.warn('Request failed:', errorMsg);
      }
      throw new Error(errorMsg);
    }

    console.log('Request successful, returning result');
    return result;
  } catch (error) {
    // Use console.warn for all caught errors to avoid LogBox red popups
    console.warn('API Request Error:', error?.message || error);

    // If error already has a message from server, use it
    if (error.message && !error.message.includes('AbortError') && !error.message.includes('Network request failed') && !error.message.includes('Failed to fetch')) {
      throw error; // Re-throw server error messages as-is
    }

    // Provide more helpful error messages for network issues
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your network connection and try again.');
    }
    if (error.message.includes('Network request failed') || error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Please make sure the backend is running and check your network connection.');
    }
    throw error;
  }
};

// ==================== AUTHENTICATION API ====================

export const authAPI = {
  // Register new user
  register: async (userData) => {
    try {
      console.log('Register API call with data:', { ...userData, password: '***' });
      const response = await makeRequest('/auth/register', 'POST', userData, false);
      console.log('Register API response received:', JSON.stringify(response, null, 2));
      // No token is returned during registration — user must verify email first
      return response;
    } catch (error) {
      console.warn('Register API error:', error?.message || error);
      throw error;
    }
  },

  // Resend verification email link
  resendVerification: async (email) => {
    try {
      console.log('Resend verification for:', email);
      const response = await makeRequest('/auth/resend-verification', 'POST', { email }, false);
      return response;
    } catch (error) {
      console.warn('Resend verification error:', error?.message || error);
      throw error;
    }
  },

  // Reset password (forgot password) — username + new password
  resetPassword: async (name, password) => {
    try {
      const response = await makeRequest('/auth/reset-password', 'POST', { name, password }, false);
      return response;
    } catch (error) {
      console.warn('Reset password error:', error?.message || error);
      throw error;
    }
  },

  // Login user
  login: async (name, password) => {
    try {
      console.log('Login API call with username:', name);
      const response = await makeRequest('/auth/login', 'POST', { name, password }, false);
      console.log('Login API response received:', JSON.stringify(response, null, 2));

      if (response) {
        const user = response.user || response;
        if (user) {
          if (user.token || response.token) {
            const token = user.token || response.token;
            await setToken(token);
            console.log('Token stored successfully');
          } else {
            console.warn('No token in response');
          }
          // Store user data
          await AsyncStorage.setItem('currentUser', JSON.stringify(user));
          console.log('User data stored successfully');
        } else {
          console.warn('No user data in response:', response);
        }
      } else {
        console.warn('Empty response received');
      }
      return response;
    } catch (error) {
      // Use console.warn to avoid LogBox red popup for expected auth errors
      console.warn('Login API error:', error?.message || error);
      throw error;
    }
  },

  // Logout user
  logout: async () => {
    try {
      await removeToken();
      await AsyncStorage.removeItem('currentUser');
    } catch (error) {
      console.error('Logout error:', error);
    }
  },
};

// ==================== PROFILE API ====================

export const profileAPI = {
  // Get user profile
  getProfile: async () => {
    try {
      const response = await makeRequest('/users/profile', 'GET');
      // Update stored user data
      if (response.user) {
        await AsyncStorage.setItem('currentUser', JSON.stringify(response.user));
      }
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Update user profile
  updateProfile: async (profileData) => {
    try {
      const response = await makeRequest('/users/profile', 'PUT', profileData);
      // Update stored user data
      if (response.user) {
        await AsyncStorage.setItem('currentUser', JSON.stringify(response.user));
      }
      return response;
    } catch (error) {
      throw error;
    }
  },
};

// ==================== QUIZ RESULTS API ====================

export const quizAPI = {
  // Save skincare analysis result
  saveSkincareResult: async (answers, result) => {
    try {
      const response = await makeRequest('/quiz/skincare', 'POST', {
        answers,
        result,
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Save body shape analysis result
  saveBodyShapeResult: async (answers, result) => {
    try {
      const response = await makeRequest('/quiz/body-shape', 'POST', {
        answers,
        result,
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Save face shape analysis result
  saveFaceShapeResult: async (answers, result) => {
    try {
      const response = await makeRequest('/quiz/face-shape', 'POST', {
        answers,
        result,
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get all quiz results
  getAllResults: async () => {
    try {
      const response = await makeRequest('/quiz/results', 'GET');
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get specific quiz result
  getQuizResult: async (quizType) => {
    try {
      const response = await makeRequest(`/quiz/${quizType}`, 'GET');
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Save color analysis result
  saveColorAnalysisResult: async (resultData) => {
    try {
      const response = await makeRequest('/quiz/color-analysis', 'POST', resultData);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get a specific color analysis result by ID
  getColorAnalysisById: async (resultId) => {
    try {
      const response = await makeRequest(`/quiz/color-analysis/${resultId}`, 'GET');
      return response;
    } catch (error) {
      throw error;
    }
  },

  /** Sends HTML color analysis email From MatchMyTone (Resend). To = logged-in user's registered email. */
  shareColorAnalysisByEmail: async (payload) => {
    try {
      return await makeRequest('/email/share-color-analysis', 'POST', payload, true, {
        timeoutMs: 45000,
      });
    } catch (error) {
      throw error;
    }
  },
};

// Export default API object
export default {
  auth: authAPI,
  profile: profileAPI,
  quiz: quizAPI,
};

