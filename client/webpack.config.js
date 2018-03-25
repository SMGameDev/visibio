const path = require('path');

module.exports = {
  entry: ['babel-polyfill', path.resolve(__dirname, 'src', 'index.js')],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist', 'assets')
  },
  module: {
    rules: [
      {
        use: {
          loader: "babel-loader",
          options: {
            presets: ['@babel/preset-env'],
          }
        },
        include: [
          path.resolve(__dirname, 'src'),
        ],
        // Only run `.js` files through Babel
        test: /\.js?$/,
      },
      {
        test: /\.(gif|png|jpe?g|svg)$/i,
        use: [
          'file-loader',
          {
            loader: 'image-webpack-loader',
            options: {
              bypassOnDebug: true,
            },
          },
        ],
      }
    ],
  },
  devtool: 'source-map',
  devServer: {
    contentBase: path.join(__dirname, "dist"),
    compress: true,
    port: 8000
  }
};