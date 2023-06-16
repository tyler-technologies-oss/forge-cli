import { ICommand, ICommandParameter } from '../../core/command.js';
import { ServeCoverageCommand } from './serve-coverage-command.js';
import { ServeDemoCommand } from './serve-demo-command.js';

/**
 * The command definition for the `serve` command.
 */
export class ServeCommand implements ICommand {
  public name = 'serve';
  public alias = 's';
  public description = 'This is an alias to `forge serve demo`. It acts as a parent command to all sub-commands related serving.';
  public subCommands = [
    new ServeDemoCommand(),
    new ServeCoverageCommand()
  ];

  public async run(param: ICommandParameter): Promise<void> {
    // We run the serve demo command by default when running this command.
    const serveDemoCommand = this.subCommands.find(c => c instanceof ServeDemoCommand) as ICommand;
    serveDemoCommand.run(param);
  }
}
