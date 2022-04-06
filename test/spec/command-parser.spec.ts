import { ParsedArgs } from 'minimist';
import { deepCopy } from '@tylertech/forge-build-tools';

import { AVAILABLE_COMMANDS } from '../../src/core/cli';
import { CommandParser } from '../../src/core/command-parser';
import { createCommand, getMockConfiguration } from '../utils';
import { ICommand } from '../../src/core/command';

describe('CommandParser', () => {
  /**
   * This test will ensure that every available command is properly found via its name
   * and/or alias as well as any combo of using both. It checks all sub-commands as well.
   */
  it('should find all available commands', () => {
    AVAILABLE_COMMANDS.forEach(command => {
      ensureCommand(command, createCommand(command.name));

      if (command.alias) {
        if (typeof command.alias === 'string') {
          ensureCommand(command, createCommand(command.alias));
        } else if (command.alias.length) {
          command.alias.forEach(alias => {
            ensureCommand(command, createCommand(alias));
          });
        }
      }
    });
  });

  it('should properly handle invalid commands', () => {
    expect(CommandParser.findCommand(createCommand('INVALID_COMMAND'), AVAILABLE_COMMANDS)).toBeUndefined();
  });

  it('should throw when running invalid command', async () => {
    await expect(CommandParser.run(createCommand('INVALID_COMMAND'), getMockConfiguration())).rejects.toBeInstanceOf(Error);
  });

  it('should call command run method', async () => {
    const config = getMockConfiguration();
    const command = CommandParser.findCommand(createCommand('version'), config.commands) as ICommand;
    const spy = jest.spyOn(command, 'run');
    await CommandParser.run(createCommand('version'), config);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should find command using matcher', () => {
    const commands: ICommand[] = [
      { name: 'test', description: '', run: () => Promise.resolve(), matcher: args => parseInt(args._[1], 10) >= 10 }
    ];
    const command = CommandParser.findCommand(createCommand(['cmd', '10']), commands);
    expect(command).toBe(commands[0]);
  });

  it('should call command validator', async () => {
    const config = getMockConfiguration();    
    config.commands = [{ name: 'cmd', description: '', run: () => Promise.resolve(), validator: param => undefined }];
    const runSpy = jest.spyOn(config.commands[0], 'run');
    const validatorSpy = jest.spyOn(config.commands[0], 'validator');
    await CommandParser.run(createCommand('cmd'), config);
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(validatorSpy).toHaveBeenCalledTimes(1);
  });

  it('should not call command run method when validator fails', async () => {
    const config = getMockConfiguration();
    config.commands = [{ name: 'cmd', description: '', run: () => Promise.resolve(), validator: param => 'Some message' }];
    const runSpy = jest.spyOn(config.commands[0], 'run');
    await expect(CommandParser.run(createCommand('cmd'), config)).rejects.toBeInstanceOf(Error);
    expect(runSpy).toHaveBeenCalledTimes(0);
  });
});

function ensureCommand(command: ICommand, argv: ParsedArgs) {
  expect(command).toBe(CommandParser.findCommand(argv, AVAILABLE_COMMANDS));

  if (command.subCommands) {
    command.subCommands.forEach(subCommand => {
      const subArgv = deepCopy(argv) as ParsedArgs;
      subArgv._.push(subCommand.name);

      ensureCommand(subCommand, subArgv);

      if (subCommand.alias) {
        if (typeof subCommand.alias === 'string') {
          const aliasArgv = deepCopy(argv) as ParsedArgs;
          aliasArgv._.push(subCommand.alias);
          ensureCommand(subCommand, aliasArgv);
        } else if (subCommand.alias.length) {
          subCommand.alias.forEach(alias => {
            const aliasArgv = deepCopy(argv) as ParsedArgs;
            aliasArgv._.push(alias);
            ensureCommand(subCommand, aliasArgv);
          });
        }
      }
    });
  }
}
