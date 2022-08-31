import { formatHrTime, Logger } from '@tylertech/forge-build-tools';
import chalk from 'chalk';
import { ICommand, ICommandOption, ICommandParameter } from '../../core/command';
import { generateCustomElementsManifest } from '../../utils/manifest-utils';
import { getTimeStamp } from '../../utils/utils';

/** The command definition for generating a custom elements manifest. */
export class CustomElementsManifestCommand implements ICommand {
  public name = 'custom-elements-manifest';
  public alias = 'cem';
  public description = 'Generates a Custom Elements Manifest for the project.';
  public options: ICommandOption[] = [
    {
      name: 'config',
      type: String,
      description: 'The path to a custom config file.  Will override any project-level configuration.'
    }
  ];

  public async run(param: ICommandParameter): Promise<void> {
    const start = process.hrtime();
    Logger.info(`[${getTimeStamp()}] Custom Elements Manifest generation started...`);

    await generateCustomElementsManifest(param.config.context, param.config.cwd, param.args.config);

    const elapsed = process.hrtime(start);

    Logger.success(`[${getTimeStamp()}] Created Custom Elements Manifest in ${chalk.dim(`in ${formatHrTime(elapsed)}`)}`);
  }
}
