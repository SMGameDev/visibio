import Client from './client.js';
import Renderer from './renderer.js';
import EventEmitter from 'eventemitter3';
import $ from 'jquery';

class Game {
  constructor(name) {
    this._client = new Client({});
    this._renderer = new Renderer();

    // setup handlers
    this._client.on('spawned', () => {
      this._renderer.world = this._client.world;
    });
    this._client.on('perception', () => this.update(this._client.entities));
    this._client.on('disconnected', () => {
      this._connected = false;
    });

    // connect to the client
    this._client.connect().then(() => {
      // spawn in my mans
      this._client.respawn(name);
      this._connected = true
    }).catch(e => console.log(e));

    // input handler
    this._inputHandler = new InputHandler();
    this._inputHandler.on('input', (inputs) => this._client.setInputs(inputs));
  }

  update(entities) {
    // ensure connected
    if (!this._connected) return;
  }
}

class InputHandler extends EventEmitter {
  // input handler constructor
  constructor() {
    super();
    // keyboard state to emit
    this._state = {
      up: false,
      down: false,
      left: false,
      right: false,
      shooting: false,
      rotation: 0
    }
    // key binds
    this._keys = {
      119: 'up',
      115: 'down',
      97: 'left',
      100: 'right'
    }

    // keydown handler
    $('#stage').keydown(event => {
      // check if key in _keys
      if (Object.keys(this._keys).includes(event.which)) {
        this._state[this._keys[event.which]] = true;
        this.emit('input', this._state);
      }
    });

    // keyup handler
    $('#stage').keyup(event => {
      // check if key in _keys
      if (Object.keys(this._keys).includes(event.which)) {
        this._state[this._keys[event.which]] = false;
        this.emit('input', this._state);
      }
    });

    // mouse down (start shooting)
    $('#stage').mousedown(() => {
      this._state.shooting = true;
      this.emit('input', this._state);
    });

    // mouse up (stop shooting)
    $('#stage').mouseup(() => {
      this._state.shooting = false;
      this.emit('input', this._state);
    });

    // TODO add rotation handler
  }

  get inputs() {
    return this._state;
  }
}

export default Game;
