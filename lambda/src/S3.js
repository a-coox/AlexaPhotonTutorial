const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const BUCKET_NAME = 'alexaparticletutorial';

module.exports = {
  async getCurrentTokens(id) {
    const data = await this.s3GetAsync({
      Key: id,
      Bucket: BUCKET_NAME,
      ResponseContentType: 'text/plain'
    });
    return JSON.parse(data.Body.toString('utf-8'));
  },

  storeNewTokens(accessToken, refreshToken, id) {
    if (!accessToken || !refreshToken) {
      return;
    }

    return this.s3PutAsync({
      Key: id,
      Body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
      Bucket: BUCKET_NAME
    });
  },

  s3PutAsync(data) {
    return new Promise((resolve, reject) => {
      s3.putObject(data, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  },

  s3GetAsync(data) {
    return new Promise((resolve, reject) => {
      s3.getObject(data, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
};