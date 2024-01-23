import { IPackageJson, OS } from '@tylertech/forge-build-tools';
import { ICommand } from './command';

export interface ICliConfig {
  binDir: string;
  rootDir: string;
  templatesDirName: string;
  templatesDir: string;
  templateVersion: string;
  package: IPackageJson;
}

export interface IConfig {
  commands: ICommand[];
  cwd: string;
  cli: ICliConfig;
  os: OS;
  context: IProjectConfig;
  getPackageRegistry(): string | undefined;
}

export interface IProjectConfig {
  templateVersion: string;
  libDirName: string;
  srcDirName: string;
  demoDirName: string;
  testDirName: string;
  distDirName: string;
  buildConfigFileName: string;
  packageOrg: string;
  packageName: string;
  registry: string;
  license: IProjectLicenseConfig;
  paths: IProjectConfigPaths;
  build: IBuildProjectConfig;
  karma: IKarmaProjectConfig;
  packageConfig: IPackageConfig;
  customElementsManifestConfig: ICustomElementsManifestConfig;
}

export interface ICustomElementsManifestConfig {
  configFileName?: string;
  disableAutoGeneration?: boolean;
}

export interface IProjectLicenseConfig {
  header?: string;
}

export interface IProjectDemoConfig {
  componentBundles: string[];
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
  webpack: IWebpackProjectConfig;
  rollup: IRollupProjectConfig;
  esbuild: IEsbuildProjectConfig;
  tsconfigPath: string;
  demo: IProjectDemoConfig;
  static: IBuildStaticConfig;
}

export interface IWebpackProjectConfig {
  mode?: 'development' | 'production';
  libraryTarget?: string;
  devtool?: IDevtoolConfig;
  externals?: any;
  filename?: string;
  variableName?: string | string[];
  sassLoader: IWebpackSassLoaderConfig;
}

export interface IBuildStaticConfig {
  enabled: boolean;
  distPath: string;
}

export interface IWebpackSassLoaderConfig {
  webpackImporter: boolean;
}

export interface IRollupProjectConfig {
  bundle?: boolean;
}

export interface IEsbuildProjectConfig {
  target?: string | string[];
  supported?: Record<string, boolean>;
  minify?: boolean;
  bundle?: boolean;
}

export interface IDevtoolConfig {
  production: string;
  development: string;
}

export interface IKarmaProjectConfig {
  frameworks?: string[];
  plugins?: Array<string | IKarmaPluginDescriptor>;
  files?: string[];
  stylesheets?: string[];
  exclude?: string[];
  coverageThreshold?: ICoverageThreshold;
}

export interface IKarmaPluginDescriptor {
  path: string;
  name: string;
}

export interface ICoverageThreshold {
  statements?: number;
  branches?: number;
  lines?: number;
  functions?: number;
}

export interface IProjectConfigPaths {
  rootDir: string;
  distDir: string;
  distBuildDir: string;
  distDemoDir: string;
  distStylesDir: string;
  distReleaseDir: string;
  distMetadataDir: string;
  srcDir: string;
  libDir: string;
  testDir: string;
  specDir: string;
  demoDir: string;
  stylelintConfigPath: string;
  webpackConfigPath: string;
  karmaConfigPath: string;
}

export interface IBuildConfig {
  skipPurifyCss: boolean;
  purifycss: IBuildConfigPurify;
}

export interface IBuildConfigPurify {
  whitelist: string[];
}

export interface IGlobalOptions {
  verbose?: boolean;
  quiet?: boolean;
  version?: boolean;
}
