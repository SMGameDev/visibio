import Connection from 'connection'
import _ from 'underscore'

class Game {
  constructor(address) {
    this.conn = new Connection(address);
    this.status = 0; // 0=not connected, 1=connected, 2=playing
    this.state = {
      me: null,
      health: 0,
      entities: [],
      metadata: {},
      map: null
    };

    this.conn.connect().then(() => {
      this.status = 1;
    });
    this.conn.on('spawn', (id, source) => {
      this.status = 2;
      this.state.me = id;
      this.state.source = source;
      this.state.health = 100;
    });
    this.conn.on('perception', (health, entities, metadata) => {
      this.state.health = health;
      this.state.entities = entities;
      _.extend(this.state.metadata, metadata)
    });
    this.conn.on('death', () => {
      this.state = 1
    })
  }

  async respawn(name) {
    return new Promise((resolve, reject) => {
      if (this.status !== 1) {
        return reject(new Error("cannot respawn while not connected or alive"))
      }
      let err = this.conn.sendRespawn(name)
      if (err) {
        return reject(err)
      }
      return resolve()
    })
  }
}

export default Game;