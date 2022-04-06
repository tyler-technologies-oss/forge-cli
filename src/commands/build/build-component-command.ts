import { formatHrTime, Logger } from '@tylertech/forge-build-tools';
import chalk from 'chalk';

import { ICommand, ICommandParameter, ICommandArg, ICommandOption } from '../../core/command';
import { getTimeStamp } from '../../utils/utils';
import { buildComponent, IBuildTaskConfiguration } from '../../utils/build-utils';


/**
 * The command definition for building an individual component package.
 */
export class BuildComponentCommand implements ICommand {
  public name = 'component';
  public alias = 'c';
  public description = 'Builds an npm package for a specific component package.';
  public args: ICommandArg[] = [
    {
      name: 'component',
      type: 'string',
      description: 'The component name to build.',
      required: true
    }
  ];
  public options: ICommandOption[] = [
    {
      name: 'cleancss',
      type: Boolean,
      description: 'Removes all unused selectors from the component CSS files.',
      defaultValue: 'false'
    }
  ];

  public validator(param: ICommandParameter): string | undefined {
    return !param.args._[2] ? 'You must provide a component name.' : undefined;
  }

  public async run(param: ICommandParameter): Promise<void> {
    const ctx: IBuildTaskConfiguration = {
      context: param.config.context,
      paths: param.config.context.paths,
      packageName: param.config.context.packageName,
      cwd: param.config.cwd,
      args: param.args
    };
    await buildComponentCommand(ctx, param.args._[2]);
  }
}

/**
 * Builds a specific component by bundling and creating an npm package.
 * @param {IConfig} config The environment configuration.
 * @param {string} componentName The component name.
 */
export async function buildComponentCommand(ctx: IBuildTaskConfiguration, componentName: string): Promise<void> {
  const start = process.hrtime();
  Logger.info(`[${getTimeStamp()}] Build ${componentName} started...\n`);

  await buildComponent(ctx, componentName);


  const elapsed = process.hrtime(start);
  Logger.newline();
  Logger.success(`[${getTimeStamp()}] Build ${componentName} complete ${chalk.dim(`in ${formatHrTime(elapsed)}`)}`);
}
