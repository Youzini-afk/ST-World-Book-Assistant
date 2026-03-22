import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import path from 'node:path';
import TerserPlugin from 'terser-webpack-plugin';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import unpluginAutoImport from 'unplugin-auto-import/webpack';
import { VueLoaderPlugin } from 'vue-loader';
import webpack from 'webpack';

export default (_env: any, argv: any): webpack.Configuration => ({
  experiments: {
    outputModule: true,
  },
  devtool: argv.mode === 'production' ? 'source-map' : 'eval-source-map',
  watchOptions: {
    ignored: ['**/dist', '**/node_modules'],
  },
  entry: path.join(import.meta.dirname, 'src/index.ts'),
  target: 'browserslist',
  output: {
    filename: 'index.js',
    path: path.join(import.meta.dirname, 'dist'),
    clean: true,
    publicPath: '',
    library: {
      type: 'module',
    },
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: 'vue-loader',
        exclude: /node_modules/,
      },
      {
        oneOf: [
          {
            test: /\.tsx?$/,
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              onlyCompileBundledFiles: true,
              compilerOptions: {
                noUnusedLocals: false,
                noUnusedParameters: false,
              },
            },
            exclude: /node_modules/,
          },
          // Vue scoped CSS → extracted to style.css alongside regular CSS
          {
            test: /\.vue\.css$/,
            use: [
              MiniCssExtractPlugin.loader,
              { loader: 'css-loader', options: { url: false } },
              'postcss-loader',
            ],
            exclude: /node_modules/,
          },
          // Regular CSS → extracted to style.css
          {
            test: /\.css$/,
            use: [
              MiniCssExtractPlugin.loader,
              { loader: 'css-loader', options: { url: false } },
              'postcss-loader',
            ],
            exclude: /node_modules/,
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx', '.css'],
    plugins: [
      new TsconfigPathsPlugin({
        extensions: ['.ts', '.js', '.tsx', '.jsx'],
        configFile: path.join(import.meta.dirname, 'tsconfig.json'),
      }),
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: 'style.css' }),
    new VueLoaderPlugin(),
    unpluginAutoImport({
      dts: true,
      dtsMode: 'overwrite',
      imports: [
        'vue',
        '@vueuse/core',
        { from: 'dedent', imports: [['default', 'dedent']] },
        { from: 'klona', imports: ['klona'] },
        { from: 'vue-final-modal', imports: ['useModal'] },
        { from: 'zod', imports: ['z'] },
      ],
    }),
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
    new webpack.DefinePlugin({
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    }),
  ],
  optimization: {
    minimize: argv.mode === 'production',
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: { quote_style: 1 },
          mangle: { reserved: ['_', 'toastr', 'YAML', '$', 'z'] },
        },
      }),
    ],
  },
  externals: ({ context, request }, callback) => {
    if (!context || !request) return callback();

    // Bundle local imports
    if (
      request.startsWith('.') ||
      request.startsWith('/') ||
      request.startsWith('@/') ||
      request.startsWith('http') ||
      path.isAbsolute(request)
    ) {
      return callback();
    }

    // Vue ecosystem: bundle these
    if (['vue', 'vue-router'].includes(request) || request.includes('vue') || request.includes('pixi') || request.includes('react')) {
      return callback();
    }

    // SillyTavern globals
    const globals: Record<string, string> = {
      jquery: '$',
      lodash: '_',
      showdown: 'showdown',
      toastr: 'toastr',
      yaml: 'YAML',
      zod: 'z',
    };
    if (request in globals) {
      return callback(null, 'var ' + globals[request]);
    }

    // Fallback: CDN ESM
    return callback(null, `module-import https://testingcf.jsdelivr.net/npm/${request}/+esm`);
  },
});
