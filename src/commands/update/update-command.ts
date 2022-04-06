import { ICommand, ICommandParameter, ICommandOption } from '../../core/command';
import { isOutdated, assertBoolean } from '../../utils/utils';
import { Logger, runTask, runCommand } from '@tylertech/forge-build-tools';

/**
 * The command definition for the `update` command.
 */
export class UpdateCommand implements ICommand {
  public name = 'update';
  public alias = 'u';
  public description = 'Updates the CLI to the latest version.';
  public options: ICommandOption[] = [
    {
      name: 'force',
      type: Boolean,
      description: 'Forces the package to update regardless of current version.',
      defaultValue: 'false'
    }
  ];

  public async run(param: ICommandParameter): Promise<void> {
    const force = assertBoolean(param.args.force);
    const registry = param.config.getPackageRegistry();
    if (force || await isOutdated(param.config.cli.package.name, registry, param.config.cli.package.version)) {
      await runTask('Updating CLI (this may take a few minutes)...', async () => {
        await runCommand(`npm install -g ${param.config.cli.package.name}@latest ${registry ? `--registry ${registry}` : ''}`, undefined, false);
      });
    } else {
      Logger.info('Already up to date.');
    }
  }
}
