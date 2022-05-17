import { IConfig } from './definitions';
import { ICommand } from './command';
import { ParsedArgs } from 'minimist';

const chalk = require('chalk');

export interface ICommandParameter {
  args: ParsedArgs;
  config: IConfig;
}

/**
 * Provides facilities for locating and executing a command definition.
 */
export class CommandParser {
  /**
   * Parses a specific command to locate the command, optionally validate, and then execute the command.
   * @param args 
   * @param config 
   */
  public static async run(args: ParsedArgs, config: IConfig): Promise<any> {
    // Locate the command within the command configuration
    const command: ICommand | undefined = CommandParser.findCommand(args, config.commands);

    if (!command) {
      throw new Error('Command not found. Run `forge help` for usage information.');
    }

    // If this command provides a validator function call it before execution
    if (command.validator && typeof command.validator === 'function') {
      const message = command.validator.call(null, { args, config });
      if (message) {
        throw new Error(message);
      }
    }

    // Run the command
    return command.run && typeof command.run === 'function' ? await command.run.call(command, { args, config } as ICommandParameter) : Promise.resolve();
  }

  /**
   * Locates a command definition within the command configuration.
   * @param {ParsedArgs} args The raw command arguments.
   * @param {ICliCommand[]} commands The list of commands.
   * @param {int} argsIndex The index of which command/sub-command is being processed.
   */
  public static findCommand(args: ParsedArgs, commands: ICommand[], argsIndex = 0): ICommand | undefined {
    const argCmd: string = args._[argsIndex];
    for (const cmd of commands) {
      if (CommandParser._matchesCommand(cmd, argCmd, args)) {
        if (args._.length > argsIndex + 1 && cmd.subCommands && cmd.subCommands.length) {
          const foundSubCommand = CommandParser.findCommand(args, cmd.subCommands, ++argsIndex);
          
          // If we didn't find a matching sub-command, the parent command may take args so we now need 
          // to assume that's the command the user wants. Validation of the commands' args is expected 
          // to handle invalid values at this point if the command is unwanted.
          if (!foundSubCommand && cmd.args) {
            return cmd;
          }

          return foundSubCommand;
        } else {
          return cmd;
        }
      }
    }
  }

  /**
   * Tests the provided command for a match against the arguments.
   * @param {ICliCommand} cmd The command to test.
   * @param {string} arg The current arg being processed.
   * @param {any} args The full list of arguments.
   */
  private static _matchesCommand(cmd: ICommand, arg: string, args: any): boolean {
    if (!cmd.matcher && !cmd.name) {
      throw new Error('A command or matcher or command name must be specified for all commands.');
    }

    if (cmd.matcher && typeof cmd.matcher === 'function' && cmd.matcher.call(null, args)) {
      return true;
    } else if ((cmd.name && arg === cmd.name) || (cmd.alias && CommandParser._matchesAlias(arg, cmd.alias))) {
      return true;
    }
    return false;
  }

  /**
   * Checks for a match against a command alias.
   * @param arg The command argument.
   * @param alias The alias or collection of aliases.
   */
  private static _matchesAlias(arg: string, alias: string | string[]): boolean {
    return (alias instanceof Array && alias.some(sc => sc === arg)) || (typeof alias === 'string' && arg === alias);
  }
}
