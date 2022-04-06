import { join } from 'canonical-path';
import { readJsonFile, Logger } from '@tylertech/forge-build-tools';
import minimist from 'minimist';
import chalk from 'chalk';

import { CONFIG_FILENAME } from './constants';
import { IProjectConfig } from './core/definitions';
import { ForgeCLI } from './core/cli';

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
    Logger.error(chalk.red(e.message));
    Logger.print(chalk.red(e.stack || e));
    process.exit(1);
  }
}
