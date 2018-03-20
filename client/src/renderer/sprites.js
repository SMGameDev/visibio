import * as PIXI from 'pixi.js';

async loadSprite(textureName) {
  try {
    textureName = 'assets/sprites/' + textureName;
    return new Promise((resolve, reject) => {
      if (Object.keys(PIXI.utils.TextureCache).includes(textureName))
        resolve(new PIXI.Sprite(PIXI.utils.TextureCache[textureName]));
      else {
        PIXI.loader
          .add(textureName)
          .load(() => {
            resolve(new PIXI.Sprite(PIXI.utils.TextureCache[textureName]));
          });
      }
    });
  }
  catch (e) {
    reject(e);
  }
}

let spriteTable = {
  0: 'empty.png',
  1: 'wall.png',
  2: 'player.png'
}

// default to entity, map by id
function mapSpriteTexture(id) {
  if(Object.keys(spriteTable).includes(id)) {
    return spriteTable[id];
  }
  return 'empty.png';
}

// params = Entity Obj
async getSprite(entity) {
  return new Promise((resolve, reject) => {
    loadSprite(mapSpriteTexture(entity.id)).then(
      spr => {
        spr.position.set(entity.x, entity.y);
        spr.scale.x = entity.width;
        spr.scale.y = entity.height;
        spr.rotation = entity.rotation;
        resolve(spr);
      },
      err => {
        reject(err);
      }
    );
  });
}
