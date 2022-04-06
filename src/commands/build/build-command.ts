import { cleanFiles, copyFilesMultiple, formatHrTime, getDirectories, IFileCopyConfig, loadPackageJson, logError, Logger, runTask } from '@tylertech/forge-build-tools';
import { basename, join, resolve as pathResolve } from 'canonical-path';
import chalk from 'chalk';
import { IBuildWorkerContext } from 'src/workers/build-component-worker';
import { BUNDLE_OUTPUT_DIR_NAME, FULL_BUILD_DIR_NAME, TEMP_BUILD_DIR_NAME } from '../../constants';
import { ICommand, ICommandOption, ICommandParameter } from '../../core/command';
import { cleanup, createNpmPackage, generatePackageBundles, IBuildTaskConfiguration, lintTask, prepareBuildDirectory } from '../../utils/build-utils';
import { assertBoolean, coerceBoolean, getTimeStamp } from '../../utils/utils';
import { WorkerPool } from '../../utils/worker-pool';
import { BuildComponentCommand } from './build-component-command';
import { BuildStyleSheetCommand } from './build-stylesheet-command';

/**
 * The command definition for the main library build.
 */
export class BuildCommand implements ICommand {
  public name = 'build';
  public alias = 'b';
  public description = 'Builds an npm package from the entire component project. To view the available sub-commands type `forge help build`.';
  public subCommands = [
    new BuildComponentCommand(),
    new BuildStyleSheetCommand()
  ];
  public options: ICommandOption[] = [
    {
      name: 'all',
      type: Boolean,
      description: 'Builds all individual component packages.',
      defaultValue: 'false'
    },
    {
      name: 'threads',
      type: Number,
      description: 'The number of threads to use when building multiple components.',
      defaultValue: undefined
    },
    {
      name: 'cleancss',
      type: Boolean,
      description: 'Removes all unused selectors from component CSS files.',
      defaultValue: 'false'
    },
    {
      name: 'lint',
      type: Boolean,
      description: 'Controls whether the lint task is run or not.',
      defaultValue: 'true'
    }
  ];

  public async run(param: ICommandParameter): Promise<void> {
    const buildAll = coerceBoolean(param.args.all);
    const ctx: IBuildTaskConfiguration = {
      context: param.config.context,
      paths: param.config.context.paths,
      packageName: param.config.context.packageName,
      cwd: param.config.cwd,
      args: param.args
    };

    const start = process.hrtime();
    Logger.info(`[${getTimeStamp()}] Build started...\n`);

    if (buildAll) {
      await runTask('Building full package...', () => buildCommand({ ...ctx, quiet: true }));
    } else {
      await buildCommand(ctx);
    }

    if (buildAll) {
      const componentDirectories = getDirectories(param.config.context.paths.libDir).map(dir => basename(dir)); // Must be just the directory names, not paths
      if (componentDirectories.length) {
        // eslint-disable-next-line arrow-body-style
        await runTask(`Building individual components... (this may take a while)`, () => {
          return buildComponents(ctx, componentDirectories);
        });
      }
    }

    const elapsed = process.hrtime(start);

    Logger.newline();
    Logger.success(`[${getTimeStamp()}] Build complete ${chalk.dim(`in ${formatHrTime(elapsed)}`)}`);
  }
}

async function buildComponents(ctx: IBuildTaskConfiguration, componentDirectories: string[]): Promise<void> {
  const workerPath = pathResolve(__dirname, '../../workers/build-component-worker.js');
  const workerPool = new WorkerPool(workerPath, ctx.args.threads);
  const workerTasks: Promise<void>[] = [];

  try {
    for (const componentName of componentDirectories) {
      const workerData: IBuildWorkerContext = {
        componentName,
        taskContext: { ...ctx, quiet: true }
      };
      workerTasks.push(new Promise<void>(resolve => {
        workerPool.runTask(workerData, resolve);
      }));
    }

    await Promise.all(workerTasks);
  } catch (e) {
    logError(e);
  }
  
  workerPool.destroy();
}


/**
 * Builds the full library of components by bundling and creating an npm package.
 * @param {IConfig} config The environment configuration.
 */
export async function buildCommand(ctx: IBuildTaskConfiguration): Promise<void> {
  const buildRoot = join(ctx.context.paths.distBuildDir, FULL_BUILD_DIR_NAME);
  const buildOutputDir = join(buildRoot, TEMP_BUILD_DIR_NAME);
  const bundleOutputDir = join(buildRoot, BUNDLE_OUTPUT_DIR_NAME);
  const srcDir = ctx.context.paths.libDir;
  const packageJson = loadPackageJson(srcDir);
  const packageName = ctx.context.packageName;
  const releaseDir = join(ctx.context.paths.distReleaseDir, packageJson.name);
  const lintCode = assertBoolean(ctx.args.lint, true);
  
  if (lintCode) {
    await lintTask(ctx.context.paths.libDir, ctx.context.paths.stylelintConfigPath, true, ctx.quiet);
  }

  await prepareBuildDirectory(buildRoot, releaseDir, buildRoot, buildOutputDir, bundleOutputDir, ctx.quiet);
  await generatePackageBundles(ctx, srcDir, buildOutputDir, bundleOutputDir, packageName, ctx.context.libDirName);
  await createNpmPackage(ctx, packageJson.name, buildOutputDir, bundleOutputDir, ctx.context.paths.libDir);
  await copyStaticDistributionAssets(ctx, packageJson.name, packageJson.version);
  await cleanup(buildOutputDir, ctx.quiet);
}

/** Copies assets from the package dist directory to the static distribution directory. */
async function copyStaticDistributionAssets(config: IBuildTaskConfiguration, packageName: string, packageVersion: string): Promise<void> {
  return runTask('Copying static distribution assets...', async () => {
    const releaseRootDir = join(config.paths.distReleaseDir, packageName);
    const releaseDistDir = join(releaseRootDir, 'dist');
    const distOutputDir = join(config.paths.distDir, config.context.build.static.distPath, packageName, packageVersion);

    // Remove all previous files at the root before copying new files
    await cleanFiles(join(distOutputDir, '*.*'));

    const fileConfigs: IFileCopyConfig[] = [
      { path: join(releaseDistDir, '*.?(m)js*'), outputPath: distOutputDir },
      { path: join(releaseDistDir, '*.css'), outputPath: distOutputDir }
    ];
    await copyFilesMultiple(fileConfigs);
  }, config.quiet);
}
