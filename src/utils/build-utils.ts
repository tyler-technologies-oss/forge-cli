import cpath from 'canonical-path';
import esbuild from 'esbuild';
import { readFileSync } from 'fs';
import ts from 'typescript';
import { IProjectConfig, IProjectConfigPaths } from '../core/definitions.js';
import { lintESLintDirectory, lintStyleSheetsDirectory } from './lint-utils.js';
import {
  absolutify,
  compileSass,
  compileTypeScript,
  deleteDir,
  existsAsync,
  globFilesAsync,
  Logger,
  minifyCss,
  minifyHtml,
  modifyFile,
  readFileAsync,
  readJsonFile,
  runTask,
  writeFileAsync
} from '@tylertech/forge-build-tools';
import jsStringEscape from 'js-string-escape';

const { dirname, extname, join, relative, resolve } = cpath;

export interface IBuildTaskConfiguration {
  context: IProjectConfig;
  paths: IProjectConfigPaths;
  packageName: string;
  cwd: string;
  args: { [key: string]: any };
  quiet?: boolean;
}

export interface IBuildJson {
  entry: string;
  include?: boolean;
  extends?: string;
  stylesheets?: string[];
  name?: string;
  compile?: boolean;
  bundle?: {
    pack?: boolean;
    esm?: boolean;
  };
}

/**
 * The async lint task for linting all TypeScript and Sass files in a directory.
 * @param dir The directory to lint.
 * @param stylelintConfigPath The path to the stylelint config file.
 */
export async function lintTask(dir: string, stylelintConfigPath: string, eslint: boolean, quiet = false): Promise<void> {
  return runTask('Linting...', async () => {
    if (eslint) {
      await lintESLintDirectory(dir);
    }
    await lintStyleSheetsDirectory(dir, stylelintConfigPath);
  }, quiet);
}

/** Generates a bundled ES module build of the library. */
export async function generateStaticESModuleSources({
  outdir,
  entryPoints,
  external,
  metafile,
  metafileOutDir
}: {
  outdir: string;
  metafile?: boolean;
  metafileOutDir?: string;
  entryPoints: string[] | Record<string, string>;
  external?: string[];
}): Promise<void> {
  const result = await esbuild.build({
    format: 'esm',
    target: 'es2017',
    entryPoints,
    splitting: true,
    chunkNames: 'chunks/[name].[hash]',
    sourcemap: true,
    bundle: true,
    minify: true,
    metafile,
    outdir,
    external
  });
  if (result.metafile) {
    await writeFileAsync(join(metafileOutDir ?? outdir, 'esbuild-meta.json'), JSON.stringify(result.metafile), 'utf8');
  }
}

/**
 * Replace any require statements for .scss files to use .css extensions. This is done to point to the
 * built CSS files after Sass compilation.
 * @param outputDir The output location for the built JavaScript files.
 */
export async function fixupRequireSassTask(outputDir: string): Promise<void> {
  await modifyFile(join(outputDir, '**/*.{ts,js}'), info => info.contents.replace(/(.)(scss)(['"])/g, '$1css$3'));
}

/**
 * Inlines .html and .css files within the transpiled JavaScript files.
 * @param outputDir 
 */
export async function inlineContentTask(outputDir: string): Promise<void> {
  const importRegex = /import(.*)from ['"](\.\.?\/[^'"]+\.(?:html|s?css))['"]/g;

  await modifyFile(join(outputDir, '**/*.{ts,js}'), async info => {
    const dirpath = dirname(info.filepath);
    
    return info.contents.replace(importRegex, (match, $1, $2) => {
      const requiredFilePath = resolve(dirpath, $2);
      const extension = extname(requiredFilePath);
      const isValidMatch = ['.css', '.scss', '.html'].includes(extension);
      
      if (!isValidMatch) {
        return match;
      }

      let fileContents = readFileSync(requiredFilePath, 'utf8').toString();

      // We need to make sure the file contents are minified and on a single line.
      if (extension === '.css') {
        fileContents = minifyCss(fileContents);
      } else if (extension === '.html') {
        fileContents = minifyHtml(fileContents);
      } else {
        throw new Error(`Invalid file was attempted to be parsed during \`inlineContentTask\`: ${requiredFilePath}`);
      }

      return `const${$1}= \'${jsStringEscape(fileContents)}\'`;
    });
  });
}

/**
 * Removes the build output directory.
 * @param buildOutputDir The path to the build directory.
 */
export async function cleanup(buildDir: string, quiet = false): Promise<void> {
  return runTask('Cleaning up...', async () => {
    await deleteDir(buildDir);
  }, quiet);
}

/**
 * Compiles all TypeScript files in the library.
 * @param config The environment configuration.
 * @param srcDir The src directory path.
 * @param libDir The lib directory path.
 * @param outputDir The output directory path.
 * @param target The TypeScript transpilation target.
 * @param module The TypeScript transpilation module type.
 * @param declaration Includes .d.ts files with this compilation
 */
export async function compileTypeScriptTask(config: IBuildTaskConfiguration, srcDir: string, libDir: string, outputDir: string, target: ts.ScriptTarget, module: ts.ModuleKind, declaration = false, declarationDir?: string | undefined): Promise<void> {
  const defaultOptions: ts.CompilerOptions = {
    target,
    module,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    lib: ['dom', 'es2015', 'es2017'],
    rootDir: libDir,
    outDir: relative(config.cwd, outputDir),
    experimentalDecorators: true,
    noImplicitAny: false,
    strictNullChecks: true,
    importHelpers: true,
    noEmitHelpers: true,
    noEmitOnError: true,
    sourceMap: false,
    declarationDir,
    declaration
  };

  let options: ts.CompilerOptions = {};
  const tsconfigPath = absolutify(config.context.build.tsconfigPath, config.context.paths.rootDir);

  if (await existsAsync(tsconfigPath)) {
    const buildTsconfig = await readJsonFile<any>(tsconfigPath);
    options = Object.assign({}, defaultOptions, buildTsconfig.compilerOptions as ts.CompilerOptions);
    options.target = defaultOptions.target;
    options.module = defaultOptions.module;
    options.moduleResolution = defaultOptions.moduleResolution;
    options.outDir = defaultOptions.outDir;
    options.declaration = defaultOptions.declaration;

    if (options.declaration && options.allowJs) {
      delete options.allowJs;
    }
  } else {
    options = defaultOptions;
  }
  const libTypingsFiles = await globFilesAsync(join(libDir, '**/*.d.ts'));
  const tsFiles = await globFilesAsync(join(srcDir, '**/*.ts'));
  const files = [...libTypingsFiles, ...tsFiles];
  return compileTypeScript(files, options);
}

/**
 * Compiles all .scss files in a given directory.
 * @param srcDir The location of .scss files to compile.
 * @param outputDir The output location for the compilation results.
 */
export async function compileSassTask(srcDir: string, outputDir: string): Promise<string[]> {
  return compileSass(join(srcDir, '**/[^_]*.scss'), srcDir, outputDir);
}

/**
 * Finds and compiles all Sass stylesheets specified within the source directory build configuration file and
 * compile them to CSS for the resulting npm package distribution.
 */
export async function compileConfiguredStyleSheets(srcDir: string, rootDir: string, buildOutputDir: string): Promise<void> {
  // Find all of the build.json files within the provided source directory
  const buildConfigPaths = await globFilesAsync(join(srcDir, '**/build.json'));

  // Read all of the build.json files asynchronously and return their descriptors
  const configDescriptors = await Promise.all(buildConfigPaths.map(configPath => new Promise<any>(async resolvePromise => {
    try {
      const json = await readJsonFile(configPath);
      const result = {
        config: json,
        path: configPath
      };
      resolvePromise(result);
    } catch (e) {
      Logger.error(`Unable to read JSON file at: ${configPath}. ${e.message}`);
      resolvePromise(undefined);
    }
  })) as Array<Promise<any>>);

  // Contains the array of valid stylesheet paths specified within the build.json files
  const sassFiles: string[] = [];

  // Iterate over the descriptors and pull out the stylesheets property (if it has one)
  for (const descriptor of configDescriptors) {
    if (!descriptor || !descriptor.config || !descriptor.config.stylesheets || !(descriptor.config.stylesheets instanceof Array)) {
      continue;
    }

    // This configuration has stylesheets specified so make sure the path is valid and add it to the list if so
    for (const stylesheetPath of descriptor.config.stylesheets) {
      const filePath = stylesheetPath ? resolve(dirname(descriptor.path), stylesheetPath) : undefined;
      if (!filePath || !await existsAsync(filePath)) {
        continue;
      }
      sassFiles.push(filePath);
    }
  }

  // If we have some files to compile, output the resulting css to the styles directory within the build dir
  if (sassFiles.length) {
    await compileSass(sassFiles, rootDir, buildOutputDir);
  }
}

/**
 * Reads the build.json file from the provided component directory.
 * @param dir {string} The path to the component directory that contains the build.json file.
 */
export async function resolveBuildJson(dir: string): Promise<IBuildJson> {
  try {
    const path = resolve(dir, 'build.json');
    let buildJson = await readJsonFile(path) as IBuildJson ?? {};

    if (buildJson.extends) {
      const extendsPath = resolve(dir, buildJson.extends);
      if (await existsAsync(extendsPath)) {
        const extendsDir = dirname(extendsPath);
        const extendedBuildJson = await resolveBuildJson(extendsDir);
        buildJson = Object.assign(extendedBuildJson, buildJson);
      }
    }

    return buildJson;
  } catch (e) {
    return {
      entry: './index.ts' // TODO: allow for customization of default path through project context configuration
    };
  }
}

/** Appends the configured license header (if set) to all files defined by the provided glob value. */
export async function appendLicenseHeaders(config: IBuildTaskConfiguration, glob: string): Promise<void> {
  if (!config.context.license.header) {
    return;
  }

  const files = await globFilesAsync(glob);
  if (!files.length) {
    Logger.warn('Unable to locate any files to add license header to.');
    return;
  }

  for (const file of files) {
    let contents = await readFileAsync(file, 'utf8');
    if (contents.includes(config.context.license.header as string)) {
      continue;
    }
    contents = `${config.context.license.header}${contents}`;
    await writeFileAsync(file, contents, 'utf8');
  }
}
