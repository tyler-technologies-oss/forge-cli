import { resolve } from 'path';
import { BannerPlugin, Configuration, DefinePlugin } from 'webpack';
import { findUp } from './utils';
import { IDevtoolConfig } from '../core/definitions';

const CleanWebpackPlugin = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

export type WebpackConfigurationFactory = (env: IWebpackEnv) => Configuration;

export interface IWebpackEnv {
  root: string;
  tsconfigPath: string;
  entry: { [key: string]: string };
  outputDir: string;
  minify: boolean;
  fileNamePrefix: string | null;
  globalVariableName: string | string[];
  mode?: 'production' | 'development' | 'none';
  cache?: boolean;
  clean?: boolean;
  beautify?: boolean;
  component?: string;
  libraryTarget?: string;
  devtool?: IDevtoolConfig;
  externals?: any;
  sassLoaderWebpackImporter: boolean;
  banner?: string;
}

export interface IWebpackDevServerEnv {
  port?: number;
  open?: boolean | string;
  path?: string;
}

export function getWebpackConfigurationFactory(): WebpackConfigurationFactory {
  return (env: IWebpackEnv) => {
    if (!env.mode) {
      env.mode = 'production';
    }

    const cliNodeModules = findUp('node_modules', __dirname);

    if (!cliNodeModules) {
      throw new Error('Unable to locate the node_modules folder for the CLI.');
    }

    const projectNodeModules = resolve(env.root, 'node_modules');
    const devSourcemap = env.devtool && env.devtool.development ? env.devtool.development : 'eval-source-map';
    const prodSourcemap = env.devtool && env.devtool.production ? env.devtool.production : 'source-map';
    const filename = env.fileNamePrefix ? `${env.fileNamePrefix}-[name].js` : '[name].js';

    const config: Configuration = {
      mode: env.mode,
      entry: env.entry,
      cache: env.cache,
      resolve: {
        extensions: ['.ts', '.js'],
        modules: [
          projectNodeModules
        ]
      },
      resolveLoader: {
        modules: [
          cliNodeModules,
          projectNodeModules
        ]
      },
      output: {
        path: resolve(env.root, env.outputDir),
        filename,
        publicPath: env.outputDir,
        library: env.globalVariableName,
        libraryTarget: env.libraryTarget || 'umd'
      },
      devtool: env.mode === 'development' ? devSourcemap : prodSourcemap,
      performance: {
        hints: false
      },
      optimization: {
        emitOnErrors: false,
        concatenateModules: env.mode === 'production',
        usedExports: true,
        sideEffects: true,
        providedExports: true,
        minimize: true,
        minimizer: []
      },
      module: {
        rules: [
          {
            test: /\.js$/,
            use: ['source-map-loader'],
            enforce: 'pre',
            exclude: [/node_modules/],
            resolve: {
              fullySpecified: false
            }
          },
          {
            test: /\.ts$/,
            use: [
              {
                loader: 'ts-loader',
                options: {
                  configFile: env.tsconfigPath,
                  silent: true
                }
              }
            ]
          },
          {
            test: /\.scss$/,
            use: [
              'css-to-string-loader',
              {
                loader: 'css-loader',
                options: {
                  url: false,
                  esModule: false
                }
              },
              {
                loader: 'postcss-loader',
                options: {
                  postcssOptions: {
                    plugins: ['autoprefixer']
                  }
                }
              },
              {
                loader: 'sass-loader',
                options: {
                  webpackImporter: env.sassLoaderWebpackImporter,
                  implementation: require('sass'),
                  sassOptions: {
                    includePaths: [resolve(env.root, 'node_modules')]
                  }
                }
              }
            ]
          },
          {
            test: /\.css$/,
            use: [
              'css-to-string-loader',
              {
                loader: 'css-loader',
                options: {
                  url: false,
                  esModule: false
                }
              },
              {
                loader: 'postcss-loader',
                options: {
                  postcssOptions: {
                    plugins: ['autoprefixer']
                  }
                }
              }
            ]
          },
          {
            test: /\.html$/,
            loader: 'html-loader',
            options: {
              minimize: true,
              esModule: false
            }
          }
        ]
      },
      plugins: [
        new DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify(env.mode)
        })
      ]
    };

    if (env.banner) {
      config.plugins?.push(new BannerPlugin({ banner: env.banner, raw: true }));
    }

    if (env.clean) {
      config.plugins?.push(new CleanWebpackPlugin([env.outputDir], { verbose: false }));
    }

    if (env.externals) {
      config.externals = env.externals;
    }

    if (env.mode === 'production') {
      if (env.minify) {
        config.optimization?.minimizer?.push(new TerserPlugin({
          terserOptions: {
            output: {
              beautify: env.beautify
            }
          }
        }));
      }
    }

    return config;
  };
}
