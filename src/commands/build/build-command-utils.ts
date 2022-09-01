import { join, parse, resolve } from 'canonical-path';
import ts from 'typescript';
import {
  copyFilesAsync,
  copyFilesMultiple,
  deleteDir,
  globFilesAsync,
  IFileCopyConfig,
  IPackageJson,
  mkdirp,
  runCommand,
  runTask,
  writeFileAsync
} from '@tylertech/forge-build-tools';
import {
  appendLicenseHeaders,
  compileConfiguredStyleSheets,
  compileSassTask,
  compileTypeScriptTask,
  fixupRequireSassTask,
  generateStaticESModuleSources,
  IBuildTaskConfiguration,
  inlineContentTask,
  resolveBuildJson
} from '../../utils/build-utils';
import { generateCustomElementsManifest } from '../../utils/manifest-utils';

/**
 * Prepares the staging directory for a new build of the library.
 * @param config The prebuild configuration
 */
export async function prebuild({
  buildRoot,
  buildDir,
  buildOutputDir,
  srcDir,
  quiet = false
}: {
  buildRoot: string;
  buildDir: string;
  buildOutputDir: string;
  srcDir: string;
  quiet?: boolean;
}): Promise<void> {
  return runTask('Preparing for build...', async () => {
    // Clean previous build
    await deleteDir(buildRoot);

    // Create the staging directories
    await mkdirp(buildDir);
    await mkdirp(buildOutputDir);

    // Mirror the source files to the staging directory
    const stagingSrcDir = join(buildOutputDir, 'src');
    await copyFilesAsync(join(srcDir, '**/*'), srcDir, stagingSrcDir);
  }, quiet);
}

export async function build({
  config,
  buildOutputDir,
  quiet = false
}: {
  config: IBuildTaskConfiguration;
  buildOutputDir: string;
  quiet?: boolean;
}): Promise<void> {
  const stagingSrcDir = join(buildOutputDir, 'src');
  const esmBuildDir = join(buildOutputDir, 'esm');
  const esbuildBuildDir = join(buildOutputDir, 'esbuild');
  const typingsDir = join(buildOutputDir, 'typings');
  const cssBuildDir = join(buildOutputDir, 'css');
  const buildConfig = await resolveBuildJson(stagingSrcDir);

  if (!buildConfig?.entry) {
    throw new Error(`An entry file must be specified in your build.json.`);
  }

  const { name: entryName } = parse(buildConfig.entry);

  // This task will compile and inline .scss|.html files into their referenced source files
  await runTask('Compiling and inlining assets...', async () => {
    // We need to first compile the configured global stylesheets to their output directory
    await compileConfiguredStyleSheets(stagingSrcDir, stagingSrcDir, cssBuildDir);

    // Compile all Sass files across the library as these may be referenced components or other Sass files
    // Note: we can't guarantee or make any assumptions that there isn't duplication of work with the step above unfortunately...
    await compileSassTask(stagingSrcDir, stagingSrcDir);

    // Replace the .scss imports with .css extension in the staging files to allow our inline content task to execute
    await fixupRequireSassTask(stagingSrcDir);

    // Inline the imported .scss and .html assets to the source files
    await inlineContentTask(stagingSrcDir);
  }, quiet);

  // Compile TypeScript to JavaScript ESM (includes bare module specifiers)
  await runTask('Compiling sources...', async () => {
    await compileTypeScriptTask(config, stagingSrcDir, stagingSrcDir, esmBuildDir, ts.ScriptTarget.ES2017, ts.ModuleKind.ES2015, true, typingsDir);
  }, quiet);

  // Bundles the library with code-splitting to generate a self-contained ESM distribution
  await runTask('Bundling ESM distribution sources...', async () => {
    // Build the library entry points
    const libEntry = join(stagingSrcDir, `${entryName}.ts`);
    const componentEntries = await globFilesAsync(join(stagingSrcDir, '**/index.ts')) as string[];

    // Generate the static ES module distribution sources
    // Note: this will bundle dependencies with code splitting, and **without** bare module specifiers
    await generateStaticESModuleSources({
      outdir: esbuildBuildDir,
      entryPoints: [libEntry, ...componentEntries]
    });
  });

  // Generates Custom Elements Manifest file.
  if (!config.context.customElementsManifestConfig?.disableAutoGeneration) {
    await runTask('Generating custom elements manifest...', async () => {
      await generateCustomElementsManifest(config.context, stagingSrcDir);
    });
  }
}

export async function createDistributionPackage({
  config,
  buildOutputDir,
  packageJson
}: {
  config: IBuildTaskConfiguration;
  buildOutputDir: string;
  packageJson: IPackageJson;
}): Promise<void> {
  await runTask('Creating distribution package...', async () => {
    // Set package directory paths
    const projectRootDir = config.context.paths.rootDir;
    const releaseRootDir = join(config.paths.distReleaseDir, packageJson.name);
    const releaseDistDir = join(releaseRootDir, 'dist');
    const releaseEsmDir = join(releaseRootDir, 'esm');
    const releaseStylesDir = join(releaseRootDir, 'styles');
    const releaseDistEsmDir = join(releaseDistDir, 'esm');
    const releaseTypingsDir = releaseEsmDir;
    const buildEsmDir = join(buildOutputDir, 'esm');
    const buildTypingsDir = join(buildOutputDir, 'typings');
    const buildCssDir = join(buildOutputDir, 'css');
    const buildSrcDir = join(buildOutputDir, 'src');
    const esbuildOutputDir = join(buildOutputDir, 'esbuild');

    // Clean previous release build
    await deleteDir(config.paths.distReleaseDir);

    // Build package directory structure
    await mkdirp(releaseRootDir);
    await mkdirp(releaseDistDir);
    await mkdirp(releaseEsmDir);
    await mkdirp(releaseDistEsmDir);
    await mkdirp(releaseStylesDir);
    await mkdirp(releaseTypingsDir);

    // Append license headers to all files in the package
    await appendLicenseHeaders(config, join(buildOutputDir, '**/*.*(js|scss|css|d.ts)'));

    // Copy files from build output to the package structure
    const customElementsFiles = config.context.customElementsManifestConfig?.disableAutoGeneration
      ? []
      : [{ path: join(buildSrcDir, 'custom-elements.json'), rootPath: buildSrcDir, outputPath: releaseRootDir }];
    const fileConfigs: IFileCopyConfig[] = [
      { path: join(buildEsmDir, '**/*.js*'), rootPath: buildEsmDir, outputPath: releaseEsmDir },
      { path: join(esbuildOutputDir, '**/*.js*'), rootPath: esbuildOutputDir, outputPath: releaseDistEsmDir },
      { path: join(buildTypingsDir, '**/*.d.ts'), rootPath: buildTypingsDir, outputPath: releaseTypingsDir },
      { path: join(buildCssDir, '**/*.css'), rootPath: buildCssDir, outputPath: releaseDistDir },
      { path: join(buildSrcDir, '**/*.scss'), rootPath: buildSrcDir, outputPath: releaseStylesDir },
      { path: join(projectRootDir, 'README.md'), rootPath: projectRootDir, outputPath: releaseRootDir },
      { path: join(projectRootDir, 'LICENSE'), rootPath: projectRootDir, outputPath: releaseRootDir },
      ...customElementsFiles
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

    // Generate a package.json for the package
    const { name, version, description, author, license, repository, dependencies, peerDependencies } = packageJson;
    const customElements = config.context.customElementsManifestConfig?.disableAutoGeneration ? {} : { customElements: 'custom-elements.json' };
    const distPackageJson = {
      name,
      description,
      version,
      author,
      license,
      repository,
      main: 'esm/index.js',
      module: 'esm/index.js',
      typings: 'esm/index.d.ts',
      sideEffects: false,
      dependencies,
      peerDependencies,
      ...customElements
    };
    const data = JSON.stringify(distPackageJson, null, 2);
    await writeFileAsync(join(releaseRootDir, 'package.json'), data, 'utf8');
  }, config.quiet);
}

/** Copies assets from the package dist directory to the static distribution directory. */
export async function copyBundledDistributionAssets({
  config,
  packageJson,
  buildOutputDir
}: {
  config: IBuildTaskConfiguration;
  packageJson: IPackageJson;
  buildOutputDir: string;
}): Promise<void> {
  return runTask('Copying static distribution assets...', async () => {
    const jsBuildDir = join(buildOutputDir, 'esbuild');
    const cssBuildDir = join(buildOutputDir, 'css');
    const staticOutputDir = join(config.paths.distDir, config.context.build.static.distPath, packageJson.name);

    // Clean previous build
    await deleteDir(staticOutputDir);

    // Copy all required assets and retain directory structure
    const fileConfigs: IFileCopyConfig[] = [
      { path: join(jsBuildDir, '**/*.js*'), rootPath: jsBuildDir, outputPath: staticOutputDir },
      { path: join(cssBuildDir, '**/*.css'), rootPath: cssBuildDir, outputPath: staticOutputDir }
    ];
    await copyFilesMultiple(fileConfigs);
  }, config.quiet);
}
