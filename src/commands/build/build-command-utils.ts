import cpath from 'canonical-path';
import ts from 'typescript';
import {
  absolutify,
  copyFilesAsync,
  copyFilesMultiple,
  deleteDir,
  existsAsync,
  globFilesAsync,
  IFileCopyConfig,
  IPackageJson,
  mkdirp,
  readJsonFile,
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
} from '../../utils/build-utils.js';
import { generateCustomElementsManifest } from '../../utils/manifest-utils.js';

const { join, parse, resolve } = cpath;

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
    await copyFilesAsync(join(srcDir, '**/*.*'), srcDir, stagingSrcDir, ['**/*.test.ts']);
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
  const bundleBuildDir = join(buildOutputDir, 'bundle');
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
    await compileConfiguredStyleSheets(stagingSrcDir, stagingSrcDir, cssBuildDir, config.context.build.sassOptions);

    // Compile all Sass files across the library as these may be referenced components or other Sass files
    // Note: we can't guarantee or make any assumptions that there isn't duplication of work with the step above unfortunately...
    await compileSassTask(stagingSrcDir, stagingSrcDir, config.context.build.sassOptions);

    // Replace the .scss imports with .css extension in the staging files to allow our inline content task to execute
    await fixupRequireSassTask(stagingSrcDir);

    // Inline the imported .scss and .html assets to the source files
    await inlineContentTask(stagingSrcDir);
  }, quiet);

  
  // Compile TypeScript to JavaScript ESM (includes bare module specifiers)
  await runTask('Compiling sources...', async () => {
    await compileTypeScriptTask(config, stagingSrcDir, stagingSrcDir, esmBuildDir, ts.ScriptTarget.ES2020, ts.ModuleKind.ES2015, true, typingsDir);
  }, quiet);

  // Get the full library entry point
  const libEntry = join(stagingSrcDir, `${entryName}.ts`);

  // Attempt to inherit the ES build target from the build tsconfig if we don't have one set in the project configuration
  let buildTarget = config.context.build.esbuild.target;
  const tsconfigPath = absolutify(config.context.build.tsconfigPath, config.context.paths.rootDir);
  if (!buildTarget && await existsAsync(tsconfigPath)) {
    const buildTsconfig = await readJsonFile<any>(tsconfigPath);
    buildTarget = buildTsconfig.compilerOptions?.target;
  }
  
  await runTask('Creating ESM distribution bundle', async () => {
    await generateStaticESModuleSources({
      outdir: bundleBuildDir,
      outfile: config.context.build.distributionBundleName ?? 'lib.js',
      target: buildTarget,
      supported: config.context.build.esbuild.supported,
      minify: config.context.build.esbuild.minify,
      bundle: true,
      splitting: false,
      entryPoints: [libEntry]
    });
  });

  if (config.context.build.static.enabled) {
    // Bundles the library with code-splitting to generate a self-contained ESM distribution
    await runTask('Compiling code-split ESM distribution sources...', async () => {
      // Collect all the component entry points
      const componentEntries = await globFilesAsync(join(stagingSrcDir, '**/index.ts')) as string[];

      // Generate the static ES module distribution sources
      // Note: this will bundle dependencies with code splitting, and **without** bare module specifiers
      await generateStaticESModuleSources({
        outdir: esbuildBuildDir,
        target: buildTarget,
        splitting: config.context.build.static.codeSplitting,
        supported: config.context.build.esbuild.supported,
        minify: config.context.build.esbuild.minify,
        bundle: config.context.build.esbuild.bundle,
        entryPoints: [libEntry, ...componentEntries]
      });
    });
  }

  // Generates Custom Elements Manifest file.
  if (!config.context.customElementsManifestConfig?.disableAutoGeneration) {
    await runTask('Generating custom elements manifest...', async () => {
      const outDir = config.context.customElementsManifestConfig.outputPath;
      await generateCustomElementsManifest(config.context, config.context.paths.rootDir, { outDir, quiet });
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
    const releaseSassDir = join(releaseRootDir, 'sass');
    const releaseTypingsDir = releaseEsmDir;
    const buildEsmDir = join(buildOutputDir, 'esm');
    const buildTypingsDir = join(buildOutputDir, 'typings');
    const buildCssDir = join(buildOutputDir, 'css');
    const buildSrcDir = join(buildOutputDir, 'src');
    const bundleOutputDir = join(buildOutputDir, 'bundle');
    const customElementsOutputDir = join(config.paths.rootDir, config.context.customElementsManifestConfig.outputPath ?? 'dist/cem');

    // Clean previous release build
    await deleteDir(config.paths.distReleaseDir);

    // Build package directory structure
    await mkdirp(releaseRootDir);
    await mkdirp(releaseDistDir);
    await mkdirp(releaseEsmDir);
    await mkdirp(releaseSassDir);
    await mkdirp(releaseTypingsDir);

    // Append license headers to all files in the package
    await appendLicenseHeaders(config, join(buildOutputDir, '**/*.*(js|scss|css|d.ts)'));

    // Copy files from build output to the package structure
    const customElementsFiles = config.context.customElementsManifestConfig?.disableAutoGeneration
      ? []
      : [{ path: join(customElementsOutputDir, 'custom-elements.json'), rootPath: customElementsOutputDir, outputPath: releaseRootDir }];
    const fileConfigs: IFileCopyConfig[] = [
      { path: join(buildEsmDir, '**/*.js*'), rootPath: buildEsmDir, outputPath: releaseEsmDir },
      { path: join(bundleOutputDir, '**/*.js*'), rootPath: bundleOutputDir, outputPath: releaseDistDir },
      { path: join(buildTypingsDir, '**/*.d.ts'), rootPath: buildTypingsDir, outputPath: releaseTypingsDir },
      { path: join(buildCssDir, '**/*.css'), rootPath: buildCssDir, outputPath: releaseDistDir },
      { path: join(buildSrcDir, '**/*.scss'), rootPath: buildSrcDir, outputPath: releaseSassDir },
      { path: join(projectRootDir, 'README.md'), rootPath: projectRootDir, outputPath: releaseRootDir },
      { path: join(projectRootDir, 'LICENSE'), rootPath: projectRootDir, outputPath: releaseRootDir },
      ...customElementsFiles
    ];

    // Should we include the code-split + bundled ESM build in the package?
    if (config.context.build.static.enabled && config.context.build.static.includeWithPackage) {
      const releaseDistEsmDir = join(releaseDistDir, 'esm');
      const esbuildOutputDir = join(buildOutputDir, 'esbuild');
      await mkdirp(releaseDistEsmDir);
      fileConfigs.push({ path: join(esbuildOutputDir, '**/*.js*'), rootPath: esbuildOutputDir, outputPath: releaseDistEsmDir });
    }

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
    const jsBundleBuildDir = join(buildOutputDir, 'bundle');
    const cssBuildDir = join(buildOutputDir, 'css');
    const staticOutputDir = join(config.paths.distDir, config.context.build.static.distPath, packageJson.name);

    // Clean previous build
    await deleteDir(staticOutputDir);

    // Copy all required assets and retain directory structure
    const fileConfigs: IFileCopyConfig[] = [
      { path: join(jsBuildDir, '**/*.js*'), rootPath: jsBuildDir, outputPath: staticOutputDir },
      { path: join(jsBundleBuildDir, '**/*.js*'), rootPath: jsBundleBuildDir, outputPath: staticOutputDir },
      { path: join(cssBuildDir, '**/*.css'), rootPath: cssBuildDir, outputPath: staticOutputDir }
    ];
    await copyFilesMultiple(fileConfigs);
  }, config.quiet);
}
