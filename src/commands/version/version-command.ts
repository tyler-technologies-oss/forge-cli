import { ParsedArgs } from 'minimist';

import { ICommand, ICommandParameter } from '../../core/command.js';
import { Logger } from '@tylertech/forge-build-tools';

/**
 * The command definition for the version command. Prints the current CLI version.
 */
export class VersionCommand implements ICommand {
  public name = 'version';
  public alias = 'v';
  public description = 'Prints the current CLI version.';
  public usagePrivate = true;

  public matcher(args: ParsedArgs): boolean {
    return args._.length === 0 && args.version || args.v;
  }

  public async run(param: ICommandParameter): Promise<void> {
    Logger.print(param.config.cli.package.version);
  }
}
