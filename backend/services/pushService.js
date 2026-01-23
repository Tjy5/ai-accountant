'use strict';

const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendExpoPushNotifications(messages, options = {}) {
  const list = Array.isArray(messages) ? messages : [];
  if (list.length === 0) return { data: [], errors: [] };

  const accessToken = options.accessToken || process.env.EXPO_ACCESS_TOKEN;
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const resp = await axios.post(EXPO_PUSH_URL, list, {
    headers,
    timeout: 10000,
    validateStatus: (s) => s >= 200 && s < 500
  });

  if (resp.status >= 400) {
    const err = new Error('Expo push request failed');
    err.status = 502;
    err.details = resp.data;
    throw err;
  }

  return resp.data;
}

module.exports = {
  sendExpoPushNotifications
};
