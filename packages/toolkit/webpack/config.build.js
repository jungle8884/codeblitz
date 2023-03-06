const path = require('path');
const fs = require('fs');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const createWebpackConfig = require('./config.integration');
const { config } = require('./util');
const define = require('../define.json');

process.env.NODE_ENV = 'production';

const libBundle = createWebpackConfig({
  mode: 'production',
  tsconfigPath: path.join(__dirname, '../../../tsconfig.json'),
  outputPath: path.join(__dirname, '../../alex/bundle'),
  define: {
    ...Object.keys(define).reduce((obj, key) => {
      obj[key] = JSON.stringify(define[key]);
      return obj;
    }, {}),
    __non_webpack_require__: '() => {}',
  },
  webpackConfig: {
    context: path.join(__dirname, '../../..'),
    entry: {
      [config.appEntry]: './packages/alex/src',
      [config.editorEntry]: './packages/alex/src/editor',
      [config.editorAllEntry]: './packages/alex/src/editor.all',
    },
    // 此处 bundle 的包仅作为 commonjs 使用，但因为 external 原因会导致 webpack4 加载 bundle 出错，因此还是使用 umd
    output: {
      library: 'AlexLib',
      libraryTarget: 'umd',
    },
    externals: [
      {
        react: {
          root: 'React',
          commonjs2: 'react',
          commonjs: 'react',
          amd: 'react',
        },
        'react-dom': {
          root: 'ReactDOM',
          commonjs2: 'react-dom',
          commonjs: 'react-dom',
          amd: 'react-dom',
        },
        moment: {
          root: 'moment',
          commonjs2: 'moment',
          commonjs: 'moment',
          amd: 'moment',
        },
      },
      '@alipay/alex-registry',
    ],
    optimization: {
      minimize: false,
      concatenateModules: false,
      splitChunks: false,
    },
  },
});

const globalBundle = createWebpackConfig({
  mode: 'production',
  tsconfigPath: path.join(__dirname, '../../../tsconfig.json'),
  outputPath: path.join(__dirname, '../../alex/bundle'),
  define: Object.keys(define).reduce((obj, key) => {
    obj[key] = JSON.stringify(define[key]);
    return obj;
  }, {}),
  webpackConfig: {
    context: path.join(__dirname, '../../..'),
    entry: {
      [config.alexAllGlobalEntry]: './packages/acr/src/all',
      [config.alexAllGlobalMinEntry]: './packages/acr/src/all',
      [config.appGlobalEntry]: './packages/alex/src',
      [config.appGlobalMinEntry]: './packages/alex/src',
      [config.editorAllGlobalEntry]: './packages/alex/src/editor.all',
      [config.editorAllGlobalMiniEntry]: './packages/alex/src/editor.all',
    },
    resolve: {
      // global 对外使用，忽略掉 yuyan 埋点
      alias: {
        '@alipay/yuyan-monitor-web': path.resolve(__dirname, 'patches', 'yuyan-monitor.js'),
      },
    },
    // 此处 bundle 的包仅作为 commonjs 使用，但因为 external 原因会导致 webpack4 加载 bundle 出错，因此还是使用 umd
    output: {
      library: 'Alex',
      libraryTarget: 'global',
    },
    externals: [
      {
        react: 'React',
        'react-dom': 'ReactDOM',
        moment: 'moment',
      },
    ],
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          parallel: true,
          include: /\.min\.js$/,
        }),
        new CssMinimizerPlugin({
          include: /\.min\.css$/,
        }),
      ],
      concatenateModules: false,
      splitChunks: false,
    },
  },
});

const acrBundle = createWebpackConfig({
  mode: 'production',
  tsconfigPath: path.join(__dirname, '../../../tsconfig.json'),
  outputPath: path.join(__dirname, '../../acr/bundle'),
  define: Object.keys(define).reduce((obj, key) => {
    obj[key] = JSON.stringify(define[key]);
    return obj;
  }, {}),
  webpackConfig: {
    context: path.join(__dirname, '../../..'),
    entry: {
      [config.acrGlobalEntry]: './packages/acr/src',
      [config.acrGlobalMinEntry]: './packages/acr/src',
    },
    // 此处 bundle 的包仅作为 commonjs 使用，但因为 external 原因会导致 webpack4 加载 bundle 出错，因此还是使用 umd
    output: {
      library: 'ACR',
      libraryTarget: 'global',
    },
    externals: [
      {
        react: 'React',
        'react-dom': 'ReactDOM',
      },
    ],
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          parallel: true,
          include: /\.min\.js$/,
        }),
        new CssMinimizerPlugin({
          include: /\.min\.css$/,
        }),
      ],
      concatenateModules: false,
      splitChunks: false,
    },
  },
});

module.exports = [libBundle, globalBundle, acrBundle];
