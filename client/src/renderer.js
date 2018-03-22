import * as PIXI from 'pixi.js'
import $ from 'jquery'
import wall from '../assets/wall.png'
import empty from '../assets/empty.png'

const textures = {
  0: PIXI.Texture.fromImage(empty),
  1: PIXI.Texture.fromImage(wall)
};

class Renderer {
  constructor(game) {
    this.app = new PIXI.Application(window.width, window.height, {});
    document.body.appendChild(this.app.view);
    this.hide();
    $(window).resize(() => {
      this.resize(window.width, window.height);
    });
    this.game = game;
    this.playing = false;
    this.game.on('connected', () => {
      this.game.respawn('meyer').then(() => {
        console.log('spawned');
        this.app.stage.removeChildren();
        this.renderables = [];
        this.__drawBackground();
        this.show()
      }).catch((e) => {
        console.log(e)
      });
    });
    this.game.on('died', () => {
      this.hide()
    });
    this.app.ticker.add((dt) => {
      let delta = Date.now() - (this.game.state.lastPerception || Date.now()); // time since last perception (to apply velocity)
      let me = this.game.state.entities.find((e) => e.id === this.game.state.me)[0];
      if (!me) {
        return this.hide();
      }
      this.app.stage.setTransform(1, 0, 0, 1, -(me.x - this.app.view.width / 2), -(me.y - this.app.view.height / 2));
    })
  }

  resize(width, height) {
    this.app.renderer.resize(width, height);
  }

  // hide makes the renderer stop and hide itself.
  hide() {
    $(this.app.view).hide();
    this.app.stop();
  }

  // show makes the renderer start and show itself.
  show() {
    $(this.app.view).show();
    this.app.start();
  }

  __drawBackground() {
    let source = this.game.state.source;
    let xspan = source.width();
    let yspan = source.height();

    let mapContainer = new PIXI.DisplayObjectContainer();
    for (let x = 0; x < xspan; x++) {
      for (let y = 0; y < yspan; y++) {
        mapContainer.addChild(new PIXI.Sprite(textures[source.get(x, y)]))

      }
    }
    let texture = new PIXI.CanvasRenderer({width: xspan * 64, height: yspan * 64});
    texture.render(mapContainer)
    let background = new PIXI.Sprite(texture)
    this.app.stage.addChild(background)

    // // let x = Math.floor((me.x - this.app.view.width / 2) / 64); // get top-left posn (offscreen or exact top left) and find the tile index
    // // let y = Math.floor((me.y - this.app.view.height / 2) / 64);
    // // let xspan = Math.ceil(this.app.view.width / 64); // how many to draw on screen
    // // let yspan = Math.ceil(this.app.view.height / 64);
    //
    // ctx.strokeStyle = '##636e72';
    // ctx.lineWidth = 3;
    //

    // for (let x = 0; x < xspan; x++) {
    //   for (let y = 0; y < yspan; y++) {
    //     if (!source.get(x, y)) break;
    //     let top = true;
    //     let left = true;
    //     let bottom = true;
    //     let right = true;
    //
    //     if (x + 1 < xspan && source.get(a + 1, b)) {
    //       right = false;
    //     }
    //     if (a - 1 > 0 && source.get(a - 1, b)) {
    //       left = false;
    //     }
    //     if (b + 1 < yspan && source.get(a, b + 1)) {
    //       bottom = false;
    //     }
    //     if (b - 1 > 0 && source.get(a, b - 1)) {
    //       top = false;
    //     }
    //     gfx.beginPath();
    //     ctx.moveTo(x + a * 64, y + b * 64);
    //     if (top) {
    //       ctx.lineTo(x + (a + 1) * 64, y + b * 64);
    //     } else {
    //       ctx.moveTo(x + (a + 1) * 64, y + b * 64);
    //     }
    //     if (right) {
    //       ctx.lineTo(x + (a + 1) * 64, y + (b + 1) * 64);
    //     } else {
    //       ctx.moveTo(x + (a + 1) * 64, y + (b + 1) * 64);
    //     }
    //     if (bottom) {
    //       ctx.lineTo(x + a * 64, y + (b + 1) * 64)
    //     } else {
    //       ctx.moveTo(x + a * 64, y + (b + 1) * 64);
    //     }
    //     if (left) {
    //       ctx.lineTo(x + a * 64, y + b * 64)
    //     }
    //     ctx.stroke()
    //   }
    // }
  }
}

export default Renderer;