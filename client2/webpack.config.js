//webpack.config.js
const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
  resolve: {
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "fs": false,
      "path": require.resolve("path-browserify"),
      "stream": require.resolve("stream-browserify"),
      "process": require.resolve("process/browser"),
      "util": require.resolve("util"),
      "zlib": require.resolve("browserify-zlib")
    }
  },
  plugins: [
    new NodePolyfillPlugin()
  ],

  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist')
  }
};
