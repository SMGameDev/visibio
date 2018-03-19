class Map {
  constructor(source, width, height) {
    this.source = source;
    this.width = width;
    this.height = height || source.length / width
  }

  get(x, y) {
    return this.source[this.width * x + y];
  }
}