// import render from 'renderer/renderer.js';
import Connection from './connection.js'
import _ from 'underscore';

class Game {
  constructor(address) {
    this.conn = new Connection(address);
    this._status = 0; // 0=not connected, 1=connected, 2=playing
    this._perception = {
      me: null,
      health: 0,
      entities: [],
      metadata: {},
      lastPerception: null
    };

    this.conn.connect().then(() => {
      this._status = 1;
      this.conn.on('_world', (id, source) => {

      })
    }).catch((e) => {
      throw e;
    });
    this.conn.clear
    this.conn.on('_world', ({id, source}) => {
      this._status = 2;
      this._perception.me = id;
      this._perception.source = source;
    });
    this.conn.on('_perception', (health, entities, metadata) => {
      this._perception.health = health;
      this._perception.entities = entities;
      _.extend(this._perception._metadata, metadata);
      this._perception.lastPerception = Date.now();
    });
    this.conn.on('death', () => {
      this._status = 1;
      this._perception.entities = [];
      this._perception._metadata = {};
      this._perception.lastPerception = null;
    });
  }

  respawn(name) {
    if (this._status !== 1) {
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
