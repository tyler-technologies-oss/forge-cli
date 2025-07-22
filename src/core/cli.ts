import minimist from 'minimist';
import { ICommand } from './command.js';
import { IConfig, IProjectConfig } from './definitions.js';
import { Configuration } from './configuration.js';
import { CommandParser } from './command-parser.js';
import { HelpCommand } from '../commands/help/help-command.js';
import { VersionCommand } from '../commands/version/version-command.js';
import { BuildCommand } from '../commands/build/build-command.js';

export const AVAILABLE_COMMANDS: ICommand[] = [
  new HelpCommand(),
  new VersionCommand(),
  new BuildCommand()
];

/**
 * Represents an instance of the forge command line utility.
 */
export class ForgeCLI {
  /** The collection of available commands. */
  public commands: ICommand[] = AVAILABLE_COMMANDS;

  /** The environment config. */
  public config: IConfig;

  /**
   * Creates a new instance of the CLI.
   */
  constructor(
    public argv: minimist.ParsedArgs,
    cwd: string,
    public cliBinDir: string,
    public projectConfig: IProjectConfig | undefined
  ) {
    // Create the CLI environment config. This is provided to each commands' `run` method at runtime.
    this.config = new Configuration(
      cwd,
      cliBinDir,
      projectConfig,
      this.commands
    );
  }

  /**
   * Starts the command parsing/execution.
   */
  public async run(): Promise<void> {
    await CommandParser.run(this.argv, this.config);
  }
}
