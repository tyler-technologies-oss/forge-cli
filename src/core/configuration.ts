import { isAbsolute } from 'path';
import cpath from 'canonical-path';
import deepMerge from 'deepmerge';
import { OS, IPackageJson, deepCopy } from '@tylertech/forge-build-tools';

import { IConfig, ICliConfig, IProjectConfig } from './definitions.js';
import { DEFAULT_PROJECT_CONFIG, CURRENT_TEMPLATE_VERSION } from '../constants.js';
import { ICommand } from './command.js';
import { loadPackageJson } from '../utils/utils.js';

const { join, resolve } = cpath;

/**
 * The CLI execution environment configuration.
 */
export class Configuration implements IConfig {
  /** The current working directory. */
  public cwd = '';
  /** The current operating system. */
  public os: OS = OS.Unknown;
  /** The execution environment project configuration. */
  public context: IProjectConfig;
  /** The CLI environment configuration. */
  public cli: ICliConfig = {
    binDir: '',
    rootDir: '',
    templatesDirName: 'templates',
    templatesDir: '',
    templateVersion: CURRENT_TEMPLATE_VERSION,
    package: {} as IPackageJson
  };

  /**
   * Creates a new instance of the `Configuration`.
   * @param templateVersion The version of the templates to use for scaffolding.
   * @param os The current operating system.
   * @param currentWorkingDir The current working directory path.
   * @param cliBinDir The path to the bin directory holding our CLI executable.
   * @param projectConfig The existing project configuration where the command is running.
   * @param commands The list of commands available in the CLI.
   */
  constructor(templateVersion: string, os: string, currentWorkingDir: string, cliBinDir: string, projectConfig: IProjectConfig | undefined, public commands: ICommand[]) {
    this.cli.templateVersion = templateVersion;
    this._initOS(os);
    this._initCwd(currentWorkingDir);
    this._initCliConfig(cliBinDir);
    this._initProjectConfig(currentWorkingDir, projectConfig);
  }

  /**
   * Gets the registry URL from the publish config of the CLI package.json
   */
  public getPackageRegistry(): string | undefined {
    if (this.cli.package && this.cli.package.publishConfig && this.cli.package.publishConfig.registry) {
      return this.cli.package.publishConfig.registry;
    }
  }

  /**
   * Determines the current operating system the CLI is running on.
   * @param os The current operating system string.
   */
  private _initOS(os: string): void {
    switch (os) {
      case 'darwin':
        this.os = OS.Mac;
        break;
      case 'win32':
        this.os = OS.Windows;
        break;
      case 'linux':
        this.os = OS.Linux;
        break;
      default:
        this.os = OS.Unknown;
    }
  }

  /**
   * Sets the current working directory.
   * @param cwd The absolute current working directory.
   */
  private _initCwd(cwd: string): void {
    this.cwd = resolve(cwd);
  }

  /**
   * Initializes the CLI environment configuration.
   * @param cliBinDir 
   */
  private async _initCliConfig(cliBinDir: string): Promise<void> {
    this.cli.binDir = resolve(cliBinDir);
    this.cli.rootDir = join(cliBinDir, '../../');
    this.cli.templatesDir = join(this.cli.rootDir, this.cli.templatesDirName);
    this.cli.package = await loadPackageJson(this.cli.rootDir);
  }

  /**
   * Initializes the project configuration values.
   * @param cwd The current working directory.
   * @param config The existing project configuration to merge with.
   */
  private _initProjectConfig(cwd: string, config: IProjectConfig | undefined): void {
    this.context = config ? deepMerge(deepCopy(DEFAULT_PROJECT_CONFIG), config) : deepCopy(DEFAULT_PROJECT_CONFIG);

    for (const prop in this.context.paths) {
      if (this.context.paths.hasOwnProperty(prop) && !isAbsolute(this.context.paths[prop])) {
        this.context.paths[prop] = resolve(cwd, this.context.paths[prop]);
      }
    }
  }
}
