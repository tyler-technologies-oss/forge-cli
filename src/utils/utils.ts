import { type IPackageJson, readFileAsync } from '@tylertech/forge-build-tools';
import moment from 'moment';
import cpath from 'canonical-path';

export const DEFAULT_TIMESTAMP_FORMAT = 'hh:mm:ss';

export function getTimeStamp(format?: string): string {
  return moment().format(format || DEFAULT_TIMESTAMP_FORMAT);
}

export async function loadPackageJson(filePath: string): Promise<IPackageJson> {
  const file = await readFileAsync(
    cpath.resolve(`${filePath}/package.json`),
    'utf-8'
  );
  try {
    return JSON.parse(file);
  } catch {
    throw new Error(`Unable to locate package.json file at ${filePath}`);
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function getErrorStack(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  return String(error);
}
