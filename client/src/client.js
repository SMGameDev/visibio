import _ from "underscore";

const flatbuffers = require('exports-loader?flatbuffers!flatbuffers');
const visibio = require('exports-loader?visibio!./visibio_generated.js');

class Client {
  constructor(params) {
    this.params = _.defaults(params, {
      address: 'ws://localhost:8080',
      inputFrequency: 10, // ms between inputs sent
      heartbeatFrequency: 1000, // ms between heartbeats
    });
    // inputs
    this.lastSentInputs = null;
    this.inputs = {};
    // heartbeat
    let builder = new flatbuffers.Builder(8);
    visibio.Heartbeat.startHeartbeat(builder);
    this.heartbeat = Client._message(builder, visibio.Heartbeat.endHeartbeat(builder), visibio.Packet.Heartbeat);
    this.heartbeatLoop = null;
    // game state
    this.status = 0; // 0 = not connected, 1 = connected, 2 = playing, 3 = dead
    // _reset game state
    this._reset();
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.status !== 0) {
        return reject(new Error("already connected"))
      }
      let ws = this.websocket = new WebSocket(this.params.address);
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        this.status = 1;
        this.heartbeatLoop = setInterval(() => this._sendHeartbeat(), this.params.heartbeatLoop);
        this._sendInputs();
        resolve()
      };
      ws.onerror = (e) => {
        this.status = 0;
        this.err = new Error("error connecting");
        reject(this.err)
      };
      ws.onmessage = (e) => {
        this._handle(e.data);
      };
      ws.onclose = () => {
        this.status = 0;
      }
    })
  }

  respawn(name) {
    return new Promise((resolve, reject) => {
      let builder = new flatbuffers.Builder(80);
      let n = builder.createString(name);
      visibio.Respawn.startRespawn(builder);
      visibio.Respawn.addName(builder, n);
      this._send(Client._message(builder, visibio.Respawn.endRespawn(builder), visibio.Packet.Respawn))
        .then(() => {

        })
        .catch(reject)
      this._spawncb = () => {
        resolve(this._getStatesGenerator);
        this._spawncb = undefined
      };
    })
  }

  * _getStatesGenerator() {
    yield this.world;
    while (this.status === 2) {
      if (this.states.length > 0) {
        yield this.states.shift()
      } else {
        yield this.state;
      }
    }
    if (this.status === 3) {
      return this.lifetime
    }
  }

  sendInputs(up, down, left, right, shooting, rotation) {
    this.inputs.up = this.inputs.up || up;
    this.inputs.down = this.inputs.down || down;
    this.inputs.left = this.inputs.left || left;
    this.inputs.right = this.inputs.right || right;
    this.inputs.shooting = this.inputs.shooting || shooting;
    this.inputs.rotation = this.inputs.rotation || rotation;
  }

  close() {
    this.websocket.close();
    clearTimeout(this.inputLoop);
    clearTimeout(this.heartbeatLoop);
    this.websocket = null;
    this.connected = false;
    this._reset()
  }

  isConnected() {
    return this.websocket !== null && !(this.websocket.readyState === this.websocket.CLOSED || this.websocket.readyState === this.websocket.CLOSING) && this.status > 0;
  }

  _reset() {
    this.lifetime = null;
    this.world = null;
    this.state = null;
    this.states = [];
    this.inputs = {
      up: false,
      down: false,
      left: false,
      right: false,
      shooting: false,
      rotation: 0
    }
  }

  static _message(builder, packet, type) {
    visibio.Message.startMessage(builder);
    visibio.Message.addPacketType(builder, type);
    visibio.Message.addPacket(builder, packet);
    let msg = visibio.Message.endMessage(builder);
    builder.finish(msg);
    return builder.asUint8Array()
  }

  async _send(data) {
    if (!this.isConnected()) throw new Error("not connected");
    this.websocket.send(data);
    if (this.err != null) {
      throw this.err;
    }
  }

  _sendHeartbeat() {
    this._send(this.heartbeat)
      .then(() => {
        this.heartbeatLoop = setTimeout(() => this._sendHeartbeat(),)
      })
      .catch(() => {
        this.heartbeatLoop = null;
      })
  }

  _sendInputs() {
    let inputs = this.inputs;
    if (_.isMatch(inputs, this.lastSentInputs)) return this.inputLoop = setTimeout(() => this._sendInputs(), this.params.inputFrequency);
    let builder = new flatbuffers.Builder(8);
    visibio.Inputs.startInputs(builder);
    visibio.Inputs.addLeft(builder, inputs.left);
    visibio.Inputs.addRight(builder, inputs.right);
    visibio.Inputs.addDown(builder, inputs.down);
    visibio.Inputs.addUp(builder, inputs.up);
    visibio.Inputs.addRotation(builder, inputs.rotation);
    visibio.Inputs.addShooting(builder, inputs.shooting);
    this._send(Client._message(builder, visibio.Inputs.endInputs(builder), visibio.Packet.Inputs))
      .then(() => {
        this.lastSentInputs = inputs;
        this.inputLoop = setTimeout(() => this._sendInputs(), this.params.inputFrequency)
      })
      .catch(() => {
        this.inputLoop = null;
      })
  }

  _handle(data) {
    let msg = visibio.Message.getRootAsMessage(new flatbuffers.ByteBuffer(data));
    switch (msg.packetType()) {
      case visibio.Packet.World: {
        let world = msg.packet(new visibio.World());
        this.world = {
          terrain: new Source(world.mapArray(), world.width(), world.height()),
          id: world.id().toFloat64(),
          entities: [],
          metadata: {}
        };
        if (this._spawncb !== undefined) {
          this._spawncb()
        }
        break;
      }
      case visibio.Packet.Perception: {
        if (this.state === null) {
          throw new Error("received perception before world")
        }
        let perception = msg.packet(new visibio.Perception());
        this.health = perception.health();
        let entities = this.state.entities = [];
        let metadata = this.state.metadata;
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
        let nextState = this.state;
        this.states.push(nextState);
        break;
      }
      case visibio.Packet.Death: {
        let death = msg.packet(new visibio.Death());
        this.lifetime = death.alive().toFloat64();
        this.status = 3;
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

export default Client;