import Source from './map.js';
import EventEmitter from 'eventemitter3';
import _ from 'underscore';

const flatbuffers = require('exports-loader?flatbuffers!flatbuffers');
const visibio = require('exports-loader?visibio!../src/visibio_generated.js');

class Connection extends EventEmitter {
  constructor(address) {
    super();
    this.connected = false;
    this.address = address;
    this._websocket = null;
    this.sendInputsThrottled = _.throttle((inputs) => {
      let builder = new flatbuffers.Builder(8);
      visibio.Inputs.startInputs(builder);
      visibio.Inputs.addLeft(builder, inputs.left);
      visibio.Inputs.addRight(builder, inputs.right);
      visibio.Inputs.addDown(builder, inputs.down);
      visibio.Inputs.addUp(builder, inputs.up);
      visibio.Inputs.addRotation(builder, inputs.rotation);
      visibio.Inputs.addShooting(builder, inputs.shooting);
      this._websocket.send(message(builder, visibio.Inputs.endInputs(builder), visibio.Packet.Inputs))
    }, 5, {leading: false});
    let builder = new flatbuffers.Builder(8);
    visibio.Heartbeat.startHeartbeat(builder);
    this._heartbeat = message(builder, visibio.Heartbeat.endHeartbeat(builder), visibio.Packet.Heartbeat)
  }

  async sendRespawn(name) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) return reject(new Error("tried to respawn while not connected"));
      let builder = new flatbuffers.Builder(128);
      name = name || "unknown";
      let n = builder.createString(name);
      visibio.Respawn.startRespawn(builder);
      visibio.Respawn.addName(builder, n);
      this._websocket.send(message(builder, visibio.Respawn.endRespawn(builder), visibio.Packet.Respawn));
      resolve();
    })
  }

  async sendInputs(inputs) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) return reject(new Error("tried to _send _inputs while not connected"));
      this.sendInputsThrottled(inputs);
      resolve()
    })
  }

  sendHeartbeat() {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) return reject(new Error("tried to _send _heartbeat while not connected"));
      this.send(this._heartbeat);
    })
  }

  async send(data) {
    return new Promise((resolve) => {
      this._websocket.send(data)
      resolve()
    })
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this._websocket = new WebSocket(this.address);
      this._websocket.binaryType = 'arraybuffer';
      this._websocket.onopen = () => {
        this.connected = true;
        this._heartbeatLoop = setInterval(() => this.sendHeartbeat(), 1000);
        resolve()
      };
      this._websocket.onerror = () => {
        this.connected = false;
        reject(new Error("error connecting"))
      };
      this._websocket.onclose = () => {
        this.connected = false;
        clearInterval(this._heartbeatLoop)
      };
      this._websocket.onmessage = (event) => {
        this.__handle(event.data)
      }
    })
  }

  isConnected() {
    return this._websocket !== null && this.connected;
  }

  __handle(data) {
    let msg = visibio.Message.getRootAsMessage(new flatbuffers.ByteBuffer(data));
    switch (msg.packetType()) {
      case visibio.Packet.World: {
        let world = msg.packet(new visibio.World());
        this.emit('_world',
          world.id().toFloat64(),
          new Source(world.mapArray(), world.width(), world.height())
        );
        break;
      }
      case visibio.Packet.Perception: {
        let perception = msg.packet(new visibio.Perception());
        let health = perception.health();
        let entities = [];
        let metadata = {};
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
        this.emit('_perception',
          {
            health: health,
            entities: entities,
            _metadata: metadata
          }
        );
        break;
      }
      case visibio.Packet.Death: {
        this.emit('death');
        break;
      }
    }
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

export default Connection;