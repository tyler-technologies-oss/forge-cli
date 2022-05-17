import { camelCase, dashify, ensureDir, existsAsync, FileTemplateData, InstallFileDescriptor, installFiles, InstallType, Logger, readFileAsync, writeFileAsync } from '@tylertech/forge-build-tools';
import { join, relative } from 'canonical-path';
import chalk from 'chalk';
import { chmodSync } from 'fs';
import { DEFAULT_COMPONENT_PREFIX, TEMPLATE_INTERPOLATION_REGEX } from '../../constants';
import { ICommand, ICommandArg, ICommandOption, ICommandParameter } from '../../core/command';
import { IConfig } from '../../core/definitions';
import { assertBoolean, printInstallationSummary } from '../../utils/utils';

export interface IGenerateComponentCommandOptions {
  spec: boolean;
  export: boolean;
  prefix: string;
}

/**
 * The command definition for generating web component scaffolding.
 */
export class GenerateComponentCommand implements ICommand {
  public name = 'component';
  public alias = 'c';
  public description = 'Creates a new Forge Web Component within the lib directory using the provided name.';
  public args: ICommandArg[] = [
    {
      name: 'name',
      type: String.name,
      required: true,
      description: 'The name of the component.'
    }
  ];
  public options: ICommandOption[] = [
    {
      name: 'spec',
      type: Boolean,
      description: 'Generate a .spec file for this component in the test directory.',
      defaultValue: 'true'
    },
    {
      name: 'export',
      type: Boolean,
      description: 'Exports this component in the main index.ts.',
      defaultValue: 'true'
    },
    {
      name: 'prefix',
      type: String.name,
      description: 'The element name prefix to use.',
      defaultValue: DEFAULT_COMPONENT_PREFIX
    }
  ];

  public validator(param): string | undefined {
    return !param.args._[2] ? 'You must provide a component name.' : undefined;
  }

  public async run(param: ICommandParameter): Promise<void> {
    const options: IGenerateComponentCommandOptions = {
      spec: assertBoolean(param.args.spec, true),
      export: assertBoolean(param.args.export, true),
      prefix: param.args.prefix ?? DEFAULT_COMPONENT_PREFIX
    };
    await createComponent(param.config, param.args._[2], options);
  }
}

/**
 * Generates a new web component.
 * @param config The CLI config.
 * @param componentName The name of the component to generate.
 */
async function createComponent(config: IConfig, componentName: string, options: IGenerateComponentCommandOptions): Promise<void> {
  // We always convert names to lowercase separated by dashes
  componentName = dashify(componentName);
  const pathParts = (componentName.includes('/') ? componentName.split('/') : [componentName]).map(part => dashify(part));

  if (pathParts.length > 1) {
    componentName = pathParts[pathParts.length - 1];
  }

  // Get the directory path for the new component, make sure it doesn't exist already, then create the new directory
  const componentDirPath = join(config.context.paths.libDir, pathParts.join('/'));

  if (await existsAsync(componentDirPath)) {
    throw new Error(`Component already exists at path: ${componentDirPath}`);
  }

  await ensureDir(componentDirPath);

  // This is the data that is available to our component templates
  const templateData = {
    componentName,
    componentClassName: camelCase(componentName),
    componentConstantName: componentName.replace(/-/g, '_').toUpperCase(),
    packageOrg: config.context.packageOrg,
    packageName: config.context.packageName,
    registry: config.context.registry,
    fullPackageName: config.context.packageOrg ? `${config.context.packageOrg}/${config.context.packageName}` : config.context.packageName,
    prefixImportPath: relative(componentDirPath, config.context.paths.libDir),
    componentPrefix: options.prefix
  };

  // Find the components templates based on template version
  const templateRoot = join(config.cli.templatesDir, config.cli.templateVersion, 'component');

  // Define the files to be installed
  const files: InstallFileDescriptor[] = [
    {
      type: InstallType.Template,
      path: join(templateRoot, '_mixins.scss'),
      outputPath: join(componentDirPath, '_mixins.scss')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, '_variables.scss'),
      outputPath: join(componentDirPath, '_variables.scss')
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'component.scss'),
      outputPath: join(componentDirPath, `${componentName}.scss`)
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'component.ts'),
      outputPath: join(componentDirPath, `${componentName}.ts`)
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'component-adapter.ts'),
      outputPath: join(componentDirPath, `${componentName}-adapter.ts`)
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'component-constants.ts'),
      outputPath: join(componentDirPath, `${componentName}-constants.ts`)
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'component-foundation.ts'),
      outputPath: join(componentDirPath, `${componentName}-foundation.ts`)
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'component.html'),
      outputPath: join(componentDirPath, `${componentName}.html`)
    },
    {
      type: InstallType.Template,
      path: join(templateRoot, 'index.ts'),
      outputPath: join(componentDirPath, 'index.ts')
    }
  ];

  if (options.spec) {
    files.push({
      type: InstallType.Template,
      path: join(templateRoot, 'component.spec.ts'),
      outputPath: join(config.context.paths.testDir, 'spec', componentName, `${componentName}.spec.ts`)
    });
  }

  // Install each file using the template data above
  try {
    await installFiles(files, new FileTemplateData(templateData), { interpolate: TEMPLATE_INTERPOLATION_REGEX });
  } catch (e) {
    Logger.print(e.stack);
    Logger.fatal(`An error occurred while installing component files: ${e}`);
  }

  await printInstallationSummary(files, config.context.paths.rootDir);

  // The final step is to locate the main index.ts file to export the component
  if (options.export) {
    const indexDir = join(config.context.paths.libDir, pathParts.splice(0, pathParts.length - 1).join('/'));
    await exportComponent(config, indexDir, componentName, templateData.componentClassName);
  }
}

/**
 * Adds and export statement to the end of the index.ts file at the root of the component library.
 * @param config The CLI config.
 * @param indexDir The directory location of the index.ts file.
 * @param componentName The name of the component.
 */
async function exportComponent(config: IConfig, indexDir: string, componentName: string, componentClassName: string): Promise<void> {
  const indexPath = join(indexDir, 'index.ts');

  if (!await existsAsync(indexPath)) {
    return Logger.error(`Unable to find an index.ts file to export the component: ${indexPath}`);
  }

  // The relative path to the file from the root of the library
  const pathFromRoot = indexPath.replace(config.context.paths.rootDir, '').replace(/^\/?/, '');

  try {
    chmodSync(indexPath, 0o644);
    let contents = await readFileAsync(indexPath, 'utf8');
    componentClassName = `${componentClassName}Component`;
    contents = addExport(contents, componentName);
    await writeFileAsync(indexPath, contents, 'utf8');
    Logger.print(`${chalk.yellow('UPDATED')} ${pathFromRoot}`);
  } catch (e) {
    Logger.print(`${chalk.red(`UPDATE FAILED`)} ${pathFromRoot}`);
  }
}

/**
 * Adds an export statement to the file contents.
 * @param {string} contents The contents of the file.
 * @param {string} componentName The name of the component.
 */
function addExport(contents: string, componentName: string): string {
  // If the file is empty (whitespace characters only), then just put the export statement in
  if (/^\s*$/.test(contents)) {
    return `export * from './${componentName}';\n`;
  }

  const lastExportRegExp = /(^(?:[\s\S]*\n)?export\s+\*\s+.*(?:\r?\n|\r))/;

  if (contents.match(lastExportRegExp)) {
    return contents.replace(lastExportRegExp, `$1export * from './${componentName}';\n`);
  }

  return `${contents}\n\nexport * from './${componentName}';\n`;
}
