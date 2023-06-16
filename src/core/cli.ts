import { ICommand } from './command.js';
import { IConfig, IProjectConfig } from './definitions.js';
import { Configuration } from './configuration.js';
import { CURRENT_TEMPLATE_VERSION } from '../constants.js';
import { CommandParser } from './command-parser.js';
import { assertBoolean } from '../utils/utils.js';

import { HelpCommand } from '../commands/help/help-command.js';
import { VersionCommand } from '../commands/version/version-command.js';
import { LintCommand } from '../commands/lint/lint-command.js';
import { GenerateCommand } from '../commands/generate/generate-command.js';
import { NewCommand } from '../commands/new/new-command.js';
import { BuildCommand } from '../commands/build/build-command.js';
import { ServeCommand } from '../commands/serve/serve-command.js';
import { TestCommand } from '../commands/test/test-command.js';
import { BumpCommand } from '../commands/bump/bump-command.js';
import { PublishCommand } from '../commands/publish/publish-command.js';

export const AVAILABLE_COMMANDS: ICommand[] = [
  new HelpCommand(),
  new VersionCommand(),
  new LintCommand(),
  new GenerateCommand(),
  new NewCommand(),
  new BuildCommand(),
  new ServeCommand(),
  new TestCommand(),
  new BumpCommand(),
  new PublishCommand()
];

/**
 * Represents an instance of the forge command line utility.
 */
export class ForgeCLI {
  /** The collection of available commands. */
  public commands: ICommand[] = AVAILABLE_COMMANDS;

  /** The environment config. */
  public config: IConfig;

  /** The environment scaffolding template version. */
  public templateVersion: string;

  /** 
   * Creates a new instance of the CLI. 
   */
  constructor(public argv: any, platform: NodeJS.Platform, cwd: string, public cliBinDir: string, public projectConfig: IProjectConfig | undefined) {
    // Initialize the environment with the expected template version for scaffolding commands
    this.templateVersion = projectConfig && projectConfig.templateVersion ? projectConfig.templateVersion : CURRENT_TEMPLATE_VERSION;

    // Create the CLI environment config. This is provided to each commands' `run` method at runtime.
    this.config = new Configuration(this.templateVersion, platform, cwd, cliBinDir, projectConfig, this.commands);

    // Initialize any default values for args
    this._initializeArgs();
  }

  private _initializeArgs(): void {
    if (this.argv) {
      // We always default the check for updates to true
      this.argv.update = assertBoolean(this.argv.update, true);
    }
  }

  /**
   * Starts the command parsing/exection.
   */
  public async run(): Promise<void> {
    await CommandParser.run(this.argv, this.config);
  }
}
