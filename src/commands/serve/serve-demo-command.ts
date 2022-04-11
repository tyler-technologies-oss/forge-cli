import { absolutify, camelCase, existsAsync, Logger, OS } from '@tylertech/forge-build-tools';
import * as bs from 'browser-sync';
import chalk from 'chalk';
import webpack from 'webpack';
import { ICommand, ICommandOption, ICommandParameter } from '../../core/command';
import { IConfig, IGlobalOptions } from '../../core/definitions';
import { findClosestOpenPort } from '../../utils/network';
import { assertBoolean } from '../../utils/utils';
import { getWebpackConfigurationFactory, IWebpackEnv } from '../../utils/webpack';
import { buildStyleSheetTask } from '../build/build-stylesheet-command';

const uppercamelcase = require('uppercamelcase');

export const DEFAULT_DEV_SERVER_HOST = 'localhost';
export const DEFAULT_DEV_SERVER_PORT = 9000;

export interface IServeDemoCommandOptions extends IGlobalOptions {
  prod: boolean;
  host: string;
  port: number | null;
  components: boolean;
  browser: string;
  open: boolean;
  path: string;
}

/**
 * The command definition for the serve demo command.
 */
export class ServeDemoCommand implements ICommand {
  public name = 'demo';
  public alias = 'd';
  public description = 'Serves the development demo website.';
  public options: ICommandOption[] = [
    {
      name: 'prod',
      type: String,
      description: 'Runs the dev site in production mode.'
    },
    {
      name: 'host',
      type: String,
      description: 'The hostname to serve the dev site under.'
    },
    {
      name: 'port',
      type: Number,
      description: 'The port to run the dev server on.'
    },
    {
      name: 'components',
      type: String,
      description: 'Includes each individual component bundle in the output.'
    },
    {
      name: 'browser',
      type: String,
      description: 'The browser to run the dev server in.'
    },
    {
      name: 'open',
      type: Boolean,
      description: 'Controls whether the browser will open automatically or not (defaults to true)',
      defaultValue: 'true'
    },
    {
      name: 'path',
      type: String,
      description: 'The path to serve from the root of the dev server.'
    }
  ];

  public async run(param: ICommandParameter): Promise<void> {
    const options: IServeDemoCommandOptions = {
      prod: assertBoolean(param.args.prod),
      host: param.args.host,
      port: param.args.port ? +param.args.port : null,
      components: assertBoolean(param.args.components),
      browser: param.args.browser,
      open: assertBoolean(param.args.open, true),
      path: param.args.path
    };
    await serveCommand(param.config, options);
  }
}

/**
 * Serves the component demo website.
 * @param {IConfig} config The context configuration.
 * @param {IServeCommandOptions} options The command options.
 */
export async function serveCommand(config: IConfig, options: IServeDemoCommandOptions): Promise<void> {
  const { libDir, distStylesDir } = config.context.paths;
  await buildStyleSheetTask(libDir, distStylesDir);
  await serveDemoWebsite(config, options);
}

async function serveDemoWebsite(config: IConfig, options: IServeDemoCommandOptions): Promise<void> {
  const mode = options.prod ? 'production' : 'development';
  const host = options.host || DEFAULT_DEV_SERVER_HOST;
  const port = options.port || await findClosestOpenPort(DEFAULT_DEV_SERVER_PORT, host);
  const path = options.path || `${config.context.srcDirName}/${config.context.demoDirName}`;
  const openbrowser = getBrowser(options.browser, config.os, host, port, path);

  const browser = await initBrowser(config, path, port, host, openbrowser, options.open, !!options.verbose);
  await startWebpack(config, mode, browser);
}

/**
 * Creates a new browser instance.
 * @param config The environment configuration.
 * @param startPath The path to open the browser to. Relative to `baseDir`.
 * @param port The port to serve the site on.
 * @param host The hostname to serve the site with.
 * @param browser The browser to open.
 * @param verbose Show verbose output.
 */
async function initBrowser(config: IConfig, startPath: string, port: number, host: string, browser: string, open: boolean, verbose: boolean): Promise<bs.BrowserSyncInstance> {
  const instance = bs.create();
  instance.init(
    {
      server: {
        baseDir: config.context.paths.rootDir
      },
      startPath,
      port: port || await findClosestOpenPort(DEFAULT_DEV_SERVER_PORT, host),
      notify: false,
      ghostMode: false,
      logLevel: verbose ? 'info' : 'silent',
      browser,
      host,
      open: open === false ? false : host !== DEFAULT_DEV_SERVER_HOST ? 'external' : true,
      files: [
        `${config.context.srcDirName}/${config.context.demoDirName}/**/*`,
        {
          match: [`${config.context.srcDirName}/${config.context.libDirName}/**/*.scss`],
          fn: async (event, file) => {
            // Needed to delay due to chokidar holding on to the file at times...
            setTimeout(async () => {
              const { libDir, distStylesDir } = config.context.paths;
              await buildStyleSheetTask(libDir, distStylesDir);
              instance.reload();
            }, 1500);
          }
        }
      ]
    },
    () => {
      const url = instance.getOption('urls').get('local');
      Logger.info(`Serving demo website at: ${chalk.yellow(url)}`);
    }
  );
  return instance;
}

/**
 * Starts webpack in watch mode and refreshes the broswer when a new file is emitted.
 * @param config The CLI environment configuration.
 * @param mode The webpack mode.
 * @param browser The browser-sync instance.
 */
async function startWebpack(config: IConfig, mode: 'production' | 'development', browser: bs.BrowserSyncInstance): Promise<void> {
  const webpackConfigFactory = getWebpackConfigurationFactory();
  const tsconfigPath = absolutify(config.context.build.tsconfigPath, config.context.paths.rootDir);

  if (!await existsAsync(tsconfigPath)) {
    throw new Error(`Invalid tsconfig path specified for build configuration: ${tsconfigPath}`);
  }

  const env: IWebpackEnv = {
    root: config.context.paths.rootDir,
    mode,
    tsconfigPath,
    cache: true,
    entry: {
      [config.context.libDirName]: `./${config.context.srcDirName}/${config.context.libDirName}/index.ts`
    },
    outputDir: `${config.context.distDirName}/build`,
    clean: false,
    beautify: true,
    minify: false,
    devtool: config.context.build.webpack.devtool,
    externals: config.context.build.webpack.externals,
    fileNamePrefix: config.context.build.webpack.filename || config.context.packageName,
    globalVariableName: [config.context.build.webpack.variableName || uppercamelcase(config.context.packageName), config.context.libDirName],
    sassLoaderWebpackImporter: config.context.build.webpack.sassLoader.webpackImporter
  };

  if (config.context.build && config.context.build.demo && config.context.build.demo.componentBundles) {
    config.context.build.demo.componentBundles.forEach(path => {
      env.entry[path] = `./${config.context.srcDirName}/${config.context.libDirName}/${path}/index.ts`;
    });
  }

  const compiler = webpack(webpackConfigFactory(env));
  compiler.hooks.watchRun.tap('forge', () => Logger.info('Bundle started...'));
  compiler.hooks.afterEmit.tap('forge', () => {
    Logger.info('Bundle complete.');
    if (browser) {
      browser.reload();
    }
  });
  compiler.watch({}, (err, stats) => {
    if (stats) {
      if (stats.hasErrors()) {
        const errors = stats.toString('errors-only');
        return Logger.error(`Bundle website failed: ${chalk.red(errors)}`);
      }
      Logger.newline();
      Logger.print(stats.toString({ colors: true }));
    }
  });
}

/**
 * Returns the correct browser name based on the provided variation.
 * @param browser The browser variation string
 * @param os The current OS.
 * @param host The hostname.
 * @param port The port.
 * @param path The path to the application.
 */
function getBrowser(browser: string, os: OS, host: string, port: number, path: string): string {
  browser = (browser || '').trim();

  // Normalize the browser names for ease of use...
  if (browser === 'edge' || browser === 'microsoft-edge') {
    browser = `microsoft-edge:http://${host}:${port}/${path}`;
  } else if (browser === 'ie' || browser === 'iexplore') {
    browser = 'iexplore';
  } else if (browser === 'chrome' || browser === 'google-chrome' || browser === 'google chrome') {
    switch (os) {
      case OS.Windows:
        browser = 'chrome';
        break;
      case OS.Linux:
        browser = 'google-chrome';
        break;
      case OS.Mac:
        browser = 'google chrome';
        break;
    }
  }

  return browser;
}
