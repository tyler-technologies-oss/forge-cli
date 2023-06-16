import { existsAsync, IPackageJson, Logger, runCommand, runTask } from '@tylertech/forge-build-tools';
import cpath from 'canonical-path';
import getPackageJson, { AbbreviatedMetadata } from 'package-json';
import * as semver from 'semver';
import { ICommand, ICommandOption, ICommandParameter } from '../../core/command.js';
import { loadPackageJson } from '../../utils/utils.js';

const { join } = cpath;

/** The command definition for the publish package command. */
export class PublishCommand implements ICommand {
  public name = 'publish';
  public alias = 'p';
  public description = 'Publishes the release package to an npm registry.';
  public subCommands = [];
  public options: ICommandOption[] = [
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

  public async run(param: ICommandParameter): Promise<void> {
    const packageName = join(param.config.context.packageOrg, param.config.context.packageName);
    const packagePath = join(param.config.context.paths.distReleaseDir, packageName);

    if (!await existsAsync(packagePath)) {
      throw new Error(`Package "${packageName}" does not exist at: ${packagePath}. Did you build the package first?`);
    }

    const packageJson = await loadPackageJson(packagePath);
    const packageRegistryUrl = packageJson.publishConfig?.registry ?? param.config.getPackageRegistry();
    const registryPackageJson = await getRegistryPackageJson(packageJson.name, packageRegistryUrl);

    if (registryPackageJson && semver.eq(packageJson.version, registryPackageJson.version as string)) {
      Logger.info(`Version ${packageJson.version} of ${packageJson.name} already exists in the registry.`);
      return;
    }

    await publishPackage(packageName, packagePath, getRegistry(param, packageJson), param.args.tag);
  }
}

/**
 * Attempts to get the npm registry from the package.json specified in `packagePath` if a registry is
 * not provided to this command directly.
 */
function getRegistry(param: ICommandParameter, packageJson: IPackageJson): string | undefined {
  return param.args.registry ?? packageJson.publishConfig?.registry ?? param.config.context.registry;
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
  if (registry) {
    Logger.info(`Using registry: ${registry}`);
  }
  if (tag) {
    Logger.info(`Using tag: ${tag}`);
  }
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
