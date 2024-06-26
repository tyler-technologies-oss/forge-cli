import cpath from 'canonical-path';
import { readJsonFile, Logger } from '@tylertech/forge-build-tools';
import minimist from 'minimist';
import chalk from 'chalk';

import { CONFIG_FILENAME } from './constants.js';
import { IProjectConfig } from './core/definitions.js';
import { ForgeCLI } from './core/cli.js';

const { join } = cpath;

/**
 * The is the run method that is executed when the CLI is invoked. It sets up the  
 * environment and locates the command to execute.
 * @param process The current node process.
 * @param cliBinDir The path to the bin dir containing our entry point.
 */
export async function run(process: NodeJS.Process, cliBinDir: string): Promise<void> {
  // We use minimist to help with arg/option parsing
  const argv = minimist(process.argv.slice(2));

  try {
    // Attempt to load the existing project configuration from the current working directory
    const projectConfig = await readJsonFile<IProjectConfig>(join(process.cwd(), CONFIG_FILENAME));

    // Initialize the CLI and start parsing the given command
    const cli = new ForgeCLI(argv, process.platform, process.cwd(), cliBinDir, projectConfig);
    await cli.run();
  } catch (e) {
    Logger.newline();
    if (argv.verbose) {
      Logger.print(chalk.red(e.stack || e));
    } else {
      Logger.error(chalk.red(e.message));
    }
    process.exit(1);
  }
}
