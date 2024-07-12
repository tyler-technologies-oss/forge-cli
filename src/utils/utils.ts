import { existsSync, IPackageJson, readFileAsync } from '@tylertech/forge-build-tools';
import childProcess from 'child_process';
import moment from 'moment';
import os from 'os';
import cpath from 'canonical-path';

export const DEFAULT_TIMESTAMP_FORMAT = 'hh:mm:ss';

export function getTimeStamp(format?: string): string {
  return moment().format(format || DEFAULT_TIMESTAMP_FORMAT);
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
  const root = cpath.parse(from).root;

  let currentDir = from;
  while (currentDir && currentDir !== root) {
    for (const name of names) {
      const p = cpath.join(currentDir, name);
      if (existsSync(p)) {
        return p;
      }
    }

    currentDir = cpath.dirname(currentDir);
  }

  return null;
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
  const file = await readFileAsync(cpath.resolve(`${filePath}/package.json`), 'utf-8');
  try {
    return JSON.parse(file);
  } catch {
    throw new Error(`Unable to locate package.json file at ${filePath}`);
  }
}
