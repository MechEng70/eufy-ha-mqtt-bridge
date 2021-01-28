const { HttpService } = require('eufy-node-client')
const { LocalLookupService, DeviceClientService, CommandType } = require('eufy-node-client');
const winston = require('winston')
const get = require('get-value')
const DB = require('../db')
const { supportedDevices } = require('../enums/device_type')

class EufyHttp {
  constructor (username, password) {
    this.httpService = new HttpService(username, password)
  }

  deviceListUpToDate () {
    if (!this.devicesRefreshedAt) {
      return false
    }

    const now = new Date().getTime()
    return (now - this.devicesRefreshedAt) < (15 * 60 * 1000)
  }

  async getDevices () {
    if (this.devices && this.deviceListUpToDate()) {
      return this.devices
    }

    winston.debug('Refreshing devices...')

    this.devices = await this.httpService.listDevices()
    this.devicesRefreshedAt = new Date().getTime()
    winston.silly(`Device list: `, this.devices)

    return this.devices
  }

  async refreshStoredDevices () {
    const devices = await this.getDevices()
    for (let device of devices) {
      await DB.createOrUpdateDevice(device)
      const deviceType = get(device, 'device_model', { default: null })

      winston.info(`Stored device: ${device.device_name} (${device.device_sn} - type: ${deviceType})`)

      if (!supportedDevices.includes(deviceType)) {
        winston.warn(`DEVICE ${device.device_name} NOT SUPPORTED! See: https://github.com/matijse/eufy-ha-mqtt-bridge/issues/7`)
      }
    }
  }

  async registerPushToken (fcmToken) {
    const response = await this.httpService.registerPushToken(fcmToken);
    winston.info(`Registered Push Token`, { response })
  }

  async checkPushToken () {
    const response = await this.httpService.pushTokenCheck()
    winston.info(`Checked Push Token`, { response })
  }

  async setArmingMode () {
    const lookupService = new LocalLookupService();
    const address = await lookupService.lookup('192.168.1.1');
    console.log('Found address', address);

    const devClientService = new DeviceClientService(address, P2P_DID, ACTOR_ID);
    await devClientService.connect();
    console.log('Connected!');

    // CMD_SET_ARMING  # 0 => away 1 => home, 2 => schedule, 63 => disarmed
    devClientService.sendCommandWithInt(CommandType.CMD_SET_ARMING, 1);
    console.log('Sended command...');
  }
}

module.exports = EufyHttp
