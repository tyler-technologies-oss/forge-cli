import chalk from 'chalk';

import { ICommandParameter, ICommand } from '../../core/command';
import { GenerateComponentCommand } from './generate-component-command';

/**
 * The command definition for the generate command. This command doesn't do anything interesting
 * on its own, but acts as parent to sub-commands.
 */
export class GenerateCommand implements ICommand {
  public name = 'generate';
  public alias = 'g';
  public description = 'To view the available sub-commands type `forge help generate`.';
  public subCommands: ICommand[] = [
    new GenerateComponentCommand()
  ];

  public async run(param: ICommandParameter): Promise<void> {
    // We run the serve generate component by default when running this command
    const generateComponentCommand = this.subCommands.find(c => c instanceof GenerateComponentCommand) as ICommand;
    generateComponentCommand.run(param);
  }
}
