import { task, series, src, dest, watch } from 'gulp';
import { join, resolve } from 'canonical-path';
import * as bs from 'browser-sync';
import { CompilerOptions } from 'typescript';
import { cleanDirectories, lintESLint, compileTypeScript, readJsonFile, modifyFile, copyFilesAsync } from '@tylertech/forge-build-tools';
import { findClosestOpenPort } from './src/utils/network';

export const ROOT = __dirname;
export const SRC_ROOT = join(ROOT, 'src');
export const TEMPLATE_ROOT = join(ROOT, 'templates');
export const DIST_ROOT = join(ROOT, 'dist');

/** Lints the JavaScript/TypeScript under src root. */
task('lint', () => {
  const paths = [
    join(SRC_ROOT, '**/*.ts'),
    join(ROOT, 'gulpfile.ts')
  ];
  return lintESLint(paths, { options: { fix: true }, commitFixes: true});
});

/** Removes the dist directory. */
task('clean:dist', () => cleanDirectories(DIST_ROOT));

/** Copies the bin directory to the dist dir. */
task('copy:bin', () => src(join(ROOT, 'bin/**/*'), { base: '.' }).pipe(dest(DIST_ROOT)));

/** Copies files to the dist dir. */
task('copy', () => {
  const files = [
    join(ROOT, 'package.json'),
    join(ROOT, 'README.md'),
    join(ROOT, 'LICENSE')
  ];
  return copyFilesAsync(files, ROOT, DIST_ROOT);
});

/** Copies the schema files to the dist dir. */
task('copy:schema', () => src(join(ROOT, 'config', '*schema.json')).pipe(dest(DIST_ROOT)));

/** Fixes the package.json files that was copied to the output directory */
task('fixup:package.json', async () => {
  const packageJsonPath = join(DIST_ROOT, 'package.json');
  await modifyFile(packageJsonPath, info => {
    const json = JSON.parse(info.contents);
    delete json.devDependencies;
    delete json.scripts;
    delete json.private;
    return JSON.stringify(json, null, 2);
  });
});

/** Copies the templates to the dist dir. */
task('copy:templates', () => src(join(ROOT, 'templates/**/*'), { dot: true, base: '.' }).pipe(dest(DIST_ROOT)));

/** Copies the required cli assets to the dist directory. */
task('copy:assets', series('copy:bin', 'copy:templates', 'copy', 'copy:schema', 'fixup:package.json'));

/** Compiles the TypeScript in the CLI root directory. */
task('compile:ts', async () => {
  const tsConfig = await readJsonFile<any>(join(ROOT, 'tsconfig.json'));
  const options = tsConfig.compilerOptions as CompilerOptions;
  options.outDir = join(DIST_ROOT, 'src');
  return compileTypeScript(join(SRC_ROOT, '**/*.ts'), options);
});

task('serve:coverage', async () => {
  const browser = bs.create();
  browser.init({
    server: resolve(ROOT, 'test/coverage'),
    port: await findClosestOpenPort(9050, 'localhost'),
    notify: false,
    ghostMode: false,
    watch: true
  });
});

/** The main build task for generating the cli npm package. */
task('build', series('clean:dist', 'lint', 'compile:ts', 'copy:assets'));

task('watch:files', done => {
  const watchPaths = [
    join(SRC_ROOT, '**/*.ts'),
    join(TEMPLATE_ROOT, '**/*')
  ];
  watch(watchPaths, series('build'));
  done();
});

/** Runs the build task, but watches file changes so that it continuously builds when changing files. */
task('watch', series('build', 'watch:files'));
