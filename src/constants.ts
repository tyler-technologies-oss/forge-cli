import { IProjectConfig } from './core/definitions.js';

export const CONFIG_FILENAME = 'forge.json';
export const DEFAULT_COMPONENT_PREFIX = 'forge';
export const DEFAULT_SRC_DIR_NAME = 'src';
export const DEFAULT_LIB_DIR_NAME = 'lib';
export const DEFAULT_TEST_DIR_NAME = 'test';
export const DEFAULT_DIST_DIR_NAME = 'dist';
export const BUILD_CONFIG_FILENAME = 'build.json';
export const FULL_BUILD_DIR_NAME = 'lib';
export const TEMP_BUILD_DIR_NAME = 'staging';
export const BUNDLE_OUTPUT_DIR_NAME = 'bundles';
export const DEFAULT_BUILD_TSCONFIG_NAME = 'tsconfig-build.json';

/** The default project configuration to use. */
export const DEFAULT_PROJECT_CONFIG: IProjectConfig = {
  srcDirName: DEFAULT_SRC_DIR_NAME,
  libDirName: DEFAULT_LIB_DIR_NAME,
  testDirName: DEFAULT_TEST_DIR_NAME,
  distDirName: DEFAULT_DIST_DIR_NAME,
  buildConfigFileName: BUILD_CONFIG_FILENAME,
  license: {},
  build: {
    webpack: {
      sassLoader: {
        webpackImporter: true
      }
    },
    rollup: {},
    esbuild: {},
    tsconfigPath: `${DEFAULT_SRC_DIR_NAME}/${DEFAULT_LIB_DIR_NAME}/${DEFAULT_BUILD_TSCONFIG_NAME}`,
    static: {
      enabled: true,
      distPath: 'static'
    },
    distributionBundleName: 'lib.js'
  },
  packageConfig: {},
  customElementsManifestConfig: {
    outputPath: 'dist/cem'
  },
  karma: {},
  paths: {
    rootDir: '.',
    distDir: DEFAULT_DIST_DIR_NAME,
    distBuildDir: `${DEFAULT_DIST_DIR_NAME}/build`,
    distStylesDir: `${DEFAULT_DIST_DIR_NAME}/styles`,
    distReleaseDir: `${DEFAULT_DIST_DIR_NAME}/release`,
    distMetadataDir: `${DEFAULT_DIST_DIR_NAME}/metadata`,
    srcDir: DEFAULT_SRC_DIR_NAME,
    libDir: `${DEFAULT_SRC_DIR_NAME}/${DEFAULT_LIB_DIR_NAME}`,
    testDir: `${DEFAULT_SRC_DIR_NAME}/${DEFAULT_TEST_DIR_NAME}`,
    specDir: `${DEFAULT_SRC_DIR_NAME}/${DEFAULT_TEST_DIR_NAME}/spec`,
    stylelintConfigPath: '.stylelintrc',
    webpackConfigPath: 'webpack.config.js',
    karmaConfigPath: 'karma.config.js'
  }
};
