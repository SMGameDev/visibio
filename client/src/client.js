import _ from "underscore";
import EventEmitter from 'eventemitter3';
import Queue from 'queuejs';

const flatbuffers = require('exports-loader?flatbuffers!flatbuffers');
const visibio = require('exports-loader?visibio!./visibio_generated.js');

class Client extends EventEmitter {
  constructor(params) {
    super();
    this._params = _.defaults(params, {
      address: 'ws://localhost:8080',
      inputFrequency: 10, // ms between inputs sent (if they have changed)
      heartbeatFrequency: 1000, // ms between heartbeats
    });
    // _inputs
    this._inputsQueue = new Queue();
    this._inputs = {};
    // _heartbeat
    let builder = new flatbuffers.Builder(8);
    visibio.Heartbeat.startHeartbeat(builder);
    this._heartbeat = message(builder, visibio.Heartbeat.endHeartbeat(builder), visibio.Packet.Heartbeat);
    this._heartbeatLoop = null;
    // game _perception
    this._status = 0; // 0 = not connected, 1 = connected, 2 = playing, 3 = dead
    // _reset game _perception
    this._reset();
  }

  get status() {
    return this.status
  }

  get world() {
    return this._world
  }

  get perception() {
    return this._perception
  }

  get metadata() {
    return this._metadata
  }

  get lifetime() {
    return this._lifetime
  }


  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected()) {
        return reject(new Error("already connected"))
      }
      let ws = this._websocket = new WebSocket(this._params.address);
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        this._status = 1;
        this._heartbeatLoop = setInterval(() => this._sendHeartbeat(), this._params._heartbeatLoop);
        this._sendInputs();
        resolve()
      };
      ws.onerror = (e) => {
        this._status = 0;
        reject(new Error("error connecting"))
      };
      ws.onmessage = (e) => {
        this._handle(e.data);
      };
      ws.onclose = () => {
        this._status = 0;
        this.emit('disconnected')
      }
    })
  }

  async respawn(name) {
    let builder = new flatbuffers.Builder(80);
    let n = builder.createString(name);
    visibio.Respawn.startRespawn(builder);
    visibio.Respawn.addName(builder, n);
    return this._send(message(builder, visibio.Respawn.endRespawn(builder), visibio.Packet.Respawn))
  }

  // * _getStatesGenerator() {
  //   yield this._world;
  //   while (this._status === 2) {
  //     if (this.states.length > 0) {
  //       yield this.states.shift()
  //     } else {
  //       yield this._perception;
  //     }
  //   }
  //   if (this._status === 3) {
  //     return this.lifetime
  //   }
  // }

  setInputs({up, down, left, right, shooting, rotation}) {
    this._inputsQueue.enq({up: up, down: down, left: left, right: right, shooting: shooting, rotation: rotation})
  }

  close() {
    this._websocket.close();
    clearTimeout(this._inputLoop);
    clearTimeout(this._heartbeatLoop);
    this._websocket = null;
    this.connected = false;
    this._reset()
  }

  isConnected() {
    return this._status > 0 && this._websocket !== null && !(this._websocket.readyState === this._websocket.CLOSED || this._websocket.readyState === this._websocket.CLOSING);
  }

  _reset() {
    this._world = null;
    this._perception = null;
    this._metadata = null;
    this._inputs = {
      up: false,
      down: false,
      left: false,
      right: false,
      shooting: false,
      rotation: 0
    }
    this._lifetime = null;
  }

  async _send(data) {
    if (!this.isConnected()) throw new Error("not connected");
    this._websocket.send(data);
  }

  _sendHeartbeat() {
    this._send(this._heartbeat)
      .then(() => {
        this._heartbeatLoop = setTimeout(() => this._sendHeartbeat(),)
      })
      .catch(() => {
        this._heartbeatLoop = null;
      })
  }

  _sendInputs() {
    // console.log(this._lastSentInputs, this._inputs, _.isMatch(this._lastSentInputs, this._inputs));
    // if (_.isMatch(this._lastSentInputs, this._inputs)) {
    //   return this._inputLoop = setTimeout(() => this._sendInputs(), this._params.inputFrequency);
    // }
    let inputs = {
      up: false,
      down: false,
      left: false,
      right: false,
      shooting: false,
      rotation: 0
    };
    while (true) {
      if (this._inputsQueue.isEmpty()) break;
      let val = this._inputsQueue.deq();
      inputs.up = inputs.up || !!val.up;
      inputs.down = inputs.down || !!val.down;
      inputs.left = inputs.left || !!val.left;
      inputs.right = inputs.right || !!val.right;
      inputs.shooting = inputs.shooting || !!val.shooting;
      inputs.rotation = 'rotation' in val ? val.rotation : inputs.rotation;
    }
    console.log(inputs, this._inputs, _.isMatch(inputs, this._inputs));
    if (_.isMatch(inputs, this._inputs)) {
      this._inputLoop = setTimeout(() => this._sendInputs(), this._params.inputFrequency)
      return
    }

    let builder = new flatbuffers.Builder(8);
    visibio.Inputs.startInputs(builder);
    visibio.Inputs.addLeft(builder, this._inputs.left);
    visibio.Inputs.addRight(builder, this._inputs.right);
    visibio.Inputs.addDown(builder, this._inputs.down);
    visibio.Inputs.addUp(builder, this._inputs.up);
    visibio.Inputs.addRotation(builder, this._inputs.rotation);
    visibio.Inputs.addShooting(builder, this._inputs.shooting);
    this._send(message(builder, visibio.Inputs.endInputs(builder), visibio.Packet.Inputs))
      .then(() => {
        this._inputs = inputs;
        this._inputLoop = setTimeout(() => this._sendInputs(), this._params.inputFrequency)
      })
      .catch(() => {
        this._inputLoop = null;
      })

  }

  _handle(data) {
    let msg = visibio.Message.getRootAsMessage(new flatbuffers.ByteBuffer(data));
    switch (msg.packetType()) {
      case visibio.Packet.World: {
        console.log('handling _world packet');
        let world = msg.packet(new visibio.World());
        this._world = {
          terrain: new Source(world.mapArray(), world.width(), world.height()),
          id: world.id().toFloat64(),
          entities: [],
          _metadata: {}
        };
        this.emit('spawned');
        break;
      }
      case visibio.Packet.Perception: {
        if (this._perception === null) {
          throw new Error("received _perception before _world")
        }
        let perception = msg.packet(new visibio.Perception());
        this.health = perception.health();
        let entities = this._perception.entities = [];
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