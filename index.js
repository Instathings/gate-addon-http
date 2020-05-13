const _ = require('lodash');
const debug = require('debug')('gate-addon-http');
const EventEmitter = require('events');
const mqtt = require('mqtt');
const async = require('async');
const findDevices = require('./findDevices');

class GateAddOnHTTP extends EventEmitter {
  constructor(id, type, allDevices, options = {}) {
    /**
     * options : {
     *    ip_address
     *  }
     */
    super();
    this.id = id;
    this.data = {};
    const http = type.protocols[0];
    this.knownDevices = allDevices[http] || [];
    this.deviceType = type;
    this.client = mqtt.connect('mqtt://eclipse-mosquitto', {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
    });
    this.options = options;
  }

  setKnownDevices(knownDevices) {
    this.knownDevices = knownDevices;
  }

  subscribe(callback) {
    return this.client.subscribe('http2mqtt/bridge/log', (err) => {
      if (err) {
        return callback(err);
      }
      return callback();
    });
  }

  init() {
    this.on('internalNewDeviceTimeout', () => {
      const payload = {
        status: {
          eventType: 'not_paired',
        },
        deviceId: this.id,
      };
      this.emit('timeoutDiscovering', payload);
    });

    this.on('internalNewDevice', (newDevice) => {
      this.client.removeAllListeners('message');
      this.client.unsubscribe('http2mqtt/bridge/log');
      this.emit('newDevice', newDevice);
      this.start(newDevice);
    });

    this.client.on('connect', () => {
      debug('Connected');
      async.waterfall([
        this.subscribe.bind(this),
        findDevices.bind(this),
      ]);
    });
  }

  start(device) {
    const { ieeeAddr } = device;
    const topic = `http2mqtt/${ieeeAddr}`;
    this.client.on('message', (topic, message) => {
      const parsed = JSON.parse(message.toString());
      this.emit('data', parsed);
    });
    if (this.deviceType.type === 'sensor') {
      this.client.subscribe(topic);
    }
  }

  stop() { }

  control(message, action) {
    const httpDevice = this.knownDevices.find((httpDeviceFilter) => httpDeviceFilter.id === this.id);
    const friendlyName = _.get(httpDevice, 'ieeeAddr');
    const topic = `http2mqtt/${friendlyName}/${action}`;

    if (action === 'get') {
      const responseTopic = `http2mqtt/${friendlyName}`;
      this.client.once('message', (topic, responseMessage) => {
        const parsed = JSON.parse(responseMessage.toString());
        this.client.unsubscribe(responseTopic, (err) => { });
        const response = {
          payload: parsed,
          requestId: message.requestId,
          deviceId: message.deviceId,
          projectId: process.env.PROJECT_ID,
        };
        this.emit('status', response);
      });
      this.client.subscribe(responseTopic, (err) => { });
    }
    this.client.publish(topic, JSON.stringify(message));
  }

  remove() {
    const device = this.knownDevices.find((modbusDevice) => modbusDevice.id === this.id);
    const friendlyName = _.get(device, 'ieeeAddr');

    this.subscribe((err) => {
      this.client.on('message', (topic, message) => {
        if (topic !== 'http2mqtt/bridge/log') {
          return;
        }
        const logMessage = JSON.parse(message.toString());
        const messageType = logMessage.type;
        if (messageType !== 'device_force_removed') {
          return;
        }
        const friendlyNameRemoved = logMessage.message;
        if (friendlyNameRemoved === friendlyName) {
          this.emit('deviceRemoved', this.id);
          this.removeAllListeners();
          this.client.end();
        }
      });
    });
    const topic = 'http2mqtt/bridge/config/force_remove';
    this.client.publish(topic, friendlyName);
  }
}

module.exports = GateAddOnHTTP;
