import Source from 'map.js';
import EventEmitter from 'eventemitter';
import visibio from 'visibio_generated.js';

class Connection extends EventEmitter {
  constructor(address) {
    super();
    this.connected = false;
    this.address = address;
    this.websocket = null;
    this.sendInputsThrottled = _.throttle((inputs) => {
      let builder = new flatbuffers.Builder(8);
      visibio.Inputs.startInputs(builder);
      visibio.Inputs.addLeft(builder, inputs.left);
      visibio.Inputs.addRight(builder, inputs.right);
      visibio.Inputs.addDown(builder, inputs.down);
      visibio.Inputs.addUp(builder, inputs.up);
      visibio.Inputs.addRotation(builder, inputs.rotation);
      visibio.Inputs.addShooting(builder, inputs.shooting);
      this.websocket.send(message(builder, visibio.Inputs.endInputs(builder), visibio.Packet.Inputs))
    }, 5, {leading: false});
  }

  sendRespawn(name) {
    if (!this.connected) return new Error("tried to respawn while not connected");
    let builder = new flatbuffers.Builder(128);
    name = name || "unknown";
    let n = builder.createString(name);
    visibio.Respawn.startRespawn(builder);
    visibio.Respawn.addName(builder, n);
    this.websocket.send(message(builder, visibio.Respawn.endRespawn(builder), visibio.Packet.Respawn));
  }

  sendInputs(inputs) {
    if (!this.connected) return new Error("tried to send inputs while not connected");
    this.sendInputsThrottled(inputs)
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.websocket = new WebSocket(this.address);
      this.websocket.binaryType = 'arraybuffer';
      this.websocket.onopen = () => {
        this.connected = true;
      };
      this.websocket.onerror = () => {
        this.connected = false;
      };
      this.websocket.onclose = () => {
        this.connected = false;
      };
      this.websocket.onmessage = (event) => {
        this.__handle(event.data)
      }
    })
  }

  isConnected() {
    return this.websocket !== null && this.connected;
  }

  __handle(data) {
    let msg = visibio.Message.getRootAsMessage(new flatbuffers.ByteBuffer(data));
    switch (msg.packetType()) {
      case visibio.Packet.World: {
        let world = msg.packet(new visibio.World());
        this.emit('spawn',
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
        this.emit('perception',
          health,
          entities,
          metadata
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