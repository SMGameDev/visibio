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
    console.log('drawing world');
    if (this._worldSprite != null)
      this._app.state.removeChild(this._worldSprite);

    let ctx = document.getElementById('draw-canvas').getContext('2d');

    // image template class
    let image = new Image();
    for(var y = 0; y < this._worldState.height; y++) {
      for(var x = 0; x < this._worldState.width; x++) {
        let elem = this._worldState.source[y * this._worldState.height + x];
        image.src = '../assets/' + (Object.keys(this.spriteMap).includes(elem) ? this.spriteMap[elem] : 'empty.png');
        image.onload = () => {
          ctx.drawImage(image, x * 64, y * 64, 64, 64);
        };
        console.log('testing');
      }
    }
    // sprite from psuedo image
    this._worldSprite = PIXI.Sprite.fromImage(document.getElementById('draw-canvas').toDataURL('image/png'));
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
