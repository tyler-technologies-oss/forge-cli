import chalk from 'chalk';
import commandLineUsage from 'command-line-usage';
import { ParsedArgs } from 'minimist';
import { Logger } from '@tylertech/forge-build-tools';

import { ICommand, ICommandParameter } from '../../core/command';
import { VersionCommand } from '../version/version-command';

const CLI_TITLE = 'Forge CLI';
const CLI_DESCRIPTION = 'The CLI utility for supporting Forge Web Component projects.';
const CLI_USAGE = 'Usage: \`forge [options ...] <command> [sub-command(s)] [options ...]\`';

const b = chalk.blue;
const g = chalk.green;

const HELP_HEADER = `
                            ${g('////\\\\')}                                     
                           ${g('(/////)')}                                       
                            ${g('\\\\////')}                                     
                      ${g('////\\\\')}                                           
                     ${g('(/////)')}                                             
                      ${g('\\\\////')}                                           
    ${b('////\\\\')}       ${g('////\\\\')}       ${g('////\\\\')}               ${chalk.bold.underline(CLI_TITLE)}
   ${b('(/////)')}     ${g('(/////)')}     ${g('(/////)')}                       
    ${b('\\\\////')}       ${g('\\\\////')}       ${g('\\\\////')}               ${CLI_DESCRIPTION}
          ${b('////\\\\')}                   ${g('////\\\\')}                    
         ${b('(/////)')}                 ${g('(/////)')}        ${chalk.yellow(CLI_USAGE)}
          ${b('\\\\////')}                   ${g('\\\\////')}                    
                ${b('////\\\\')}       ${b('////\\\\')}       ${g('////\\\\')}   
               ${b('(/////)')}     ${b('(/////)')}     ${g('(/////)')}           
                ${b('\\\\////')}       ${b('\\\\////')}       ${g('\\\\////')}   
                      ${b('////\\\\')}                                            
                     ${b('(/////)')}                                              
                      ${b('\\\\////')}                                            
                ${b('////\\\\')}                                                 
               ${b('(/////)')}                                                   
                ${b('\\\\////')}                                                 
`;

/**
 * The command definition for the `help` command.
 */
export class HelpCommand implements ICommand {
  public name = 'help';
  public alias = 'h';
  public description = 'Displays the help usage guide.';
  public usagePrivate = true;

  public async run(param: ICommandParameter): Promise<void> {
    const commandNames = param.args._.slice(1);
    const content = commandNames.length ? this._generateCommandUsage(commandNames, param.config.commands) : this._generateGeneralUsage(param.config.commands);
    return Logger.print(commandLineUsage(content));
  }

  public matcher(args: ParsedArgs): boolean {
    return !args.version && !args.v && (!args._.length || args._[0] === 'help' || args.h || args.help);
  }

  /**
   * Generates the full usage content.
   * @param commands The full list of available commands.
   */
  private _generateGeneralUsage(commands: ICommand[]): commandLineUsage.Section[] {
    const sortedCommands = commands.filter(c => !c.usagePrivate).sort(this._commandComparator);
    const availableCommands = this._getAvailableCommands(sortedCommands);

    return [
      {
        content: HELP_HEADER,
        raw: true
      },
      {
        header: chalk.bold('Available Commands'),
        content: availableCommands
      },
      {
        header: chalk.bold('Global Options'),
        optionList: [
          commands.find(c => c instanceof HelpCommand),
          commands.find(c => c instanceof VersionCommand),
          {
            name: 'quiet',
            alias: 'q',
            description: 'Skip prompts for user input. This requires all parameters to be specified as options/arguments.'
          },
          {
            name: 'verbose',
            description: 'Prints out detailed information for commands that support it.'
          }
        ]
      },
      {
        content: chalk.yellow('Run `forge help <command>` for help with a specific command.'),
        raw: true
      }
    ] as commandLineUsage.Section[];
  }

  /**
   * Generates the usage content for a specific command.
   * @param commandName The command name to print usage for.
   * @param commands The full list of commands.
   */
  private _generateCommandUsage(commandNames: string[], commands: ICommand[]): commandLineUsage.Section[] {
    const command: ICommand | undefined = this._findCommand(commandNames, commands);

    if (!command) {
      throw new Error('Invalid command name specified. This command does not exist.');
    }

    const usage: commandLineUsage.Section[] = [
      {
        header: `${chalk.green('forge')} ${chalk.blue(commandNames.join(' '))}` + (command.args ? ` ${chalk.yellow(command.args.filter(a => !!a.required).map(a => `[${a.name}]`).join(' '))}` : ''),
        content: command.description
      }
    ];

    if (command.alias) {
      usage.push({
        header: 'Alias: ' + (command.alias instanceof Array ? command.alias.join(', ') : command.alias)
      });
    }

    if (command.args) {
      usage.push({
        header: chalk.bold('Command Arguments'),
        content: command.args.map(arg => ({
          colA: arg.name,
          colB: arg.type,
          colC: arg.description
        }))
      });
    }

    if (command.options) {
      usage.push({
        header: chalk.bold('Command Options'),
        optionList: command.options
      });
    }

    if (command.subCommands && command.subCommands.length) {
      usage.push({
        header: chalk.bold('Sub-commands'),
        content: command.subCommands.filter(sc => !sc.usagePrivate).sort(this._commandComparator).map(this._commandToUsage)
      },
      {
        content: chalk.yellow('Run `forge help <command> <command> ...` for help with a specific sub-command.'),
        raw: true
      });
    }

    return usage;
  }

  private _commandComparator(curr: ICommand, prev: ICommand): number {
    if (curr.name < prev.name) {
      return -1;
    } else if (curr.name > prev.name) {
      return 1;
    }
    return 0;
  }

  private _findCommand(commandNames: string[], commands: ICommand[]): ICommand | undefined {
    if (!commands.length) {
      return;
    }

    const command = commands.find(c => c.name === commandNames[0]);

    if (!command) {
      return;
    }

    commandNames = commandNames.slice(1);

    if (!commandNames.length) {
      return command;
    }
    
    return this._findCommand(commandNames, command.subCommands || []);
  }

  private _commandToUsage(c: ICommand): any {
    return { name: c.name, summary: c.description };
  }

  /**
   * Recursively finds all available sub-commands for the usage.
   * @param commands 
   * @param cmdStr 
   */
  private _getAvailableCommands(commands: ICommand[], cmdStr = ''): any[] {
    let usage: any[] = [];

    for (const command of commands) {
      const name = `${cmdStr} ${command.name}`;
      usage.push({
        name,
        description: command.description
      });
      if (command.subCommands) {
        usage = usage.concat(...this._getAvailableCommands(command.subCommands.filter(sc => !sc.usagePrivate).sort(this._commandComparator), name));
      }
    }

    return usage;
  }
}
