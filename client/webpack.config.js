const path = require('path');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');


module.exports = {
  entry: ['babel-polyfill','./src/index.js'],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {test: /\.png$/, loader: "url-loader?mimetype=image/png"},
      {
        test: /\.js$/,
        // exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            exclude: /node_modules/
          }
        }
      }]
  },
  plugins: [
    new HardSourceWebpackPlugin()
  ],
  devtool: 'source-map'
};