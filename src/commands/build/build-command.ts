import { formatHrTime, Logger } from '@tylertech/forge-build-tools';
import cpath from 'canonical-path';
import chalk from 'chalk';
import { FULL_BUILD_DIR_NAME, TEMP_BUILD_DIR_NAME } from '../../constants.js';
import { ICommand, ICommandOption, ICommandParameter } from '../../core/command.js';
import { cleanup, IBuildTaskConfiguration, lintTask } from '../../utils/build-utils.js';
import { assertBoolean, getTimeStamp, loadPackageJson } from '../../utils/utils.js';
import { build, copyBundledDistributionAssets, createDistributionPackage, prebuild } from './build-command-utils.js';

const { join } = cpath;

/** The command definition for the main library build. */
export class BuildCommand implements ICommand {
  public name = 'build';
  public alias = 'b';
  public description = 'Builds an npm package from the entire component project.';
  public subCommands: ICommand[] = [];
  public options: ICommandOption[] = [
    {
      name: 'lint',
      type: Boolean,
      description: 'Controls whether the lint task is run or not.',
      defaultValue: 'true'
    }
  ];

  public async run(param: ICommandParameter): Promise<void> {
    const ctx: IBuildTaskConfiguration = {
      context: param.config.context,
      paths: param.config.context.paths,
      packageName: param.config.context.packageName,
      cwd: param.config.cwd,
      args: param.args
    };

    const start = process.hrtime();
    Logger.info(`[${getTimeStamp()}] Build started...\n`);

    await buildCommand(ctx);

    const elapsed = process.hrtime(start);
    Logger.newline();
    Logger.success(`[${getTimeStamp()}] Build complete ${chalk.dim(`in ${formatHrTime(elapsed)}`)}`);
  }
}


/**
 * Builds the full library of components by bundling and creating an npm package.
 * @param {IConfig} config The environment configuration.
 */
export async function buildCommand(config: IBuildTaskConfiguration): Promise<void> {
  const buildRoot = join(config.context.paths.distBuildDir, FULL_BUILD_DIR_NAME);
  const buildOutputDir = join(buildRoot, TEMP_BUILD_DIR_NAME);
  const srcDir = config.context.paths.libDir;
  const packageJson = await loadPackageJson(config.paths.rootDir);
  const lintCode = assertBoolean(config.args.lint, true);
  
  if (lintCode) {
    await lintTask(config.context.paths.libDir, config.context.paths.stylelintConfigPath, true, config.quiet);
  }

  await prebuild({ buildRoot, buildDir: buildRoot, buildOutputDir, srcDir, quiet: config.quiet });
  await build({ config, buildOutputDir, quiet: config.quiet });
  await createDistributionPackage({ config, packageJson, buildOutputDir });

  if (config.context.build.static.enabled) {
    await copyBundledDistributionAssets({ config, packageJson, buildOutputDir });
  }
  
  await cleanup(buildOutputDir, config.quiet);
}
