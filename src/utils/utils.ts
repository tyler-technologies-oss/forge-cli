import { parse, join, dirname } from 'path';
import moment from 'moment';
import chalk from 'chalk';
import { InstallFileDescriptor, existsAsync, existsSync, Logger, statAsync, IPackageJson, readFileAsync } from '@tylertech/forge-build-tools';
import getPackageJson, { AbbreviatedMetadata } from 'package-json';
import * as semver from 'semver';
import os from 'os';
import childProcess from 'child_process';

export const DEFAULT_TIMESTAMP_FORMAT = 'hh:mm:ss';

export function getTimeStamp(format?: string): string {
  return moment().format(format || DEFAULT_TIMESTAMP_FORMAT);
}

/**
 * Prints the installation status (created/failed) of each file that was attempted to be installed.
 * @param files The files to install.
 * @param rootPath The path to the root of the installation directory.
 */
export async function printInstallationSummary(files: InstallFileDescriptor[], rootPath: string): Promise<void> {
  for (const file of files) {
    const pathFromRoot = file.outputPath.replace(rootPath, '').replace(/^\/?/, '');
    if (await existsAsync(file.outputPath)) {
      const stats = await statAsync(file.outputPath);
      Logger.print(`${chalk.green('CREATED')} ${pathFromRoot} (${stats.size} bytes)`);
    } else {
      Logger.print(`${chalk.red('FAILED')} ${pathFromRoot}`);
    }
  }
}

/**
 * Asserts a provided string value to be a boolean.
 * @param value The value to assert.
 * @param defaultValue The default value if undefined.
 */
export function assertBoolean(value: string, defaultValue?: boolean): boolean {
  if (defaultValue !== undefined && value === undefined) {
    return defaultValue;
  }

  return coerceBoolean(value);
}

/**
 * Coerces a string to a boolean.
 * @param {string} value The value to convert.
 * @returns {boolean}
 */
export function coerceBoolean(value: string): boolean {
  return value != null && '' + value !== 'false';
}

/**
 * Finds a directory/file above the provided `from` directory.
 * @param names Names of items to search for.
 * @param from The directory to start searching from.
 */
export function findUp(names: string | string[], from: string): string | null {
  if (!Array.isArray(names)) {
    names = [names];
  }
  const root = parse(from).root;

  let currentDir = from;
  while (currentDir && currentDir !== root) {
    for (const name of names) {
      const p = join(currentDir, name);
      if (existsSync(p)) {
        return p;
      }
    }

    currentDir = dirname(currentDir);
  }

  return null;
}

/**
 * Groups a list of items by the value returned from the grouper functions.
 * @param xs The list to group.
 * @param f The grouper function.
 */
export function groupBy<T>(xs: T[], f: (item: T) => any): { [key: string]: T[] } {
  return xs.reduce((r, v, i, a, k = f(v)) => ((r[k] || (r[k] = [])).push(v), r), {});
}

/**
 * Checks if a specific package is out of date with what is on the npm registry.
 * @param packageName The name of the package to check.
 * @param packageRegistry The npm registry to use when checking the package.
 * @param currentVersion The current version of the package to check.
 * @returns True if the current package vesion is less than the one in the registry.
 */
export async function isOutdated(packageName: string, packageRegistry: string | undefined, currentVersion: string): Promise<boolean> {
  if (!packageName) {
    throw new Error('Invalid package name.');
  }

  if (!currentVersion || !semver.valid(currentVersion)) {
    throw new Error('Invalid package version.');
  }

  let packageJson: AbbreviatedMetadata;
  try {
    packageJson = await getPackageJson(packageName, { registryUrl: packageRegistry });
  } catch (e) {
    Logger.warn('Unable to determine the latest CLI version. Have you updated your npm registry settings?');
    return false;
  }
    
  if (!packageJson) {
    throw new Error('Unable to determine the latest version of the CLI.');
  }

  const latestVersion = packageJson.version as string;
  return semver.lt(currentVersion, latestVersion);
}

export function getPhysicalCoreCount(): number {
  const platform = os.platform();
  
  function exec(command): string {
    return childProcess.execSync(command, { encoding: 'utf8' });
  }
  
  let amount;
  if (platform === 'linux') {
    const output = exec('lscpu -p | egrep -v "^#" | sort -u -t, -k 2,4 | wc -l');
    amount = parseInt(output.trim(), 10);
  } else if (platform === 'darwin') {
    const output = exec('sysctl -n hw.physicalcpu_max');
    amount = parseInt(output.trim(), 10);
  } else if (platform === 'win32') {
    const output = exec('WMIC CPU Get NumberOfCores');
    amount = output.split(os.EOL)
      .map(line => parseInt(line, 10))
      .filter(value => !isNaN(value))
      .reduce((sum, num) => sum + num, 0);
  } else {
    const cores = os.cpus().filter((cpu, index) => {
      const hasHyperthreading = cpu.model.includes('Intel');
      const isOdd = index % 2 === 1;
      return !hasHyperthreading || isOdd;
    });
    amount = cores.length;
  }
  return amount;
}

export async function loadPackageJson(filePath: string): Promise<IPackageJson> {
  const file = await readFileAsync(new URL(`${filePath}/package.json`, import.meta.url), 'utf-8');
  try {
    return JSON.parse(file);
  } catch {
    throw new Error(`Unable to locate package.json file at ${filePath}`);
  }
}
