import { IProjectConfig } from './core/definitions';

export const DEFAULT_PACKAGE_ORG = '@tylertech';
export const DEFAULT_PACKAGE_NAME = 'forge';
export const CONFIG_FILENAME = 'forge.json';
export const DEFAULT_COMPONENT_PREFIX = 'forge';
export const CURRENT_TEMPLATE_VERSION = 'v1';
export const DEFAULT_SRC_DIR_NAME = 'src';
export const DEFAULT_LIB_DIR_NAME = 'lib';
export const DEFAULT_DEMO_DIR_NAME = 'demo';
export const DEFAULT_TEST_DIR_NAME = 'test';
export const DEFAULT_DIST_DIR_NAME = 'dist';
export const DEFAULT_FRAMEWORK_WRAPPER_DIR_NAME = 'framework-wrappers';
export const BUILD_CONFIG_FILENAME = 'build.json';
export const FULL_BUILD_DIR_NAME = 'lib';
export const TEMP_BUILD_DIR_NAME = 'staging';
export const BUNDLE_OUTPUT_DIR_NAME = 'bundles';
export const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org/';
export const DEFAULT_BUILD_TSCONFIG_NAME = 'tsconfig-build.json';

/** The default project configuration to use. */
export const DEFAULT_PROJECT_CONFIG: IProjectConfig = {
  srcDirName: DEFAULT_SRC_DIR_NAME,
  libDirName: DEFAULT_LIB_DIR_NAME,
  demoDirName: DEFAULT_DEMO_DIR_NAME,
  testDirName: DEFAULT_TEST_DIR_NAME,
  distDirName: DEFAULT_DIST_DIR_NAME,
  buildConfigFileName: BUILD_CONFIG_FILENAME,
  packageOrg: DEFAULT_PACKAGE_ORG,
  packageName: DEFAULT_PACKAGE_NAME,
  registry: DEFAULT_NPM_REGISTRY,
  license: {},
  templateVersion: CURRENT_TEMPLATE_VERSION,
  build: {
    webpack: {
      sassLoader: {
        webpackImporter: true
      }
    },
    demo: { componentBundles: [] },
    rollup: {},
    esbuild: {},
    tsconfigPath: `${DEFAULT_SRC_DIR_NAME}/${DEFAULT_LIB_DIR_NAME}/${DEFAULT_BUILD_TSCONFIG_NAME}`,
    static: {
      enabled: true,
      distPath: 'static'
    }
  },
  packageConfig: {},
  customElementsManifestConfig: {},
  karma: {},
  paths: {
    rootDir: '.',
    distDir: DEFAULT_DIST_DIR_NAME,
    distBuildDir: `${DEFAULT_DIST_DIR_NAME}/build`,
    distDemoDir: `${DEFAULT_DIST_DIR_NAME}/${DEFAULT_DEMO_DIR_NAME}`,
    distStylesDir: `${DEFAULT_DIST_DIR_NAME}/styles`,
    distReleaseDir: `${DEFAULT_DIST_DIR_NAME}/release`,
    distMetadataDir: `${DEFAULT_DIST_DIR_NAME}/metadata`,
    srcDir: DEFAULT_SRC_DIR_NAME,
    libDir: `${DEFAULT_SRC_DIR_NAME}/${DEFAULT_LIB_DIR_NAME}`,
    testDir: `${DEFAULT_SRC_DIR_NAME}/${DEFAULT_TEST_DIR_NAME}`,
    specDir: `${DEFAULT_SRC_DIR_NAME}/${DEFAULT_TEST_DIR_NAME}/spec`,
    demoDir: `${DEFAULT_SRC_DIR_NAME}/${DEFAULT_DEMO_DIR_NAME}`,
    stylelintConfigPath: '.stylelintrc',
    webpackConfigPath: 'webpack.config.js',
    karmaConfigPath: 'karma.config.js'
  }
};

/** The regular expression to use for the template interolation variables. */
export const TEMPLATE_INTERPOLATION_REGEX = /<%=([\s\S]+?)%>/g;
