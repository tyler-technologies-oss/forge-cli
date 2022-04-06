import { captureLog, createCommand } from '../utils';
import { CommandParser } from '../../src/core/command-parser';
import { AVAILABLE_COMMANDS } from '../../src/core/cli';
import { ICommandParameter } from '../../src/core/command';
import { VersionCommand } from '../../src/commands/version/version-command';

describe('VersionCommand', () => {
  it('should find version command via alias', () => {
    const argv = createCommand('', { v: true });
    const command = CommandParser.findCommand(argv, AVAILABLE_COMMANDS);
    expect(command).toBeInstanceOf(VersionCommand);
  });

  it('should print current version', async () => {
    const paramStub = {
      config: {
        cli: {
          package: {
            version: '1.0.0'
          }
        }
      }
    } as ICommandParameter;
    const output = await captureLog(async () => {
      await new VersionCommand().run(paramStub);
    });
    expect(output).toBe('1.0.0');
  });
});
