import { absolutify, Logger } from '@tylertech/forge-build-tools';
import karma, { ConfigOptions, constants, FilePattern } from 'karma';
import { resolve as pathResolve, sep } from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import wepback, { Configuration } from 'webpack';
import { IConfig } from '../core/definitions.js';
import { findUp } from './utils.js';

import karmaChromeLauncher from 'karma-chrome-launcher';
import karmaCoverageIstanbulReporter from 'karma-coverage-istanbul-reporter';
import karmaFirefoxLauncher from 'karma-firefox-launcher';
import karmaHTML2JSPreprocess from 'karma-html2js-preprocessor';
import karmaJasmine from 'karma-jasmine';
import karmaJasmineHtmlReporter from 'karma-jasmine-html-reporter';
import karmaJasmineOrderReporter from 'karma-jasmine-order-reporter';
import karmaSourcemapLoader from 'karma-sourcemap-loader';
import karmaSpecReporter from 'karma-spec-reporter';
import karmaWebpack from 'karma-webpack';
import * as sass from 'sass';

const { SourceMapDevToolPlugin } = wepback;
const { Server } = karma;

import { fileURLToPath } from 'url';
import sassPreprocessor from '../core/karma/plugins/sass-preprocessor.js';

export interface ITestEnv {
  components?: string[];
  port?: number;
  ci?: boolean;
  stopOnSpecFailure?: boolean;
  coverage?: boolean;
  seed?: string;
  sandbox?: boolean;
}

interface IKarmaOptions extends ConfigOptions {
  webpack?: Record<string, any>;
  webpackMiddleware?: Record<string, any>;
  coverageIstanbulReporter?: Record<string, any>;
  specReporter?: Record<string, any>;
  scssPreprocessor?: Record<string, any>;
}

/**
 * Generates the Karma configuration options.
 * @param config The CLI environment configuration.
 * @param testEnv The test environment configuration.
 */
export function generateKarmaConfig(config: IConfig, browsers: string | string[], singleRun = false, env: ITestEnv = {}): ConfigOptions  {
  const files: Array<string | FilePattern> = [];
  const preprocessors: { [key: string]: string | string[] } = {};
  const specDirPath = `${config.context.srcDirName}/${config.context.testDirName}/spec`;

  // Add spec files for individual components if specified, otherwise include everything.
  // We let webpack follow imports from the files we specify (the spec files)
  if (env.components && env.components.length) {
    for (const component of env.components) {
      files.push({ pattern: `${specDirPath}/${component}/**/*.ts`, watched: false }); // webpack will watch the files
      files.push({ pattern: `${specDirPath}/${component}/**/*.html` });
      preprocessors[`${specDirPath}/${component}/**/*.ts`] = ['webpack', 'sourcemap'];
      preprocessors[`${specDirPath}/${component}/**/*.html`] = ['html2js'];
    }
  } else {
    files.push({ pattern: `${specDirPath}/index.ts`, watched: false }); // webpack will watch the files
    files.push({ pattern: `${specDirPath}/**/*.html` });
    preprocessors[`${specDirPath}/index.ts`] = ['webpack', 'sourcemap'];
    preprocessors[`${specDirPath}/**/*.html`] = ['html2js'];
  }

  if (env.coverage === undefined) {
    env.coverage = true;
  }

  browsers = normalizeKarmaBrowsers(browsers);
  const browserLauncherPlugins: string[] = [];

  // Add the browser launcher plugins based on the browsers that are requested
  if (browsers.some(b => b === 'Chrome' || b === 'ChromeHeadless')) {
    browserLauncherPlugins.push(karmaChromeLauncher);
  }
  if (browsers.some(b => b === 'Firefox')) {
    browserLauncherPlugins.push(karmaFirefoxLauncher);
  }

  const options: IKarmaOptions = {
    basePath: config.context.paths.rootDir,
    frameworks: ['jasmine', 'webpack'],
    plugins: [
      karmaJasmine,
      karmaWebpack,
      karmaSourcemapLoader,
      karmaSpecReporter,
      karmaJasmineHtmlReporter,
      karmaHTML2JSPreprocess,
      karmaJasmineOrderReporter,
      ...browserLauncherPlugins
    ],
    files,
    client: {
      clearContext: false,
      jasmine: {
        random: true,
        stopOnSpecFailure: env.ci || env.stopOnSpecFailure
      }
    } as any,
    exclude: [],
    preprocessors,
    reporters: ['spec', 'kjhtml', 'jasmine-order'],
    browsers: env.sandbox ? browsers : ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox']
      }
    },
    port: env.port || 9876,
    logLevel: constants.LOG_ERROR,
    singleRun: env.ci || singleRun
  };

  // Check if we were provided a specific seed to run our random tests with
  if (typeof env.seed === 'number') {
    (options.client as any).jasmine.seed = `${env.seed}`;
  }

  // Webpack configuration
  const webpackConfig = createKarmaWebpackConfig(config);
  options.webpack = webpackConfig;

  // Webpack dev server configuration
  options.webpackMiddleware = {
    stats: 'errors-only',
    logLevel: 'error'
  };

  // Add additional options if requiring code coverage
  if (env.coverage) {
    const defaultExcludeRegex = /(node_modules|\.spec\.ts$)/;
    const separator = sep === '/' ? '\/' : '\\\\';

    // Adjust the webpack config rules to instrument the TypeScript files
    options.webpack.module.rules.push({
      test: /\.ts$/,
      use: {
        loader: 'istanbul-instrumenter-loader',
        options: { esModules: true }
      },
      enforce: 'post',
      // If we aren't testing specific components, then we use the default exclusion regex. Otherwise, we need
      // to exclude all files that don't match the component(s) we are testing.
      exclude: !env.components || !env.components.length ? defaultExcludeRegex : modulePath => {
        const componentExclusions = (env.components as string[]).map(componentName => new RegExp(`^((?!${config.context.srcDirName}${separator}${config.context.libDirName}${separator}${componentName}).)*$`));
        return defaultExcludeRegex.test(modulePath) || componentExclusions.every(regex => regex.test(modulePath));
      }
    });

    // Add the coverage plugin for karma
    options.plugins?.push(karmaCoverageIstanbulReporter);

    // Add the coverage reporter
    options.reporters?.push('coverage-istanbul');

    // Add the coverage reporter configuration
    options.coverageIstanbulReporter = {
      reports: ['html', 'text-summary', 'lcovonly'],
      dir: `${config.context.distDirName}/coverage`,
      combineBrowserReports: true,
      fixWebpackSourcePaths: true,
      skipFilesWithNoCoverage: true,
      'report-config': {
        html: {
          subdir: 'html'
        }
      }
    };

    // Set defaults for thresholds
    options.coverageIstanbulReporter.thresholds = {};

    // Check for coverage thresholds from project config
    if (config.context.karma.coverageThreshold) {
      options.coverageIstanbulReporter.thresholds.global = config.context.karma.coverageThreshold;
    }
  }

  // Set options for the spec reporter
  options.specReporter = {
    showSpecTiming: true,               // Print the time elapsed for each spec
    maxLogLines: 5                      // limit number of lines logged per test
  };

  // Check for any custom karma configuration options
  if (config.context.karma) {
    // Check if any additional files need to be added
    if (config.context.karma.files && config.context.karma.files instanceof Array && config.context.karma.files.length) {
      for (const file of config.context.karma.files.reverse()) {
        files.unshift(file);
      }
    }

    // Check if any global stylesheets need to be included
    if (Array.isArray(config.context.karma.stylesheets) && config.context.karma.stylesheets.length) {
      // We need to include the karma scss processor for compiling any stylesheets
      options.plugins?.push(sassPreprocessor as any);

      // Set options for the karma sass processor plugin
      options.scssPreprocessor = {
        options: {
          implementation: 'sass',
          includePaths: ['node_modules']
        }
      };

      // Add each stylesheet to the files and preprocessors configuration
      for (const stylesheet of config.context.karma.stylesheets) {
        files.push(stylesheet);
        preprocessors[stylesheet] = ['scss'];
      }
    }

    // Check if any files are to be excluded
    if (config.context.karma.exclude && config.context.karma.exclude instanceof Array && config.context.karma.exclude.length) {
      options.exclude = options.exclude?.concat(config.context.karma.exclude);
    }
  }

  return options;
}

/**
 * Starts the Karma test server.
 * @param options The Karma configuration.
 */
export async function startKarma(options: ConfigOptions): Promise<number> {
  if (options.browsers) {
    Logger.info(`Browser: ${options.browsers.join(', ')}`);
  }

  const jasmineConfig = (options.client as any).jasmine;
  if (jasmineConfig && jasmineConfig.random && jasmineConfig.seed) {
    Logger.info(`Seed: ${jasmineConfig.seed}`);
  }

  return new Promise<number>(resolve => {
    const server = new Server(options, exitCode => resolve(exitCode));
    server.start();
  });
}

/**
 * Normalizes the testing brower names for Karma plugins.
 * @param browsers The raw browser options.
 */
function normalizeKarmaBrowsers(browsers: string | string[]): string[] {
  if (browsers && typeof browsers === 'string') {
    browsers = [browsers];
  }

  if (!browsers || !(browsers instanceof Array) || !browsers.length) {
    return ['ChromeHeadless'];
  }

  // Ensure proper casing for browser launcher plugins
  return browsers.map(b => {
    switch (b.trim().toLowerCase()) {
      case 'chrome':
        return 'Chrome';
      case 'firefox':
        return 'Firefox';
      case 'edge':
        return 'Edge';
    }
  }) as string[];
}

function createKarmaWebpackConfig(cliConfig: IConfig): Configuration {
  const cliNodeModules = findUp('node_modules', fileURLToPath(import.meta.url));
  const tsconfigPath = absolutify('src/tsconfig-test.json', cliConfig.context.paths.rootDir);

  // Generate the webpack configuration.
  // Note: we do not provide an `entry` property because karma-webpack will set that for us.
  const config: Configuration = {
    mode: 'development',
    cache: true,
    resolve: {
      extensions: ['.ts', '.js'],
      plugins: [
        // This plugin is required for using paths from tsconfig
        new TsconfigPathsPlugin({ configFile: tsconfigPath })
      ]
    },
    resolveLoader: {
      modules: [
        pathResolve(cliConfig.context.paths.rootDir, 'node_modules')
      ]
    },
    devtool: false, // Leave false because SourceMapDevToolPlugin will handle inline source maps for us
    optimization: {
      concatenateModules: true,
      usedExports: true,
      sideEffects: true,
      providedExports: true,
      splitChunks: false // fixes source maps until https://github.com/ryanclark/karma-webpack/issues/493 is resolved
    },
    module: {
      rules: [
        {
          test: /\.m?js/, // fix:issue: https://github.com/webpack/webpack/issues/11467
          resolve: {
            fullySpecified: false,
          }
        },
        {
          test: /\.js$/,
          use: ['source-map-loader'],
          enforce: 'pre',
          exclude: [/node_modules/]
        },
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: tsconfigPath
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
                webpackImporter: cliConfig.context.build.webpack.sassLoader.webpackImporter,
                implementation: sass,
                sassOptions: {
                  includePaths: [absolutify('node_modules', cliConfig.context.paths.rootDir)],
                  ...cliConfig.context.build.sassOptions
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
      new SourceMapDevToolPlugin({
        filename: null,
        test: /\.(ts|js)($|\?)/i
      })
    ]
  };

  // Tells webpack to look in the node_modules for the CLI instead of the consuming project
  if (cliNodeModules) {
    config.resolveLoader?.modules?.splice(0, 0, cliNodeModules);
  }

  return config;
}
