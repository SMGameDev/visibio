import * as PIXI from 'pixi.js';
import $ from 'jquery';

class Renderer {
  constructor() {
    // create pixi app
    this._app = new PIXI.Application({height: 1080, width: 1920});
    // add the app view to the save
    $('#stage').html(this._app.view);
    this._prevFrame = {};
    // sprite to hold world
    this._worldSprite = null;
  }

  set world(world) {
    // every time world is set / updated redraw
    this._worldState = world.terrain;
    this._drawWorld();
  }

  // draw the world
  _drawWorld() {
    if (this._worldSprite != null)
      this._app.state.removeChild(this._worldSprite

    let ctx = document.getElementById('draw-canvas').getContext('2d');
    for(var y = 0; y < this._worldState.height; y++) {
      for(var x = 0; x < this._worldState.width; y++) {
        let elem = this._worldState.source[y * this._worldState.height + x];
        let image = new Image();
        image.src = 'assets/' + (Object.keys(this.spriteMap).includes(elem) ? this.spriteMap[elem] : 'error.png';
        image.onload(() => {
          ctx.drawImage(image, x * 64, y * 64, 64, 64);
        })
      }
    }

    // sprite from psuedo image
    this._worldSprite = PIXI.Sprite.fromImage(ctx.toDataUrl('image/png'));
    // update sprite
    this._app.stage.addChild(this._worldSprite);
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
