// import render from 'renderer/renderer.js';
import Connection from './connection.js'
import _ from 'underscore';

class Game {
  constructor(address) {
    this.conn = new Connection(address);
    this.status = 0; // 0=not connected, 1=connected, 2=playing
    this.state = {
      me: null,
      health: 0,
      entities: [],
      metadata: {},
      lastPerception: null
    };

    this.conn.connect().then(() => {
      this.status = 1;
      this.conn.on('world', (id, source) => {

      })
    }).catch((e) => {
      throw e;
    });
    this.conn.clear
    this.conn.on('world', ({id, source}) => {
      this.status = 2;
      this.state.me = id;
      this.state.source = source;
    });
    this.conn.on('perception', (health, entities, metadata) => {
      this.state.health = health;
      this.state.entities = entities;
      _.extend(this.state.metadata, metadata);
      this.state.lastPerception = Date.now();
    });
    this.conn.on('death', () => {
      this.status = 1;
      this.state.entities = [];
      this.state.metadata = {};
      this.state.lastPerception = null;
    });
  }

  respawn(name) {
    if (this.status !== 1) {
      throw new Error("cannot respawn while not connected or alive")
    }
    let err = this.conn.sendRespawn(name);
    if (err) {
      throw err;
    }
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
export default Game;
