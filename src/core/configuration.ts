import { IPackageJson, deepCopy } from '@tylertech/forge-build-tools';
import cpath from 'canonical-path';
import deepMerge from 'deepmerge';
import { isAbsolute } from 'path';
import { DEFAULT_PROJECT_CONFIG } from '../constants.js';
import { loadPackageJson } from '../utils/utils.js';
import { ICommand } from './command.js';
import {
  ICliConfig,
  IConfig,
  IProjectConfig,
  IProjectConfigPaths
} from './definitions.js';

const { join, resolve } = cpath;

/**
 * The CLI execution environment configuration.
 */
export class Configuration implements IConfig {
  /** The current working directory. */
  public cwd = '';

  /** The execution environment project configuration. */
  public context!: IProjectConfig;

  /** The CLI environment configuration. */
  public cli: ICliConfig = {
    binDir: '',
    rootDir: '',
    package: {} as IPackageJson
  };

  /**
   * Creates a new instance of the `Configuration`.
   * @param currentWorkingDir The current working directory path.
   * @param cliBinDir The path to the bin directory holding our CLI executable.
   * @param projectConfig The existing project configuration where the command is running.
   * @param commands The list of commands available in the CLI.
   */
  constructor(
    currentWorkingDir: string,
    cliBinDir: string,
    projectConfig: IProjectConfig | undefined,
    public commands: ICommand[]
  ) {
    this._initCwd(currentWorkingDir);
    this._initCliConfig(cliBinDir);
    this._initProjectConfig(currentWorkingDir, projectConfig);
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
    this.cli.package = await loadPackageJson(this.cli.rootDir);
  }

  /**
   * Initializes the project configuration values.
   * @param cwd The current working directory.
   * @param config The existing project configuration to merge with.
   */
  private _initProjectConfig(
    cwd: string,
    config: IProjectConfig | undefined
  ): void {
    this.context = config
      ? deepMerge(deepCopy(DEFAULT_PROJECT_CONFIG), config)
      : deepCopy(DEFAULT_PROJECT_CONFIG);

    for (const [key, value] of Object.entries(this.context.paths)) {
      if (!isAbsolute(value)) {
        this.context.paths[key as keyof IProjectConfigPaths] = resolve(
          cwd,
          value
        );
      }
    }
  }
}
