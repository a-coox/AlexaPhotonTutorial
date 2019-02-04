const axios = require('axios');
const querystring = require('querystring');

const ALEXA_CLIENT_ID = 'YOUR_CLIENT_ID';
const ALEXA_CLIENT_SECRET = 'YOUR_CLIENT_SECRET';

module.exports = {
  async refreshTokens(refreshToken) {
    const body = querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: ALEXA_CLIENT_ID,
      client_secret: ALEXA_CLIENT_SECRET
    });

    const axiosRes = await this.amazonTokenPost(body);
    return axiosRes.data;
  },

  getTokensWithAuthCode(authCode) {
    const body = querystring.stringify({
      grant_type: 'authorization_code',
      code: authCode,
      client_id: ALEXA_CLIENT_ID,
      client_secret: ALEXA_CLIENT_SECRET
    });

    return this.amazonTokenPost(body);
  },

  amazonTokenPost(body) {
    return axios.post('https://api.amazon.com/auth/o2/token', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      timeout: 1000
    });
  }
};