import { join, basename, resolve } from 'canonical-path';
import { Question } from 'inquirer';
import chalk from 'chalk';
import { InstallType, InstallFileDescriptor, installFiles, FileTemplateData, absolutify, ensureDir, runCommand, runTask, Logger } from '@tylertech/forge-build-tools';

const uppercamelcase = require('uppercamelcase');

import { IConfig } from '../../core/definitions';
import { TEMPLATE_INTERPOLATION_REGEX, DEFAULT_PACKAGE_ORG, DEFAULT_COMPONENT_PREFIX, DEFAULT_NPM_REGISTRY, CURRENT_TEMPLATE_VERSION, DEFAULT_PROJECT_CONFIG } from '../../constants';
import { printInstallationSummary, assertBoolean } from '../../utils/utils';
import { ICommand, ICommandParameter, ICommandOption, ICommandArg } from '../../core/command';
import { Configuration } from '../../core/configuration';

export interface INewCommandOptions {
  path: string;
  packageOrg: string;
  packageName: string;
  registry: string;
  componentPrefix: string;
  install: boolean | undefined;
  quiet: boolean;
}

/**
 * The command definition for the `new` command for scaffoling out new web component projects within a directory.
 */
export class NewCommand implements ICommand {
  public name = 'new';
  public alias = 'init';
  public description = 'Creates a new empty web component project.';
  public args: ICommandArg[] = [
    {
      name: 'path',
      description: 'The path to the installation directory',
      type: 'String'
    }
  ];
  public options: ICommandOption[] = [
    {
      name: 'path',
      type: String,
      description: 'The path to the installation directory.'
    },
    {
      name: 'packageOrg',
      type: String,
      description: 'The default npm org to use for the packages within the project.'
    },
    {
      name: 'packageName',
      type: String,
      description: 'The npm package name.'
    },
    {
      name: 'registry',
      type: String,
      description: 'The npm registry to use.'
    },
    {
      name: 'componentPrefix',
      type: String,
      description: 'The prefix to use for the custom elements.',
      defaultValue: 'forge'
    },
    {
      name: 'install',
      type: Boolean,
      description: 'Installs dependencies after scaffolding installation.',
      defaultValue: 'true'
    }
  ];

  public async run(param: ICommandParameter): Promise<void> {
    const options: INewCommandOptions = {
      path: param.args.path ? absolutify(param.args.path, param.config.context.paths.rootDir) : '',
      packageOrg: param.args.org,
      packageName: param.args.name,
      registry: param.args.registry,
      componentPrefix: param.args.componentPrefix,
      install: param.args.install !== undefined ? assertBoolean(param.args.install) : undefined,
      quiet: assertBoolean(param.args.quiet)
    };

    // Check if the path arg was specified
    if (param.args._[1]) {
      options.path = absolutify(param.args._[1], param.config.context.paths.rootDir);
    }

    await createProject(param.config, options);
  }
}

/**
 * Creates project scaffolding at the specified location (or cwd if not specified).
 * @param config The environment configuration.
 * @param options The command options.
 */
export async function createProject(config: IConfig, options: INewCommandOptions): Promise<void> {
  if (!options.quiet) {
    if (options.path) {
      Logger.info(`Creating project at: ${chalk.yellow(options.path)}\n`);
    }
    await _prompt(config, options);
  }

  if (!options.packageName) {
    Logger.error('Invalid option: package name is required.');
    return;
  }

  if (!options.path) {
    options.path = config.context.paths.rootDir;
  }

  // Find the project tempalte directory based on template version
  const commonRoot = join(config.cli.templatesDir, config.cli.templateVersion, 'common');
  const templateRoot = join(config.cli.templatesDir, config.cli.templateVersion, 'project');

  // This is the data that is available to our project template files
  const templateData = {
    packageOrg: options.packageOrg,
    packageName: options.packageName,
    packageNameVariable: uppercamelcase(options.packageName),
    registry: options.registry,
    fullPackageName: options.packageOrg ? `${options.packageOrg}/${options.packageName}` : options.packageName,
    componentPrefix: options.componentPrefix
  };

  // The file install descriptors for the files to be installed
  const files: InstallFileDescriptor[] = [
    {
      type: InstallType.Copy,
      path: join(templateRoot, 'gitignore'),
      outputPath: join(options.path, '.gitignore')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'npmrc'),
      outputPath: join(options.path, '.npmrc')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'stylelintrc'),
      outputPath: join(options.path, '.stylelintrc')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'package.json'),
      outputPath: join(options.path, 'package.json')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'forge.json'),
      outputPath: join(options.path, 'forge.json')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'tsconfig.json'),
      outputPath: join(options.path, 'tsconfig.json')
    },
    {
      type: InstallType.Copy,
      path: join(templateRoot, 'eslintrc.json'),
      outputPath: join(options.path, '.eslintrc.json')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'src/lib/constants.ts'),
      outputPath: join(options.path, 'src/lib/constants.ts')
    },
    {
      type: InstallType.Copy,
      path: join(templateRoot, 'src/lib/index.ts'),
      outputPath: join(options.path, 'src/lib/index.ts')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'src/lib/package.json'),
      outputPath: join(options.path, 'src/lib/package.json')
    },
    {
      type: InstallType.Copy,
      path: join(templateRoot, 'src/lib/build.json'),
      outputPath: join(options.path, 'src/lib/build.json')
    },
    {
      type: InstallType.Copy,
      path: join(templateRoot, 'src/lib/tsconfig-build.json'),
      outputPath: join(options.path, 'src/lib/tsconfig-build.json')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'src/tsconfig-test.json'),
      outputPath: join(options.path, 'src/tsconfig-test.json')
    },
    {
      type: InstallType.Copy,
      path: join(commonRoot, 'favicon.ico'),
      outputPath: join(options.path, 'src/demo/favicon.ico')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'src/demo/index.html'),
      outputPath: join(options.path, 'src/demo/index.html')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'src/demo/styles/styles.css'),
      outputPath: join(options.path, 'src/demo/styles/styles.css')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'src/test/spec/index.ts'),
      outputPath: join(options.path, 'src/test/spec/index.ts')
    }
  ];

  try {
    await installFiles(files, new FileTemplateData(templateData), { interpolate: TEMPLATE_INTERPOLATION_REGEX });
  } catch (e) {
    Logger.fatal(`An error occurred while installing project files: ${e}`);
  }

  await printInstallationSummary(files, options.path);

  if (options.install) {
    await installDependencies(options.path);
  }
}

/**
 * Installs all depdendecies in the installation directory.
 * @param installationDir 
 */
async function installDependencies(installationDir: string): Promise<void> {
  await runTask('Installing dependencies...', async () => {
    await runCommand('npm install', installationDir);
  });
}

/**
 * Prompts the user for any required information that was not specified through arguments.
 * @param config The CLI environmetn config.
 * @param options The command arguments.
 */
async function _prompt(config: IConfig, options: INewCommandOptions): Promise<void> {
  const questions: Question[] = [];

  if (!options.path) {
    questions.push({
      type: 'input',
      name: 'path',
      message: 'Installation path:',
      default: config.context.paths.rootDir,
      filter: value => absolutify(value, config.context.paths.rootDir)
    });
  }

  if (!options.packageOrg) {
    questions.push({
      type: 'input',
      name: 'packageOrg',
      message: 'Please enter the package org (leave blank for no org):',
      default: DEFAULT_PACKAGE_ORG
    });
  }

  if (!options.packageName) {
    questions.push({
      type: 'input',
      name: 'packageName',
      message: 'Please enter the package name:',
      validate: val => !val ? 'Package name is required.' : true,
      default: answers => basename(options.path || answers.path || config.context.paths.rootDir)
    });
  }

  if (!options.registry) {
    questions.push({
      type: 'input',
      name: 'registry',
      message: 'Please enter the npm registry to use:',
      validate: val => !val ? 'Registry is required.' : true,
      default: DEFAULT_NPM_REGISTRY
    });
  }

  if (!options.componentPrefix) {
    questions.push({
      type: 'input',
      name: 'componentPrefix',
      message: 'What component prefix would you like to use?',
      default: DEFAULT_COMPONENT_PREFIX,
      filter: (val: string) => val.toLowerCase(),
      validate: (val: string) => {
        if (!val) {
          return 'Component prefix is required.';
        } else if (!/^[a-zA-Z]/gm) {
          return 'Invalid prefix specified. Must start with a character.';
        }
        return true;
      }
    });
  }

  if (options.install === undefined) {
    questions.push({
      type: 'confirm',
      name: 'install',
      message: 'Install npm dependencies?',
      default: true
    });
  }

  if (questions.length) {
    const inquirer = await import('inquirer');
    const answers = await inquirer.prompt(questions);
    Object.assign(options, answers);
  }
}
