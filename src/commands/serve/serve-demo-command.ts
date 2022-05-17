import { absolutify, compileSass, existsAsync, logError, Logger, OS, runTask } from '@tylertech/forge-build-tools';
import * as bs from 'browser-sync';
import { join } from 'canonical-path';
import chalk from 'chalk';
import webpack from 'webpack';
import { ICommand, ICommandOption, ICommandParameter } from '../../core/command';
import { IConfig, IGlobalOptions } from '../../core/definitions';
import { assertBoolean, getTimeStamp } from '../../utils/utils';
import { getWebpackConfigurationFactory, IWebpackEnv } from '../../utils/webpack';

const uppercamelcase = require('uppercamelcase');

export const DEFAULT_DEV_SERVER_HOST = 'localhost';
export const DEFAULT_DEV_SERVER_PORT = 9000;

export interface IServeDemoCommandOptions extends IGlobalOptions {
  dev: boolean;
  host: string;
  port: number | null;
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
      name: 'dev',
      type: String,
      description: 'Runs the demo site in development mode.'
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
      dev: assertBoolean(param.args.dev),
      host: param.args.host,
      port: param.args.port ? +param.args.port : null,
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
  const mode = options.dev ? 'development' : 'production';
  const host = options.host || DEFAULT_DEV_SERVER_HOST;
  const port = options.port || undefined;
  const path = options.path || `${config.context.srcDirName}/${config.context.demoDirName}`;
  const browser = await initBrowser(config, path, port, host, options.open, !!options.verbose);
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
async function initBrowser(config: IConfig, startPath: string, port: number | undefined = undefined, host: string, open: boolean, verbose: boolean): Promise<bs.BrowserSyncInstance> {
  const instance = bs.create();
  instance.init(
    {
      server: {
        baseDir: config.context.paths.rootDir
      },
      startPath,
      notify: false,
      ghostMode: false,
      logLevel: verbose ? 'info' : 'silent',
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
      const url = instance.getOption('urls')?.get(host === DEFAULT_DEV_SERVER_HOST ? 'local' : 'external');
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
    beautify: false,
    minify: mode === 'production',
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

export async function buildStyleSheetTask(libDir: string, distStylesDir: string): Promise<void> {
  return runTask(`[${getTimeStamp()}] Building StyleSheet...`, async () => {
    try {
      await compileSass(join(libDir, '*.scss'),  libDir, distStylesDir);
    } catch (e) {
      logError('Sass error: ' + e.message);
    }
  });
}
