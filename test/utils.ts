import { ParsedArgs } from 'minimist';
import { IConfig } from '../src/core/definitions';
import { Configuration } from '../src/core/configuration';
import { AVAILABLE_COMMANDS } from '../src/core/cli';
import { DEFAULT_PROJECT_CONFIG } from '../src/constants';

export function createCommand(args: string | string[], options?: { [key: string]: any }): ParsedArgs {
  if (typeof args === 'string') {
    args = args.split(/\s+/);
  }

  return {
    _: args,
    ...options
  };
}

export function getMockConfiguration(): IConfig {
  const config = new Configuration('v1', 'win10', process.cwd(), process.cwd(), DEFAULT_PROJECT_CONFIG, AVAILABLE_COMMANDS);
  config.cli.package = { name: 'test', version: '1.0.0' };
  return config;
}

/**
 * Mocks out `console` methods during the duration of the provided capture stack.
 * @param captured A capture context.
 */
export async function captureLog(captured: () => Promise<void>): Promise<string> {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const buffer: string[] = [];
  const capture = (...args: any[]) => {
    buffer.push(args.join(' '));
  };

  console.log = capture;
  console.error = capture;
  console.warn = capture;

  const restoreAndGetOutput = () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    return buffer.join('\n');
  };

  try {
    await captured();
  } catch (err) {
    const output = restoreAndGetOutput();
    console.error(output);
    throw err;
  }

  return restoreAndGetOutput();
}

