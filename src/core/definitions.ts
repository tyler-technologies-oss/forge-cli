import {
  IPackageJson,
  type SassCompileOptions
} from '@tylertech/forge-build-tools';
import { ICommand } from './command.js';

export interface ICliConfig {
  binDir: string;
  rootDir: string;
  package: IPackageJson;
}

export interface IConfig {
  commands: ICommand[];
  cwd: string;
  cli: ICliConfig;
  context: IProjectConfig;
}

export interface IProjectConfig {
  libDirName: string;
  srcDirName: string;
  distDirName: string;
  buildConfigFileName: string;
  license: IProjectLicenseConfig;
  paths: IProjectConfigPaths;
  build: IBuildProjectConfig;
  packageConfig: IPackageConfig;
  customElementsManifestConfig: ICustomElementsManifestConfig;
}

export interface ICustomElementsManifestConfig {
  configFileName?: string;
  disableAutoGeneration?: boolean;
  outputPath?: string;
}

export interface IProjectLicenseConfig {
  header?: string;
}

export interface IPackageConfig {
  copyFiles?: ICopyFileDescriptor[];
}

export interface ICopyFileDescriptor {
  pattern: string;
  output: string;
  root: string;
}

export interface IBuildProjectConfig {
  esbuild: IEsbuildProjectConfig;
  sassOptions?: SassCompileOptions['sassOptions'];
  tsconfigPath: string;
  static: IBuildStaticConfig;
  distributionBundleName: string;
}

export interface IBuildStaticConfig {
  enabled: boolean;
  includeWithPackage: boolean;
  codeSplitting: boolean;
  distPath: string;
}

export interface IEsbuildProjectConfig {
  target?: string | string[];
  supported?: Record<string, boolean>;
  minify?: boolean;
  bundle?: boolean;
}

export interface IProjectConfigPaths {
  rootDir: string;
  distDir: string;
  distBuildDir: string;
  distStylesDir: string;
  distReleaseDir: string;
  distMetadataDir: string;
  srcDir: string;
  libDir: string;
}

export interface IGlobalOptions {
  verbose?: boolean;
  quiet?: boolean;
  version?: boolean;
}
