const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
  resolve: {
    fallback: {
      // Node.js 핵심 모듈에 대한 폴리필
      "path": require.resolve("path-browserify"),
      "os": require.resolve("os-browserify/browser"),
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "process": require.resolve("process/browser"),
    },
    // ESM 모듈 해결 개선
    fullySpecified: false
  },
  plugins: [
    new NodePolyfillPlugin()
  ],
  // ESM 모듈 처리를 위한 설정
  module: {
    rules: [
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false
        }
      }
    ]
  }
};