import { getDirectoriesContainingFiles, existsAsync, loadPackageJson, runCommand, runTask, IPackageJson, Logger } from '@tylertech/forge-build-tools';
import { join, dirname } from 'canonical-path';
import getPackageJson, { AbbreviatedMetadata } from 'package-json';
import * as semver from 'semver';

import { ICommand, ICommandParameter, ICommandOption, ICommandArg } from '../../core/command';
import { PublishValidateCommand } from './publish-validate-command';

/**
 * The command definition for the publish package command.
 */
export class PublishCommand implements ICommand {
  public name = 'publish';
  public alias = 'p';
  public description = 'Publishes a package to an npm registry.';
  public subCommands = [
    new PublishValidateCommand()
  ];
  public args: ICommandArg[] = [
    {
      name: 'package',
      type: 'string',
      description: 'The package name to publish.',
      required: true
    }
  ];
  public options: ICommandOption[] = [
    {
      name: 'all',
      type: Boolean,
      description: 'Publishes all packages.',
      defaultValue: 'false'
    },
    {
      name: 'registry',
      type: String,
      description: 'The npm registry to publish the package to.'
    },
    {
      name: 'tag',
      type: String,
      description: 'The npm tag to publish with.'
    }
  ];

  public validator(param: ICommandParameter): string | undefined {
    if (!param.args.all && !param.args._[1]) {
      return 'You must provide a package name.';
    }
  }

  public async run(param: ICommandParameter): Promise<void> {
    if (param.args.all) {
      // Find all of the individual component packages
      const packageDirectories = getDirectoriesContainingFiles(param.config.context.paths.libDir, 'package.json');
      const packagePaths = packageDirectories
        .map(dir => loadPackageJson(join(param.config.context.paths.libDir, dir)))
        .filter(json => json && json.name)
        .map(json => join(param.config.context.paths.distReleaseDir, json.name));
      const releasePackagesDirectories = await Promise.all(packagePaths.filter(dir => existsAsync(dir)));

      // Add the full package
      const fullPackagePath = join(param.config.context.paths.libDir, 'package.json');
      if (await existsAsync(fullPackagePath)) {
        const fullPackage = loadPackageJson(dirname(fullPackagePath));
        if (fullPackage && fullPackage.name) {
          const fullPackageReleasePath = join(param.config.context.paths.distReleaseDir, fullPackage.name);
          if (await existsAsync(fullPackageReleasePath)) {
            releasePackagesDirectories.unshift(fullPackageReleasePath);
          }
        }
      }

      for (const packagePath of releasePackagesDirectories) {
        const packageJson = loadPackageJson(packagePath);

        if (!packageJson) {
          continue;
        }

        const packageName = packageJson ? packageJson.name : packagePath;
        const registryUrl = packageJson.publishConfig && packageJson.publishConfig.registry ? packageJson.publishConfig.registry : param.config.getPackageRegistry();
        const registryPackageJson = await getRegistryPackageJson(packageJson.name, registryUrl);

        if (registryPackageJson && semver.eq(packageJson.version, registryPackageJson.version as string)) {
          Logger.info(`Version ${packageJson.version} of ${packageJson.name} already exists in the registry.`);
          continue;
        }

        await publishPackage(packageName, packagePath, getRegistry(param, packageJson), param.args.tag);
      }
    } else {
      const packageName = param.args._[1];
      const packagePath = join(param.config.context.paths.distReleaseDir, packageName);

      if (!await existsAsync(packagePath)) {
        throw new Error(`Package "${packageName}" does not exist at: ${packagePath}. Did you build the package first?`);
      }

      const packageJson = loadPackageJson(packagePath);
      const registryUrl = packageJson.publishConfig && packageJson.publishConfig.registry ? packageJson.publishConfig.registry : param.config.getPackageRegistry();
      const registryPackageJson = await getRegistryPackageJson(packageJson.name, registryUrl);

      if (registryPackageJson && semver.eq(packageJson.version, registryPackageJson.version as string)) {
        Logger.info(`Version ${packageJson.version} of ${packageJson.name} already exists in the registry.`);
        return;
      }

      await publishPackage(packageName, packagePath, getRegistry(param, packageJson), param.args.tag);
    }
  }
}

/**
 * Attemps to get the npm registry from the package.json specified in `packagePath` if a registry is
 * not provided to this command directly.
 */
function getRegistry(param: ICommandParameter, packageJson: IPackageJson): string | undefined {
  let registry: string | undefined = param.args.registry;
  
  if (!registry) {
    if (packageJson && packageJson.publishConfig && packageJson.publishConfig.registry) {
      registry = packageJson.publishConfig.registry;
    }
  }

  return registry;
}

async function getRegistryPackageJson(packageName: string, registryUrl: string | undefined): Promise<AbbreviatedMetadata | null> {
  let registryPackageJson: AbbreviatedMetadata | null = null;

  try {
    registryPackageJson = await getPackageJson(packageName, { registryUrl });
  } catch (e) {
    return null;
  }

  return registryPackageJson;
}

/**
 * Publishes a package specified by `packagePath` to the npm registry.
 */
async function publishPackage(packageName: string, packagePath: string, registry?: string, tag?: string): Promise<void> {
  return runTask(`Publishing "${packageName}"...`, async () => {
    let cmd = 'npm publish';

    if (registry) {
      cmd += ` --registry ${registry}`;
    }

    if (tag) {
      cmd += ` --tag ${tag}`;
    }

    await runCommand(cmd, packagePath, false);
  });
}
