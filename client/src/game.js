class Game {
  constructor() {
    this.conn = null;
    this.playing = false;
    this.state = {
      me: null,
      health: null,
      entities: [],
      metadata: {}
    }
    this.canvas = document.getElementById('#canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  render() {

  }
}

/*
  RENDERING
 */

// function render() {
//   let myPlayer = entities.find((e) => e.id === me);
//   if (!myPlayer) return;
//   two.scene.setTransform(1, 0, 0, 1, -(myPlayer.x - two.width / 2), -(myPlayer.y - two.height / 2));
//
// }
//
// function initialize() {
//   $window.resize(() => {
//     two.renderer.setSize($window.width(), $window.height());
//     two.width = two.renderer.width;
//     two.height = two.renderer.height;
//   });
//
// }