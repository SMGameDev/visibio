import * as PIXI from 'pixi.js';
import $ from 'jquery';

class Renderer {
  constructor() {
    // create pixi app
    this._app = new PIXI.Application({height: 1080, width: 1920});
    // add the app view to the save
    $('#stage').html(this._app.view);
    // boolean whether or not world has been initially drawn
    this._hasInit = false;
    // previous position the player was in
    this._prevPos = null;
    // screen size constants
    this.MAX_HEIGHT = 1080;
    this.MAX_WIDTH = 1920
    // array to hold all visible entity sprites TODO repurpose to store actual entities for updating and create separate array for sprites
    this._currentEntities = [];
  }

  set world(world) {
    // every time world is set / updated redraw
    this._worldLayout = world.terrain;
    this._fov = {x: Math.ceil(this.MAX_WIDTH / 64), y: Math.ceil(this.MAX_HEIGHT / 64)}; // calculate sprites per screen
  }

  // initialize the screen
  _initWorld(playerPos) {
    let absPos = {x: Math.floor(-playerPos[0]), y: Math.floor(-playerPos[1])};
    let offset = {x: absPos.x - this._fov.x / 2, y: absPos.y - this._fov.y / 2};
    let edgeShift = this._getEdgeShift(offset);
    offset.x = offset.x > 0 ? offset.x : 0;
    offset.y = offset.y > 0 ? offset.y : 0;
    for(var y = offset.y; y < this._fov.y + offset.y; y++) {
      for(var x = offset.x; x < this._fov.x + offset.x; x++) {
        let sprite = PIXI.Sprite.fromImage('res/' + this._getSprite(this._worldLayout.source[y * this._worldLayout.width + x]));
        sprite.position.set((x + edgeShift.x) * 64, (y + edgeShift.y) * 64); // position
        this._app.stage.addChild(sprite);
      }
    }
    this._hasInit = true;
    this._prevPos = playerPos;
  }

  // handle player when they reach the border
  _getEdgeShift(offset) {
    let edgeShift = {x: 0, y: 0};
    if (offset.x < 0)
      edgeShift.x = -offset.x;
    else if(offset.x + this._fov.x >= this._worldLayout.width)
      edgeShift.x = -(this._worldLayout.width - (offset.x + this._fov.x))
    if (offset.y < 0)
      edgeShift.y = -offset.y;
    else if(offset.y + this._fov.y >= this._worldLayout.height)
      edgeShift.y = -(this._worldLayout.height - (offset.y + this._fov.y))
    return edgeShift;
  }

  _drawWorld(playerPos) {

  }

  // get a sprite from the sprite map safely
  _getSprite(code) {
    if (Object.keys(this.spriteMap).includes(String(code)))
      return this.spriteMap[code];
    return 'error.png';
  }

  // incomplete
  _drawEntities(entities) {
    // temp code to clear entities
    for(var oldE of this._currentEntities)
      this._app.stage.removeChild(oldE);
    this._currentEntities = [];
    // TODO add repurposing code
    for(var entity of entities) {
      // sprite to append to current entities
      let sprite;
      // player
      if (entity.type == 1)
        sprite = this._drawEntity(entity.id, 0, 0, entity.rotation);
      else
        sprite = this._drawEntity(entity.id, entity.x, entity.y, entity.rotation);
      this._currentEntities.push(sprite);
    }
  }

  _drawEntity(id, posX, posY, rotation) {
    let sprite = PIXI.Sprite.fromImage('res/' + this._getSprite(id));
    sprite.position.set((posX - sprite.width / 2) + this.MAX_WIDTH / 2, (posY - sprite.height / 2) + this.MAX_HEIGHT / 2); // position
    sprite.anchor.x = 0.5;
    sprite.anchor.y = 0.5;
    sprite.rotation = rotation;
    this._app.stage.addChild(sprite);
    return sprite;
  }

  render(entities) {
    // shift it up by x and y max / 2
    let pPos = [entities[0].x, entities[0].y];
    if (!this._hasInit)
      this._initWorld(pPos);
    else
      this._drawWorld(pPos);
    this._drawEntities(entities)
  }
}

Renderer.prototype.spriteMap = {
  0: 'empty.png',
  1: 'wall.png'
}

export default Renderer;
