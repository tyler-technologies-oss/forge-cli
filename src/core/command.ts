import { IConfig } from './definitions';
import { ParsedArgs } from 'minimist';

/**
 * Represents a CLI command.
 */
export interface ICommand {
  /** The command name. */
  name: string;
  /** Hides the command from the help usage. */
  usagePrivate?: boolean;
  /** Alternative command names. */
  alias?: string | string[];
  /** The command description. */
  description: string;
  /** Commands that can be nested below this command. */
  subCommands?: ICommand[];
  /** Command line arguments. */
  args?: ICommandArg[];
  /** Options for the command. */
  options?: ICommandOption[];
  /** The command execution method. */
  run(param: ICommandParameter): Promise<void>;
  /** Validates command args. */
  validator?: (param: ICommandParameter) => string | undefined;
  /** Custom matcher for command parsing when the command name or alias is not met. */
  matcher?: (args: any) => boolean;
}

/**
 * Represents a command parameter containing th environment configuration and raw command arguments/options.
 */
export interface ICommandParameter {
  /** The raw command line arguments and options. */
  args: ParsedArgs;
  /** The CLI environment configuration. */
  config: IConfig;
}

/**
 * Represents a single command line argument.
 */
export interface ICommandArg {
  /** The name of the argument. */
  name: string;
  /** The type string for the usage guide. */
  type: string;
  /** The description for the usage guide. */
  description: string;
  /** Whether the argument is required or not.1 */
  required?: boolean;
  /** The default value for this argument. */
  defaultValue?: string;
}

/**
 * Represents a single command line option.
 */
export interface ICommandOption extends ICommandArg {
  /** The type string for the usage guide. */
  type: any;
}
