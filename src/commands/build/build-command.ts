import { formatHrTime, loadPackageJson, Logger } from '@tylertech/forge-build-tools';
import { join } from 'canonical-path';
import chalk from 'chalk';
import { FULL_BUILD_DIR_NAME, TEMP_BUILD_DIR_NAME } from '../../constants';
import { ICommand, ICommandOption, ICommandParameter } from '../../core/command';
import { cleanup, IBuildTaskConfiguration, lintTask } from '../../utils/build-utils';
import { assertBoolean, getTimeStamp } from '../../utils/utils';
import { build, copyBundledDistributionAssets, createDistributionPackage, prebuild } from './build-command-utils';

/** The command definition for the main library build. */
export class BuildCommand implements ICommand {
  public name = 'build';
  public alias = 'b';
  public description = 'Builds an npm package from the entire component project.';
  public subCommands: ICommand[] = [];
  public options: ICommandOption[] = [
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
  const packageJson = loadPackageJson(config.paths.rootDir);
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
