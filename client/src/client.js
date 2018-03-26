import _ from "underscore";
import EventEmitter from 'eventemitter3';

const flatbuffers = require('exports-loader?flatbuffers!flatbuffers');
const visibio = require('exports-loader?visibio!./visibio_generated.js');

class Client extends EventEmitter {
  constructor(params) {
    super();
    this._params = _.defaults(params, {
      address: 'ws://localhost:8080',
      heartbeatFrequency: 1000, // ms between heartbeats
    });
    // inputs
    this._inputs = {};
    this._inputsProcessor = null;
    // heartbeat
    let builder = new flatbuffers.Builder(8);
    visibio.Heartbeat.startHeartbeat(builder);
    this._heartbeat = message(builder, visibio.Heartbeat.endHeartbeat(builder), visibio.Packet.Heartbeat);
    this._heartbeatLoop = null;
    // status
    this._status = 0; // 0 = not connected, 1 = connected, 2 = playing, 3 = dead
    // reset game state
    this._reset();
  }

  get status() {
    return this.status
  }

  get world() {
    return this._world
  }

  get entities() {
    return this._entities
  }

  get metadata() {
    return this._metadata
  }

  get lifetime() {
    return this._lifetime
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.connected) return reject(new Error("already connected"));
      let ws = this._websocket = new WebSocket(this._params.address);
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        this._status = 1;
        this._heartbeatLoop = setTimeout(() => this._sendHeartbeat(), this._params.heartbeatFrequency);
        resolve()
      };
      ws.onerror = (e) => {
        this._status = 0;
        this.close()
        reject(new Error("error connecting"))
      };
      ws.onmessage = (e) => {
        this._handle(e.data);
      };
      ws.onclose = () => {
        this._status = 0;
        this.emit('disconnected')
        this.close()
      }
    })
  }

  async respawn(name) {
    this._reset()
    let builder = new flatbuffers.Builder(80);
    let n = builder.createString(name);
    visibio.Respawn.startRespawn(builder);
    visibio.Respawn.addName(builder, n);
    return this._send(message(builder, visibio.Respawn.endRespawn(builder), visibio.Packet.Respawn))
  }

  setInputs(inputs) {
    if (!this.connected) return Promise.reject(new Error("cannot set inputs while disconnected"));
    return this._processInputs(inputs); // <- you forgot to pass inputs in :)
  }

  _processInputs(inputs) {
    if (this._inputsProcessor === null) {
      this._inputsProcessor = new Promise(((resolve, reject) => {
        let san = {
          up: false,
          down: false,
          left: false,
          right: false,
          shooting: false,
          rotation: this._inputs.rotation
        };
        if ('up' in inputs) san.up = san.up || inputs.up;
        if ('down' in inputs) san.down = san.down || inputs.down;
        if ('left' in inputs) san.left = san.left || inputs.left;
        if ('right' in inputs) san.right = san.right || inputs.right;
        if ('shooting' in inputs) san.shooting = san.shooting || inputs.shooting;
        if ('rotation' in inputs) san.rotation = inputs.rotation;

        let builder = new flatbuffers.Builder(8);
        visibio.Inputs.startInputs(builder);
        visibio.Inputs.addUp(builder, san.up);
        visibio.Inputs.addDown(builder, san.down);
        visibio.Inputs.addLeft(builder, san.left);
        visibio.Inputs.addRight(builder, san.right);
        visibio.Inputs.addShooting(builder, san.shooting);
        visibio.Inputs.addRotation(builder, san.rotation);
        return this._send(message(builder, visibio.Inputs.endInputs(builder), visibio.Packet.Inputs))
      }))
    } else {
      this._inputsProcessor = this._inputsProcessor.then(() => {
        this._processInputs(inputs)
      })
    }
    return this._inputsProcessor
  }

  close() {
    this._websocket.close();
    clearTimeout(this._heartbeatLoop);
    this._websocket = null;
    this._reset()
  }

  get connected() {
    return this._status > 0 && this._websocket !== null && !(this._websocket.readyState === this._websocket.CLOSED || this._websocket.readyState === this._websocket.CLOSING);
  }

  _reset() {
    this._world = null;
    this._entities = [];
    this._metadata = {};
    this._inputs = {
      up: false,
      down: false,
      left: false,
      right: false,
      shooting: false,
      rotation: 0
    };
    this._lifetime = null;
  }

  async _send(data) {
    if (!this.connected) throw new Error("not connected");
    this._websocket.send(data);
  }

  _sendHeartbeat() {
    this._send(this._heartbeat)
      .then(() => {
        this._heartbeatLoop = setTimeout(() => this._sendHeartbeat(), this._params.heartbeatFrequency)
      })
      .catch(() => {
        this._heartbeatLoop = null;
      })
  }

  _handle(data) {
    let msg = visibio.Message.getRootAsMessage(new flatbuffers.ByteBuffer(new Uint8Array(data)));
    switch (msg.packetType()) {
      case visibio.Packet.World: {
        let world = msg.packet(new visibio.World());
        this._world = {
          terrain: new Terrain(world.mapArray(), world.width(), world.height()),
          id: world.id().toFloat64(),
          entities: [],
          _metadata: {}
        };
        this.emit('spawned');
        break;
      }
      case visibio.Packet.Perception: {
        if (this._world === null) {
          throw new Error("received perception before world")
        }
        let perception = msg.packet(new visibio.Perception());
        this.health = perception.health();
        let entities = this._entities = [];
        let metadata = this._metadata;
        for (let i = 0; i < perception.snapshotsLength(); i++) {
          let snapshot = perception.snapshots(i);
          switch (snapshot.entityType()) {
            case visibio.Entity.Player: {
              let player = snapshot.entity(new visibio.Player());
              let id = player.id().toFloat64();
              entities.push({
                id: id,
                type: visibio.Entity.Player,
                x: player.position().x(),
                y: player.position().y(),
                rotation: player.rotation()
              });
              let name = player.name();
              if (name) {
                metadata[id] = name
              }
              break;
            }
            case visibio.Entity.Bullet: {
              let bullet = snapshot.entity(new visibio.Bullet());
              let id = bullet.id().toFloat64();
              entities.push({
                id: id,
                type: visibio.Entity.Bullet,
                x: bullet.position().x(),
                y: bullet.position().y(),
                vx: bullet.velocity().x(),
                vy: bullet.velocity().y(),
              });
              let ox = bullet.origin().x(),
                oy = bullet.origin().y();
              if (ox || oy) {
                metadata[id] = {ox: ox, oy: oy}
              }
              break;
            }
          }
        }
        this.emit('perception');
        break;
      }
      case visibio.Packet.Death: {
        let death = msg.packet(new visibio.Death());
        this._lifetime = death.alive().toFloat64()
        this.emit('died');
        this._status = 3;
        break;
      }
    }
  }
}

class Terrain {
  constructor(source, width, height) {
    this.source = source;
    this.width = width;
    this.height = height || source.length / width
  }

  width() {
    return this.width;
  }

  height() {
    return this.height;
  }

  get(x, y) {
    return this.source[this.width * x + y];
  }
}

function message(builder, packet, type) {
  visibio.Message.startMessage(builder);
  visibio.Message.addPacketType(builder, type);
  visibio.Message.addPacket(builder, packet);
  let msg = visibio.Message.endMessage(builder);
  builder.finish(msg);
  return builder.asUint8Array()

}

export default Client;
