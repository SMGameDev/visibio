const path = require('path');
const HappyPack = require('happypack');

module.exports = {
  entry: ['babel-polyfill', './src/index.js'],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {test: /\.png$/, loader: "url-loader?mimetype=image/png"},
      {
        test: /.js$/,
        use: 'happypack/loader',
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new HappyPack({
      // 3) re-add the loaders you replaced above in #1:
      loaders: [{
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env']
        }
      }]
    })
  ],
  devtool: 'source-map'
};