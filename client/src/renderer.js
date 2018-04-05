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
    this._worldSprites = [];
  }

  set world(world) {
    // every time world is set / updated redraw
    this._worldLayout = world.terrain;
    this._fov = {x: Math.ceil(1920 / 64), y: Math.ceil(1080 / 64)}; // calculate sprites per screen
    this._drawWorld();
  }

  // draw the world
  _drawWorld() {
    // clear out old sprites
    for(var sprite in this._app.stage.children)
      this._app.stage.removeChild(sprite);
    // TODO move player viewport
    for(var y = 0; y < this._fov.y; y++) {
      for(var x = 0; x < this._fov.x; x++) {
        let sprite = PIXI.Sprite.fromImage('res/' + this._getSprite(this._worldLayout.source[y * this._worldLayout.width + x]));
        sprite.position.set(x * 64, y * 64); // position
        sprite.scale.set(2, 2); // double size
        this._app.stage.addChild(sprite);
      }
    }
  }

  // get a sprite from the sprite map safely
  _getSprite(code) {
    if (Object.keys(this.spriteMap).includes(code))
      return this.spriteMap[code];
    return 'empty.png';
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
