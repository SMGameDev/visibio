import * as PIXI from 'pixi.js';
import $ from 'jquery';

class Renderer {
  constructor() {
    this._app = new PIXI.Application({height: 1080, width: 1920});
    $('#stage').html(this._app.view);
    this._prevFrame = {};
  }

  set world(world) {
    this._worldState = world.terrain;
    this._drawWorld();
  }

  _drawWorld() {
    // DO NOT USE - it was late and I did a dumb
    // THIS WILL ANNHILATE YOUR BROWSER AND YOUR COMPUTER
    
    // TODO combine terrain map into image based on position (get FOV)

    /*for(var y = 0; y < this._worldState.height; y++) {
      for(var x = 0; x < this._worldState.width; y++) {
        let elem = this._worldState.source[y * this._worldState.height + x];
        let sprite = PIXI.Sprite.fromImage('assets/' + (Object.keys(this.spriteMap).includes(elem) ? this.spriteMap[elem] : 'error.png'));
        sprite.position.set(x * 32, y * 32);
        this._app.stage.addChild(sprite);
      }
    }*/
  }

  drawEntities(entities) {
    console.log(entities);
  }
}

Renderer.prototype.spriteMap = {
  0: 'empty.png',
  1: 'wall.png'
}

export default Renderer;
