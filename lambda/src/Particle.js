const Particle = require('particle-api-js');
const particle = new Particle();

module.exports = {
  setDeviceState(deviceId, state, token) {
    return particle.callFunction({
      deviceId: deviceId,
      name: 'setLed',
      argument: state,
      auth: token

    }).then((result) => {
      return result.body.return_value === 1 ? 'ON' : 'OFF';

    }).catch((error) => {
      return null;
    });
  },

  async getUserId(token) {
    const info = await particle.trackingIdentity( {auth: token, full: true });
    return info.body.id;
  },

  getDeviceState(deviceId, token) {
    return particle.getVariable({ deviceId: deviceId, name: 'isLedOn', auth: token });
  }
};