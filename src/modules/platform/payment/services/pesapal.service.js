// src/modules/platform/payment/services/pesapal.service.js

import axios from 'axios';

// ========================
// Configuration
// ========================

const getBaseUrl = (environment) => {
  return environment === 'SANDBOX'
    ? 'https://cybqa.pesapal.com/pesapalv3'
    : 'https://pay.pesapal.com/v3';
};

// ========================
// Authentication
// ========================

class PesapalAuthService {
  constructor(environment, consumerKey, consumerSecret) {
    this.environment = environment;
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
    this.tokenCache = null;
  }

  async getAccessToken() {
    // Check cache — refresh if token expires in < 60 seconds
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60000) {
      return this.tokenCache.token;
    }

    const url = `${getBaseUrl(this.environment)}/api/Auth/RequestToken`;

    try {
      const response = await axios.post(
        url,
        {
          consumer_key: this.consumerKey,
          consumer_secret: this.consumerSecret,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      this.tokenCache = {
        token: response.data.token,
        expiresAt: new Date(response.data.expiryDate).getTime() - 60000,
      };

      return this.tokenCache.token;
    } catch (error) {
      console.error('Pesapal auth error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Pesapal');
    }
  }

  async request(method, endpoint, data = null) {
    const token = await this.getAccessToken();
    const url = `${getBaseUrl(this.environment)}${endpoint}`;

    const config = {
      method,
      url,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };

    if (data && method === 'POST') {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`Pesapal API error (${endpoint}):`, error.response?.data || error.message);
      throw error;
    }
  }
}

// ========================
// Payment Operations
// ========================

const registerIPN = async (authService, url, notificationType = 'POST') => {
  return authService.request('POST', '/api/URLSetup/RegisterIPN', {
    url,
    ipn_notification_type: notificationType,
  });
};

const getIPNList = async (authService) => {
  return authService.request('GET', '/api/URLSetup/GetIpnList');
};

const submitOrder = async (authService, orderData) => {
  return authService.request('POST', '/api/Transactions/SubmitOrderRequest', orderData);
};

const getTransactionStatus = async (authService, orderTrackingId) => {
  return authService.request(
    'GET',
    `/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`
  );
};

const requestRefund = async (authService, refundData) => {
  return authService.request('POST', '/api/Transactions/RefundRequest', refundData);
};

export default {
  PesapalAuthService,
  registerIPN,
  getIPNList,
  submitOrder,
  getTransactionStatus,
  requestRefund,
};