import PIXI from 'pixi.js';

class Renderer {
  constructor() {
    this.app = PIXI.Application({width: 640, height: 480});
    document.getElementById('stage').appendChild(this.app.view);
    this.state = null;
  }

  drawState(state) {

  }

  drawRespawn() {

  }

  setState(state) {
    this.state = getEntities(state);
  }
}

class Entity {
  constructor (id, position, size, rotation) {
    this.id = id;
    this.x = position.x;
    this.y = position.y;
    this.width = position.width;
    this.height = position.height;
    this.rotation = rotation * (Math.PI / 180); // convert degrees to radians
  }
}

function getEntities(state) {
  
}
