'use strict';

const DEVICE_ID = 'DEVICE_ID';
const Particle = require('./Particle');
const S3 = require('./S3');
const LWA = require('./LWA');
const axios = require('axios');

exports.handler = async (request, context, callback) => {
  log('DEBUG', `Handler request: ${JSON.stringify(request)}`);
  log('DEBUG', `Handler context: ${JSON.stringify(context)}`);

  let response = {};
  if (request.directive && request.directive.header) {
    response = await handleRequest(request);
  } else if (request.resource === '/AlexaTutorialTrigger'
    && request.httpMethod === 'POST') {
    response = await handleWebhook(request);
  }

  log('DEBUG', `Response: ${JSON.stringify(response)}`);
  callback(null, response);
};

function handleRequest(request) {
  let { namespace, name } = request.directive.header;

  switch (namespace) {
    case 'Alexa.Discovery':
      return handleDiscovery(request);

    case 'Alexa.PowerController':
      return handlePowerControl(request);

    case 'Alexa':
      if (name === 'ReportState') {
        return handleStateReport(request);
      }
      return {};

    case 'Alexa.Authorization':
      if (name === 'AcceptGrant') {
        return handleAcceptGrant(request);
      }
      return {};

    default:
      log('ERROR', `Unknown namespace ${namespace}`);
      return {};
  }
}

async function handleWebhook(request) {
  const reqBody = JSON.parse(request.body);
  const { published_at, event, userid } = reqBody;

  if (event === 'event_btnPress') {
    const tokenData = await S3.getCurrentTokens(userid);
    console.log('button press event');

    if (tokenData.refresh_token && tokenData.access_token) {
      await sendUpdateEvent(tokenData.access_token,
        tokenData.refresh_token, published_at, userid);
    }
  }

  return {
    statusCode: '200',
    isBase64Encoded: false
  };
}


async function sendUpdateEvent(accessToken, refreshToken, publishedAt, userId) {
  try {
    await sendStateUpdateEvent(accessToken, publishedAt);
  } catch (error) {
    if (error.response && error.response.status == '401') {
      const newTokens = await LWA.refreshTokens(refreshToken);
      const newAccessToken = newTokens.access_token;
      const newRefreshToken = newTokens.refresh_token;

      await S3.storeNewTokens(newAccessToken, newRefreshToken, userId);
      await sendStateUpdateEvent(newAccessToken, publishedAt);
    } else {
      console.log('Unkown error');
    }
  }
}

function sendStateUpdateEvent(accessToken, publishedAt) {
  return axios.post('https://api.fe.amazonalexa.com/v3/events', {
    event: {
      header: {
        messageId: 'abc-123-def-456',
        namespace: 'Alexa',
        name: 'ChangeReport',
        payloadVersion: '3'
      },

      endpoint: {
        scope: {
          type: 'BearerToken',
          token: accessToken
        },
        endpointId: 'demo_id'
      },

      context: {},

      payload: {
        change: {
          cause: {
            type: 'PHYSICAL_INTERACTION'
          },
          properties: [
            {
              namespace: 'Alexa.PowerController',
              name: 'powerState',
              value: 'OFF',
              timeOfSample: publishedAt,
              uncertaintyInMilliseconds: 0
            }
          ]
        }
      }
    }
  }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      timeout: 1000
  });
}

function handleDiscovery(request) {
  let header = request.directive.header;
  header.name = 'Discover.Response';

  return {
    event: {
      header: header,
      payload: {
        endpoints: [{
          endpointId: 'demo_id',
          manufacturerName: 'Wonka Chocolate Factory',
          friendlyName: 'Particle Device',
          description: 'Particle Device',
          displayCategories: ['SWITCH'],
          capabilities: [
            {
              type: 'AlexaInterface',
              interface: 'Alexa',
              version: '3'
            },
            {
              interface: 'Alexa.PowerController',
              version: '3',
              type: 'AlexaInterface',
              properties: {
                supported: [{
                  name: 'powerState'
                }],
                retrievable: true,
                proactivelyReported: false
              }
            }
          ]
        }]
      }
    }
  };
}


async function handlePowerControl(request) {
  log('DEBUG', 'Triggered PowerControl');
  const token = getParticleTokenFromRequest(request);

  let stateToSet;
  // Set correct state based on the Alexa directive
  if (request.directive.header.name === 'TurnOn') {
    stateToSet = 'ON';
  } else {
    stateToSet = 'OFF';
  }

  // Set the state on the device, also get the actual state (should be the same)
  const actualState = await Particle.setDeviceState(DEVICE_ID, stateToSet, token);

  let { header, endpoint } = request.directive;
  header.namespace = 'Alexa';
  header.name = 'Response';

  const returnContext = {
    properties: [{
      namespace: 'Alexa.PowerController',
      name: 'powerState',
      value: actualState,
      timeOfSample: (new Date()).toISOString(),
      uncertaintyInMilliseconds: 0
    }]
  };

  const response = {
    context: returnContext,
    event: {
      header: header,
      endpoint: endpoint,
      payload: {}
    }
  };

  log('DEBUG', `Set State: ${JSON.stringify(response)}`);
  return response;
}

async function handleStateReport(request) {
  let { header, endpoint } = request.directive;
  header.name = 'StateReport';

  const token = getParticleTokenFromRequest(request);
  const stateBool = await Particle.getDeviceState(DEVICE_ID, token);

  const returnContext = {
    properties: [{
      namespace: 'Alexa.PowerController',
      name: 'powerState',
      value: stateBool.body.result ? 'ON' : 'OFF',
      timeOfSample: stateBool.body.coreInfo.last_heard,
      uncertaintyInMilliseconds: 0
    }]
  };

  const response = {
    context: returnContext,
    event: {
      header: header,
      endpoint: endpoint,
      payload: {}
    }
  };

  log('DEBUG', `State Response: ${JSON.stringify(response)}`);
  return response;
}

async function handleAcceptGrant(request) {
  const particleToken = request.directive.payload.grantee.token;
  const authCode = request.directive.payload.grant.code;

  log('DEBUG', `Received an AcceptGrant request`);

  let res = await LWA.getTokensWithAuthCode(authCode);
  const { access_token, refresh_token } = res.data;
  const userId = await Particle.getUserId(particleToken);

  const putResult = await S3.storeNewTokens(access_token, refresh_token, userId);
  log('DEBUG', `AcceptGrant S3 Response: ${JSON.stringify(putResult)}`);

  const header = request.directive.header;
  header.name = 'AcceptGrant.Response';
  const response = {
    event: {
      header: header,
      payload: {}
    }
  };

  return response;
}

function getParticleTokenFromRequest(request) {
  // request.directive.endpoint.scope.token OR request.directive.payload.scope.token
  const tokenData = (request || {}).directive || {};
  return ((tokenData.endpoint || tokenData.payload || {}).scope || {}).token;
}

function log(type, value) {
  console.log(`${type}: ${value}`);
}