import { join, relative, dirname, resolve, extname, normalize, parse, basename } from 'canonical-path';
import * as ts from 'typescript';
import * as webpack from 'webpack';
import { minify } from 'terser';
import chalk from 'chalk';
import {
  removeUnusedSelectors,
  findDirectoriesContainingFileByExtension,
  modifyFile,
  executeWebpack,
  copyFilesAsync,
  minifyCss,
  minifyHtml,
  getDirectoriesContainingFiles,
  createRollupBundle,
  IRollupBundleConfig,
  deleteFiles,
  compileTypeScript,
  runTask,
  deleteDir,
  mkdirp,
  IFileCopyConfig,
  copyFilesMultiple,
  readJsonFile,
  compileSass,
  existsAsync,
  Logger,
  absolutify,
  loadPackageJson,
  globFilesAsync,
  readFileAsync,
  writeFileAsync,
  dashify,
  existsSync,
  camelCase,
  getDirectories
} from '@tylertech/forge-build-tools';

import { lintESLintDirectory, lintStyleSheetsDirectory } from './lint-utils';
import { IBuildConfig, IBundleConfig, IProjectConfig, IProjectConfigPaths } from '../core/definitions';
import { TEMP_BUILD_DIR_NAME, BUNDLE_OUTPUT_DIR_NAME } from '../constants';
import { readFileSync } from 'fs';
import { getWebpackConfigurationFactory, IWebpackEnv, WebpackConfigurationFactory } from './webpack';
import { assertBoolean, coerceBoolean } from './utils';

const uppercamelcase = require('uppercamelcase');
const jsStringEscape = require('js-string-escape');
const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJs = require('rollup-plugin-commonjs');

export interface IWebpackTaskResult {
  assets: string[];
  outputPath: string;
}

export interface IBuildTaskConfiguration {
  context: IProjectConfig;
  paths: IProjectConfigPaths;
  packageName: string;
  cwd: string;
  args: { [key: string]: any };
  quiet?: boolean;
}

export interface IComponentBuildJson {
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

export async function buildComponent(config: IBuildTaskConfiguration, componentName: string): Promise<void> {
  componentName = dashify(componentName);

  if (!existsSync(join(config.paths.libDir, componentName))) {
    throw new Error(`Component "${componentName}" not found. Try ${chalk.yellow(`\`forge generate component ${componentName}\``)}.`);
  }

  const componentLibDir = join(config.paths.libDir, componentName);
  const componentPackageJson = loadPackageJson(componentLibDir);
  const buildRoot = join(config.paths.distBuildDir, componentName);
  const buildOutputDir = join(buildRoot, TEMP_BUILD_DIR_NAME);
  const bundleOutputDir = join(buildRoot, BUNDLE_OUTPUT_DIR_NAME);
  const lintCode = assertBoolean(config.args.lint, true);

  // If the component directory has a `package.json` we assume that this component is to be built and distributed as
  // an npm package, so let's generate that.
  //
  // Otherwise, we will read the `build.json` file from the same directory. If it doesn't exist we assume default
  // configuration values and continue with the build. If it does exist and sets the `include` property to `false`,
  // we skip the component. This flow will generate statically built assets in the configured directory structure,
  // typically for deployment to an alternate destination such as a CDN for example.
  if (componentPackageJson) {
    // NPM packaging (package.json)
    const packageName = `${config.packageName}-${componentName}`;
    const fullPackageName = componentPackageJson.name;
    const releaseDir = join(config.paths.distReleaseDir, fullPackageName);

    if (lintCode) {
      await lintTask(componentLibDir, config.paths.stylelintConfigPath, true, config.quiet);
    }

    await prepareBuildDirectory(buildRoot, releaseDir, buildRoot, buildOutputDir, bundleOutputDir, config.quiet);
    await generatePackageBundles(config, componentLibDir, buildOutputDir, bundleOutputDir, packageName, componentName);
    await createNpmPackage(config, componentPackageJson.name, buildOutputDir, bundleOutputDir, componentLibDir);
  } else {
    // Directory/asset generation (build.json)
    const buildJson = await resolveBuildJson(componentLibDir);

    // Ensure we have an entry if compilation is enabled
    if (!buildJson.entry && buildJson.compile !== false) {
      throw new Error(`An entry must be specified in your build.json at "${componentLibDir}"`);
    }
    
    // Check to see if this component has opted out of the build process
    if (buildJson.include === false) {
      return; // We're done, this component has requested to not be built
    }

    // Ensure that the component directory has an entry file (`index.ts` by default) file at the root (if compilation is enabled)
    if (buildJson.compile !== false) {
      const indexPath = join(componentLibDir, buildJson.entry);
      if (!await existsAsync(indexPath)) {
        throw new Error(`${componentName} does not contain the required entry file (${buildJson.entry}} file at the root ${chalk.yellow(`(${indexPath})`)})`);
      }
    }

    if (lintCode) {
      await lintTask(componentLibDir, config.paths.stylelintConfigPath, buildJson.compile !== false, config.quiet);
    }

    const distName = buildJson.name ?? componentName;
    const libPackageJson = loadPackageJson(config.paths.libDir);
    const distOutputDir = join(config.paths.distDir, config.context.build.static.distPath, config.context.packageOrg, config.context.packageName, libPackageJson.version);
    const componentDistDir = join(distOutputDir, distName);
    const componentBuildDir = join(buildOutputDir, componentName);
    await prepareComponentBuildDirectory(componentBuildDir, componentDistDir, buildOutputDir, config.quiet);
    await generateComponentBundles(config, buildJson, componentLibDir, buildOutputDir, bundleOutputDir, componentName);
    await createComponentDistributionStructure(config, distOutputDir, distName, buildOutputDir, bundleOutputDir);
  }
  
  // Clean up the temporary build files/directories
  await cleanup(buildRoot, config.quiet);
}

/**
 * Determines the tsconfig-safe module string from a TypeScript `ModuleKind`.
 */
export function getModuleStringByKind(moduleKind: ts.ModuleKind): string {
  switch (moduleKind) {
    case ts.ModuleKind.ES2015:
      return 'es2015';
    case ts.ModuleKind.CommonJS:
      return 'commonjs';
    case ts.ModuleKind.System:
      return 'systemjs';
    default:
      throw new Error(`Invalid module kind specified. Unsupported TypeScript module kind specified: ${moduleKind}.`);
  }
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

/**
 * Prepares the build directory for a new build.
 * @param buildRoot The location of the build directory.
 * @param distReleaseDir The path to the release directory where the final npm package will live.
 * @param buildDir The build directory path.
 * @param buildOutputDir The build output directory path.
 * @param bundleOutputDir The bundle output directory path.
 */
export async function prepareBuildDirectory(buildRoot: string, distReleaseDir: string, buildDir: string, buildOutputDir: string, bundleOutputDir: string, quiet = false): Promise<void> {
  return runTask('Preparing for build...', async () => {
    await deleteDir(buildRoot);
    await deleteDir(distReleaseDir);
    await mkdirp(buildDir);
    await mkdirp(buildOutputDir);
    await mkdirp(bundleOutputDir);
  }, quiet);
}

/**
 * Prepares the build directory for a new individual component build.
 * @param buildRoot The location of the build directory.
 * @param distReleaseDir The path to the release directory where the final npm package will live.
 * @param buildDir The build directory path.
 * @param buildOutputDir The build output directory path.
 * @param bundleOutputDir The bundle output directory path.
 */
export async function prepareComponentBuildDirectory(buildDir: string, distDir: string, buildOutputDir: string, quiet = false): Promise<void> {
  return runTask('Initializing component build directory...', async () => {
    await deleteDir(buildDir);
    await deleteDir(buildOutputDir);
    await deleteDir(distDir);
  }, quiet);
}

/**
 * Generate all bundles for the build.
 * @param config The environment config.
 * @param srcDir The source directory.
 * @param buildOutputDir The build output directory.
 * @param bundleOutputDir The bundle output directory.
 * @param packageName The npm package name.
 * @param webpackEntry The webpack entry configuration.
 * @param componentName The name of the component directory to build.
 */
export async function generatePackageBundles(config: IBuildTaskConfiguration, srcDir: string, buildOutputDir: string, bundleOutputDir: string, packageName: string, componentName: string): Promise<void> {
  const esmBuildDir = join(buildOutputDir, 'esm');
  const buildConfig = await resolveBuildJson(srcDir);

  if (!buildConfig?.entry) {
    throw new Error(`An entry must be specified in your build.json at "${srcDir}"`);
  }

  const { name: entryName } = parse(buildConfig.entry);

  await runTask('Compiling TypeScript...', async () => {
    // Create the esm build 
    // Note: the .css files generated at the root of this directory are referenced during npm packaging
    await compileSources(config, srcDir, esmBuildDir, ts.ScriptTarget.ES2015, false);

    // Copy any non-TypeScript files out to the build directory in case they are imported/required
    await copyDependentSources(srcDir, esmBuildDir);
  }, config.quiet);

  await runTask('Generating webpack bundle...', async () => {
    // Generate a webpack bundle from the es5 build output
    let webpackEntry: { [key: string]: string };
    if (componentName === config.context.libDirName) {
      webpackEntry = { [config.context.libDirName]: `${esmBuildDir}/${entryName}.js` };
    } else {
      webpackEntry = { [componentName]: `${esmBuildDir}/${componentName}/${entryName}.js` };
    }
    const fileNamePrefix = config.context.build.webpack.filename ?? config.context.packageName;
    await webpackTask(config, webpackEntry, componentName, config.context.libDirName, fileNamePrefix);
  }, config.quiet);
  
  // The project can control whether the rollup bundles will be generated or not
  if (config.context.build.rollup !== false) {
    await runTask('Generating ES module bundle...', async () => {
      // Prepare for generating rollup bundles
      await fixupPreRollupTask(esmBuildDir);

      // Information for rollup configuration
      const libPackageJson = loadPackageJson(srcDir);

      if (!libPackageJson) {
        throw new Error(`A package.json file must be provided to build this package. Please create a package.json file at: ${srcDir}`);
      }
      
      // Generate the module bundles
      const rollupGlobals = getRollupGlobals(config.paths.libDir, packageName, config.context.externalDependencies);
      const rollupBuildDir = config.context.libDirName !== componentName ? join(esmBuildDir, componentName) : esmBuildDir;
      await createModuleBundles(config, entryName, rollupBuildDir, bundleOutputDir, packageName, libPackageJson.version, rollupGlobals);
    }, config.quiet);
  }

  await runTask('Generating typings...', async () => {
    // Generate typings for the whole library from an es2015 build
    const typingsBuildDir = join(buildOutputDir, 'typings');
    await compileTypeScriptTask(config, srcDir, config.paths.libDir, typingsBuildDir, ts.ScriptTarget.ES2015, ts.ModuleKind.ES2015, true);
  }, config.quiet);

  await runTask('Copying Sass files...', async () => {
    // Generate only the styles that this directory includes during sass compilation (this is used during packaging to know what files are required for sass)
    let files = await compileSassTask(config.paths.libDir, join(buildOutputDir, 'css'));
    files = files.map(normalize).filter(f => f.startsWith(normalize(config.paths.libDir))); // Only take files that are under the lib directory (skips external libs)
    await copyFilesAsync(files, config.paths.libDir, join(buildOutputDir, 'sass'));
  }, config.quiet);

  await runTask('Compiling Sass stylesheets...', async () => {
    // Detect all build.json files within the `srcDir` and compile the stylesheets specified within them for inclusion within the package
    await compileConfiguredStyleSheets(srcDir, config.paths.libDir, buildOutputDir);
  }, config.quiet);
}

/**
 * Generate all bundles for a specific component.
 * @param config The environment config.
 * @param srcDir The source directory.
 * @param buildOutputDir The build output directory.
 * @param bundleOutputDir The bundle output directory.
 * @param packageName The npm package name.
 * @param webpackEntry The webpack entry configuration.
 * @param componentName The name of the component directory to build.
 */
export async function generateComponentBundles(config: IBuildTaskConfiguration, buildConfig: IComponentBuildJson, srcDir: string, buildOutputDir: string, bundleOutputDir: string, componentName: string): Promise<void> {
  if (buildConfig.compile !== false) {
    const jsBuildDir = join(buildOutputDir, 'js');

    if (!buildConfig?.entry) {
      throw new Error(`An entry must be specified in your build.json at "${srcDir}"`);
    }

    const { name: entryName } = parse(buildConfig.entry);

    // Create the esm build (separate files)
    await runTask('Compiling TypeScript...', async () => {
      await compileSources(config, srcDir, jsBuildDir, ts.ScriptTarget.ES2015, true);

      // Copy any non-TypeScript files out to the build directory in case they are imported/required
      await copyDependentSources(srcDir, jsBuildDir);
    }, config.quiet);

    if (buildConfig.bundle?.pack !== false) {
      await runTask('Generating webpack bundle...', async () => {
        // Generate a webpack bundle from the JS build output
        const webpackEntry = { [componentName]: `${jsBuildDir}/${componentName}/${entryName}.js` };
        await webpackTask(config, webpackEntry, componentName, componentName);
      }, config.quiet);
    }

    if (buildConfig.bundle?.esm !== false) {
      await runTask('Generating ES module bundle...', async () => {
        // Prepare for generating rollup bundles
        await fixupPreRollupTask(jsBuildDir);

        const libPackageJson = loadPackageJson(config.context.paths.libDir);
        if (!libPackageJson) {
          throw new Error(`A package.json file must be provided to build this package. Please create a package.json file at: ${config.context.paths.libDir}`);
        }

        // Generate the module bundles
        const rollupGlobals = getRollupGlobals(config.paths.libDir, componentName, config.context.externalDependencies);
        const rollupBuildDir = config.context.libDirName !== componentName ? join(jsBuildDir, componentName) : jsBuildDir;
        await createModuleBundles(config, entryName, rollupBuildDir, bundleOutputDir, componentName, libPackageJson.version, rollupGlobals);
      }, config.quiet);
    }
  }

  if (buildConfig.stylesheets?.length) {
    await runTask('Compiling Sass stylesheets...', async () => {
      // Detect all build.json files within the `srcDir` and compile the stylesheets specified within them for inclusion within the distribution directory
      await compileConfiguredStyleSheets(srcDir, config.paths.libDir, buildOutputDir);
    }, config.quiet);
  }
}

/**
 * Compiles all of the sources to an output directory.
 * @param {IConfig} config The environment configuration.
 * @param {string} buildDir The directory write built files to.
 * @param {ts.ScriptTarget} target The TypeScript target to use.
 */
async function compileSources(config: IBuildTaskConfiguration, srcDir: string, buildDir: string, target: ts.ScriptTarget, onlyReferenced: boolean): Promise<void> {
  const { libDir } = config.context.paths;
  await compileTypeScriptTask(config, srcDir, libDir, buildDir, target, ts.ModuleKind.ES2015);
  if (onlyReferenced) {
    await compileReferencedSassTask(libDir, buildDir);
  } else {
    await compileSassTask(libDir, buildDir);
  }
  await copyHtmlTemplatesTask(srcDir, buildDir, libDir);

  if (coerceBoolean(config.args.cleancss)) {
    await removeUnusedSelectorsTask(config, buildDir);
  }

  await fixupRequireSassTask(buildDir);
}

/**
 * Copies dependent source files from the source directory to the output build directory for compilation.
 * @param srcDir The source directory root.
 * @param outDir The output directory.
 */
export async function copyDependentSources(srcDir: string, outDir: string): Promise<void> {
  return copyFilesAsync(join(srcDir, '**/*.!(ts)'), srcDir, outDir);
}

async function createComponentDistributionStructure(config: IBuildTaskConfiguration, distDir: string, distName: string, buildOutputDir: string, bundleOutputDir: string): Promise<void> {
  return runTask('Creating component distribution structure...', async () => {
    const componentDistDir = join(distDir, distName);
    const buildStylesDir = join(buildOutputDir, 'styles');

    await mkdirp(componentDistDir);

    const fileConfigs: IFileCopyConfig[] = [
      { path: join(bundleOutputDir, '*.?(m)js*'), outputPath: componentDistDir },
      { path: join(buildStylesDir, '**/*.css'), outputPath: componentDistDir }
    ];
    await copyFilesMultiple(fileConfigs);

    // Append license headers to all .js|.scss|.css files in the component dir
    await appendLicenseHeaders(config, join(componentDistDir, '**/*.*(js|scss|css)'));
  }, config.quiet);
}

/**
 * Creates an npm package from the generated bundles.
 * @param config 
 * @param packageName 
 * @param buildOutputDir 
 * @param bundleOutputDir 
 * @param sassDir 
 * @param libPackageDir 
 */
export async function createNpmPackage(config: IBuildTaskConfiguration, packageName: string, buildOutputDir: string, bundleOutputDir: string, libPackageDir: string): Promise<void> {
  return runTask('Creating npm package...', async () => {
    // Set package directory paths
    const releaseRootDir = join(config.paths.distReleaseDir, packageName);
    const releaseDistDir = join(releaseRootDir, 'dist');
    const releaseEsmDir = join(releaseRootDir, 'esm');
    const releaseStylesDir = join(releaseRootDir, 'styles');
    const releaseTypingsDir = join(releaseRootDir, 'typings');
    const buildEsmDir = join(buildOutputDir, 'esm');
    const buildTypingsDir = join(buildOutputDir, 'typings');
    const buildSassDir = join(buildOutputDir, 'sass');
    const buildStylesDir = join(buildOutputDir, 'styles');
    const buildCssDir = join(buildOutputDir, 'css');

    // Build package directory structure
    await mkdirp(releaseRootDir);
    await mkdirp(releaseDistDir);
    await mkdirp(releaseEsmDir);
    await mkdirp(releaseStylesDir);
    await mkdirp(releaseTypingsDir);

    // Copy files from build output to the package structure
    const fileConfigs: IFileCopyConfig[] = [
      { path: join(bundleOutputDir, '*.?(m)js*'), outputPath: releaseDistDir },
      { path: join(buildEsmDir, '**/*.js*'), rootPath: buildEsmDir, outputPath: releaseEsmDir },
      { path: join(buildTypingsDir, '**/*.d.ts'), rootPath: buildTypingsDir, outputPath: releaseTypingsDir },
      { path: join(buildCssDir, '*.css'), outputPath: releaseDistDir },
      { path: join(buildSassDir, '**/*.scss'), rootPath: buildSassDir, outputPath: releaseStylesDir },
      { path: join(buildStylesDir, '**/*.css'), rootPath: buildStylesDir, outputPath: releaseDistDir },
      { path: join(libPackageDir, 'package.json'), outputPath: releaseRootDir }
    ];

    // Check if there are any project-specified files that need to be copied to the package
    if (Array.isArray(config.context.packageConfig.copyFiles) && config.context.packageConfig.copyFiles.length) {
      for (const descriptor of config.context.packageConfig.copyFiles) {
        const path = resolve(config.paths.rootDir, descriptor.pattern);
        const rootPath = resolve(config.paths.rootDir, descriptor.root);
        const outputPath = join(releaseRootDir, descriptor.output);
        fileConfigs.push({ path, rootPath, outputPath });
      }
    }

    await copyFilesMultiple(fileConfigs);

    // Append license headers to all .js|.scss|.css files in the package
    await appendLicenseHeaders(config, join(releaseRootDir, '**/*.*(js|scss|css)'));
  }, config.quiet);
}

/**
 * Creates an ES2015 module bundle for the input module
 * @param config The environment configuration.
 * @param buildDir The path to the build directory.
 * @param outputDir 
 * @param packageName 
 * @param version 
 * @param rollupGlobals 
 */
export async function createModuleBundles(config: IBuildTaskConfiguration, entryName: string, buildDir: string, outputDir: string, packageName: string, version: string, rollupGlobals: { [key: string]: string }): Promise<void> {
  // Create ES module bundle
  const rollupConfig: IBundleConfig = {
    name: packageName,
    input: join(buildDir, `${entryName}.js`),
    file: join(outputDir, `${packageName}.js`),
    format: 'es',
    version,
    minify: false // We let consumers minify our ES module bundles as they are typically not loaded directly
  };
  await createRollupBundleTask(config, rollupConfig, rollupGlobals, config.context.license?.header);
}

/**
 * Removes all .js files from the build directory recursively.
 * @param buildDir The path to the build directory.
 */
export async function deleteJavaScriptFiles(buildDir: string): Promise<void> {
  await deleteFiles(join(buildDir, '**/*.js'));
}

/**
 * Removes all .css/.scss/.html files from the provided directory recursively.
 * @param {string} dir The path to the directory.
 */
export async function removeInlinedFiles(dir: string): Promise<void> {
  await deleteFiles(join(dir, '**/*.{css,scss,html}'));
}

/**
 * Get all rollup globals to ignore.
 * @param libDir The path to the lib directory.
 * @param packageName The package name.
 * @param externalDependencies Any external dependencies to include.
 */
export function getRollupGlobals(libDir: string, packageName: string, externalDependencies: { [key: string]: string }): { [key: string]: string } {
  const rollupGlobals: { [key: string]: string } = {
    tslib: 'tslib'
  };

  if (externalDependencies && typeof externalDependencies === 'object' && !(externalDependencies instanceof Array) && Object.keys(externalDependencies).length) {
    Object.assign(rollupGlobals, externalDependencies);
  }
  
  // Add the sub-packages to the rollup globals
  const moduleNames = getDirectoriesContainingFiles(libDir, 'package.json');
  moduleNames.forEach(name => {
    // const fullPackageName = `${packageName}-${dashify(name)}`;
    rollupGlobals[packageName] = packageName;
  });

  return rollupGlobals;
}

/**
 * Remocves all unsused selectors from the built CSS files.
 * 
 * Tests all .js and .html files selector usages to make sure we don't ship unused CSS.
 * @param config The environment configuration.
 * @param outputDir The output directory to search in.
 */
export async function removeUnusedSelectorsTask(config: IBuildTaskConfiguration, outputDir: string): Promise<void> {
  const cssDirs = findDirectoriesContainingFileByExtension(outputDir, '.css');
  const promises: Array<Promise<void>> = [];
  const defaultWhitelist = ['*host*'];

  for (const cssDir of cssDirs) {
    const buildJsonPath = join(config.paths.libDir, cssDir.name, config.context.buildConfigFileName);
    const buildConfig = await readJsonFile(buildJsonPath) as IBuildConfig | undefined;

    if (!buildConfig || !buildConfig.skipPurifyCss) {
      const hasWhitelist = buildConfig && buildConfig.purifycss && buildConfig.purifycss.whitelist && buildConfig.purifycss.whitelist instanceof Array;
      const whitelist = buildConfig && hasWhitelist ? defaultWhitelist.concat(buildConfig.purifycss.whitelist) : defaultWhitelist;
      const promise = removeUnusedSelectors(join(cssDir.path, '*.css'), [join(cssDir.path, '*.js'), join(cssDir.path, '*.html')], whitelist);
      promises.push(promise);
    }
  }

  await Promise.all(promises);
}

/**
 * Replace any require statements for .scss files to use .css extensions. This is done to point to the
 * built CSS files after Sass compilation.
 * @param outputDir The output location for the built JavaScript files.
 */
export async function fixupRequireSassTask(outputDir: string): Promise<void> {
  await modifyFile(join(outputDir, '**/*.js'), info => info.contents.replace(/(.)(scss)(['"])/g, '$1css$3'));
}

/**
 * Copies all html files to the output directory.
 * @param srcDir The path to the src directory.
 * @param outputDir The output location for the files.
 */
export async function copyHtmlTemplatesTask(srcDir: string, outputDir: string, libDir: string): Promise<void> {
  const files = await globReferencedBuildFiles(libDir, outputDir, '**/*.html');
  await copyFilesAsync(files, libDir, outputDir);
}

/**
 * Gets an array of files from a target directory that exist in a base directory using a provided file glob pattern.
 * @param baseDir The directory to remap target files to.
 * @param targetDir The directory to compare glob files against.
 * @param pattern The glob file pattern to use for finding files within the target path from the base directory.
 */
export async function globReferencedBuildFiles(baseDir: string, targetDir: string, pattern: string): Promise<string[]> {
  // Detect the directories that were referenced as part of the build for this component, and remap the
  // paths to point back to the lib directory to only copy the templates we care about.
  const compiledDirectories = getDirectories(targetDir).map(dir => join(baseDir, basename(dir), pattern));

  // We need to generate an array of file paths for **only** the directories that actually have .html files
  let files: string[] = [];
  for (const glob of compiledDirectories) {
    files = files.concat(await globFilesAsync(glob));
  }

  return files;
}

/**
 * Compiles the library using webpack to generate a full bundle containing all modules.
 * @param config The environment configuration.
 * @param entry The entry file.
 * @param outputDir The output directory location.
 */
export async function webpackTask(config: IBuildTaskConfiguration, entry: any, outputDir: string, globalVariableName: string, fileNamePrefix: string | null = null): Promise<IWebpackTaskResult> {
  let webpackConfigFactory: WebpackConfigurationFactory;
  
  // We allow for a project-specified webpack config override so use it if it's there
  if (config.paths.webpackConfigPath && await existsAsync(config.paths.webpackConfigPath)) {
    webpackConfigFactory = require(config.paths.webpackConfigPath);
  } else {
    webpackConfigFactory = getWebpackConfigurationFactory();
  }
  
  const tsconfigPath = absolutify(config.context.build.tsconfigPath, config.paths.rootDir);
  
  if (!await existsAsync(tsconfigPath)) {
    throw new Error(`Invalid tsconfig path specified for build configuration: ${tsconfigPath}`);
  }
  
  const env: IWebpackEnv = {
    root: config.paths.rootDir,
    mode: 'production',
    tsconfigPath,
    cache: true,
    entry,
    outputDir: `dist/build/${outputDir}/bundles`,
    clean: false,
    beautify: false,
    minify: true,
    externals: config.context.build.webpack.externals,
    fileNamePrefix,
    globalVariableName: [config.context.build.webpack.variableName || uppercamelcase(config.context.packageName), camelCase(globalVariableName, false)],
    sassLoaderWebpackImporter: config.context.build.webpack.sassLoader.webpackImporter,
    banner: config.context.license.header
  };
  
  // Check for project-level webpack customizations
  if (config.context.build.webpack) {
    env.mode = config.context.build.webpack.mode;
    env.libraryTarget = config.context.build.webpack.libraryTarget;
    
    if (config.context.build.webpack.devtool) {
      env.devtool = {
        production: config.context.build.webpack.devtool.production,
        development: config.context.build.webpack.devtool.development
      };
    }
  }
  
  const stats = await executeWebpack(env, webpackConfigFactory) as webpack.Stats;
  
  if (stats) {
    if (stats.hasErrors()) {
      Logger.newline();
      Logger.error('Webpack failed:');
      Logger.print(chalk.red(stats.toString('errors-only')));
      process.exit(1);
    }
    
    if (stats.hasWarnings()) {
      Logger.newline();
      Logger.warn('Webpack completed with warnings:');
      Logger.print(chalk.yellow(stats.toString()));
    }
  }
  
  const statsJson = stats.toJson();
  const assets = statsJson.assets?.filter(asset => asset.type === 'asset').map(asset => asset.name) as string[];
  
  return {
    assets,
    outputPath: statsJson.outputPath as string
  };
}

/**
 * 
 * @param config 
 * @param entry 
 * @param outputDir 
 */
async function minifyWebpackTask(result: IWebpackTaskResult): Promise<void> {
  const webpackAssets = result.assets.map(asset => ({ filename: asset, code: '' }));
  for (const entry of webpackAssets) {
    const filePath = join(result.outputPath, entry.filename);
    const code = await readFileAsync(filePath, 'utf-8');

    try {
      const minifyResult = await minify(code, { sourceMap: true });

      if (minifyResult && minifyResult.code) {
        const outputFileName = entry.filename.replace(/\.js$/, '.min.js');
        await writeFileAsync(join(result.outputPath, outputFileName), minifyResult.code, 'utf-8');
        if (minifyResult.map) {
          await writeFileAsync(join(result.outputPath, `${outputFileName}.map`), minifyResult.map as string, 'utf-8');
        }
      }
    } catch (e) {
      throw new Error(`Unable to minify file "${entry.filename}": ${e}`);
    }
  }
}

/**
 * Prepares the built JavaScript files for rollup.
 * @param outputDir The location of the built files.
 */
export async function fixupPreRollupTask(outputDir: string): Promise<void> {
  await inlineContentTask(outputDir);
  await removeCustomElementDefinitions(outputDir);
  await removeInlinedFiles(outputDir);
}

/**
 * Inlines .html and .css files within the transpiled JavaScript files.
 * @param outputDir 
 */
export async function inlineContentTask(outputDir: string): Promise<void> {
  const importRegex = /import(.*)from ['"](\.\.?\/[^'"]+\.(?:html|s?css))['"]/g;

  await modifyFile(join(outputDir, '**/*.js'), async info => {
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
 * Removes `customElements.define` calls in the transpiled JavaScript files to prepare for rollup.
 */
export async function removeCustomElementDefinitions(outputDir: string): Promise<void> {
  const customElementRegex = /if\s*\(.*\)\s*\{?\r?\n?.*customElements\.define.*\r?\n?\}?\n/g;
  await modifyFile(join(outputDir, '**/*.js'), info => info.contents.replace(customElementRegex, ''));
}

/**
 * Creates a rollup bundle from the specified rollup configuration.
 * @param config The environment configuration.
 * @param rollupConfig The rollup configuration.
 * @param rollupGlobals Extra global modules to ignore during rollup.
 */
export async function createRollupBundleTask(config: IBuildTaskConfiguration, rollupConfig: IBundleConfig, rollupGlobals: { [key: string]: string }, banner = ''): Promise<void> {
  const bundleConfig: IRollupBundleConfig = {
    input: rollupConfig.input,
    name: rollupConfig.name,
    format: rollupConfig.format,
    file: rollupConfig.file,
    version: rollupConfig.version,
    minify: rollupConfig.minify,
    globals: rollupGlobals,
    banner,
    plugins: [
      rollupNodeResolve({
        customResolveOptions: {
          paths: resolve(config.cwd, 'node_modules')
        }
      }),
      rollupCommonJs({
        namedExports: config.context.namedExports
      })
    ]
  };

  await createRollupBundle(bundleConfig);
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
export async function compileTypeScriptTask(config: IBuildTaskConfiguration, srcDir: string, libDir: string, outputDir: string, target: ts.ScriptTarget, module: ts.ModuleKind, declaration = false): Promise<void> {
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
 * Compiles all references .scss files in a given component build directory.
 * @param srcDir The location of .scss files to compile.
 * @param outputDir The output location for the compilation results.
 */
export async function compileReferencedSassTask(libDir: string, outputDir: string): Promise<string[]> {
  const files = await globReferencedBuildFiles(libDir, outputDir, '**/[^_]*.scss');
  return compileSass(files, libDir, outputDir);
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
async function compileConfiguredStyleSheets(srcDir: string, libDir: string, buildOutputDir: string): Promise<void> {
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
    await compileSass(sassFiles, libDir, join(buildOutputDir, 'styles'));
  }
}

/**
 * Reads the build.json file from the provided component directory.
 * @param dir {string} The path to the component directory that contains the build.json file.
 */
export async function resolveBuildJson(dir: string): Promise<IComponentBuildJson> {
  try {
    const path = resolve(dir, 'build.json');
    let buildJson = await readJsonFile(path) as IComponentBuildJson ?? {};

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
    Logger.error(`Unable to read build.json file at "${dir}".\n\n${chalk.red(e.message)}`);
    throw e;
  }
}

export async function appendLicenseHeaders(config: IBuildTaskConfiguration, glob: string): Promise<void> {
  if (!config.context.license.header) {
    Logger.newline();
    Logger.warn('No license header configured. Skipping.');
    return;
  }

  return runTask('Appending license headers...', async () => {
    const files = await globFilesAsync(glob);
    if (!files.length) {
      Logger.warn('Unable to locate any files to add license header to.');
    }

    for (const file of files) {
      let contents = await readFileAsync(file, 'utf8');
      if (contents.includes(config.context.license.header as string)) {
        continue;
      }
      contents = `${config.context.license.header}${contents}`;
      await writeFileAsync(file, contents, 'utf8');
    }
  }, config.quiet);
}
