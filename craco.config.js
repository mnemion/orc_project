const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
  style: {
    css: {
      loaderOptions: {
        importLoaders: 1,
        modules: {
          auto: true,
          localIdentName: '[local]',
        },
      }
    },
    postcss: {
      mode: 'extends',
    }
  },
  webpack: {
    configure: (webpackConfig) => {
      if (webpackConfig.resolve.fallback) {
        delete webpackConfig.resolve.fallback;
      }
      
      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false
        }
      });
      
      webpackConfig.devtool = process.env.NODE_ENV === 'production' 
        ? false 
        : 'cheap-module-source-map';
        
      return webpackConfig;
    },
    plugins: [
      new NodePolyfillPlugin(),
      
      new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer']
      }),
      
      new webpack.DefinePlugin({
        'process.browser': true,
        '__dirname': JSON.stringify(__dirname)
      })
    ]
  }
};