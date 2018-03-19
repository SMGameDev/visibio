import PIXI from 'pixi.js';

class Renderer {
  constructor() {
    this.app = PIXI.Application({width: 640, height: 480});
    document.getElementById('stage').appendChild(this.app.view);
  }

  drawState(state) {

  }

  drawRespawn() {
    
  }
}
