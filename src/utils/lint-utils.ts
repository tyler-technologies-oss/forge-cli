import cpath from 'canonical-path';
import { runTask, lintSass, lintESLint, globFilesAsync, ILintESLintResult, ILintESLintConfiguration } from '@tylertech/forge-build-tools';

const { join } = cpath;

export interface ILintESLintCommandOptions {
  fix?: boolean;
}

/** Executes a stylesheet async linting task. */
export async function lintStyleSheetsTask(dir: string, stylelintConfigPath: string): Promise<boolean> {
  return await runTask<boolean>('Linting StyleSheets...', async () => lintStyleSheetsDirectory(dir, stylelintConfigPath));
}

/** Lints stylesheets in the provided directory. */
export async function lintStyleSheetsDirectory(dir: string, stylelintConfigPath: string): Promise<boolean> {
  const files = await globFilesAsync(join(dir, '**/*.+(scss|css)'));

  if (!files.length) {
    return true;
  }

  const lintSassResult = await lintSass(join(dir, '**/*.+(scss|css)'), stylelintConfigPath);
  if (!lintSassResult) {
    throw new Error('Found stylelint errors.');
  }
  return lintSassResult;
}

/** Executes a ESLint async linting task. */
export async function lintESLintTask(dir: string, options?: ILintESLintCommandOptions): Promise<ILintESLintResult> {
  return await runTask<ILintESLintResult>('Linting TypeScript...', async () => await lintESLintDirectory(dir, options));
}

/** Lints TypeScript files in the provided directory. */
export async function lintESLintDirectory(dir: string, options?: ILintESLintCommandOptions): Promise<ILintESLintResult> {
  const lintOptions: ILintESLintConfiguration = {
    commitFixes: options?.fix,
    options: {
      fix: options?.fix
    }
  };
  const lintESLintResult = await lintESLint(join(dir, '**/*.ts'), lintOptions);
  if (lintESLintResult.hasError) {
    throw new Error('Build failed due to ESLint errors.');
  }
  return lintESLintResult;
}
