import render from 'renderer/renderer.js';
import _ from 'underscore';

class Game {
  constructor(address) {
    this.ready = false;
    this.conn = new Connection(address);
    this.status = 0; // 0=not connected, 1=connected, 2=playing
    this.state = {
      me: null,
      health: 0,
      entities: [],
      metadata: {},
      source: null
    }
    this.renderer = new render.Renderer();
    this.ready = true;
  }

  update() {
    if(this.ready) {
      this.renderer.drawState(this.state);
    }
  }

    this.conn.connect().then(() => {
      this.status = 1;
    });
    this.conn.on('spawn', (id, source) => {
      this.status = 2;
      this.state.me = id;
      this.state.source = source;
      this.state.health = 100;
      this.renderer.setState(this.state);
    });
    this.conn.on('perception', (health, entities, metadata) => {
      this.state.health = health;
      this.state.entities = entities;
      _.extend(this.state.metadata, metadata)
      this.update();
    });
    this.conn.on('death', () => {
      this.state = 1
      this.respawn().then(result => {
        // render respawn
        this.renderer.drawRespawn();
      },
      err => {
        console.log(err);
      });
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

/*
  RENDERING
 */

// function render() {
//   let myPlayer = entities.find((e) => e.id === me);
//   if (!myPlayer) return;
//   two.scene.setTransform(1, 0, 0, 1, -(myPlayer.x - two.width / 2), -(myPlayer.y - two.height / 2));
//
// }
//
// function initialize() {
//   $window.resize(() => {
//     two.renderer.setSize($window.width(), $window.height());
//     two.width = two.renderer.width;
//     two.height = two.renderer.height;
//   });
//
// }
=======
export default Game;
>>>>>>> 2271a30e8bdfbe2751e68006c37e73d423184ee9
