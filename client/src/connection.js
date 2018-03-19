import Source from 'map.js';
import EventEmitter from 'eventemitter';
import visibio from 'visibio_generated.js';

class Connection extends EventEmitter {
  constructor(address) {
    super();
    this.connected = false;
    this.address = address;
    this.websocket = null;
  }

  open() {
    this.websocket = new WebSocket(this.address);
    this.websocket.binaryType = 'arraybuffer';
    this.websocket.onopen = () => {
      this.connected = true;
      this.emit('open')
    };
    this.websocket.onerror = () => {
      this.connected = false;
      this.emit('error')
    };
    this.websocket.onclose = (event) => {
      this.connected = false;
      this.emit('close', event.code, event.reason)
    };
    this.websocket.onmessage = (event) => {
      this.__handle(event.data)
    }
  }

  isOpen() {
    return this.websocket !== null && this.state;
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