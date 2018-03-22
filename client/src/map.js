// class Atlas {
//
// }
//
// class Map {
//   constructor(source, atlas) {
//     this.tileSize = {
//       x: 64,
//       y: 64
//     };
//     this.view = new AABB(0, 0, 1024, 1024);
//     this.width = source.width();
//     this.height = source.height();
//     this.bounds = new AABB(0, 0, source.width() * this.tileSize.x, source.height() * this.tileSize.y);
//     this.canvasTileSize = {
//       x: 1024,
//       y: 1024
//     };
//     this.canvasTileArray = [];
//   }
//
//   resize(x, y) {
//
//   }
// }
//
// class CanvasTile {
//   constructor(width, height) {
//     this.bounds = new AABB(-1, -1, width, height);
//     let canvas = document.createElement('canvas');
//     canvas.width = width;
//     canvas.height = height;
//     this.canvas = canvas;
//     this.ctx = canvas.getContext('2d');
//   }
// }
//
// class AABB {
//   constructor(x, y, width, height) {
//     this.t = x;
//     this.l = y;
//     this.b = y + height;
//     this.r = x + width;
//   }
//
//   intersect(o) {
//     return !(o.l > this.r || o.r < this.l || o.t > this.b || o.b < this.t);
//   }
// }
//
// function intersectRectangles(r1, r2) {
//
// }

class Source {
  constructor(source, width, height) {
    this.source = source;
    this.width = width;
    this.height = height || source.length / width
  }

  width() {
    return this.width;
  }

  height() {
    return this.height;
  }

  get(x, y) {
    return this.source[this.width * x + y];
  }
}