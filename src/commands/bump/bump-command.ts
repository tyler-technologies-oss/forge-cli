import { join } from 'canonical-path';
import * as semver from 'semver';
import chalk from 'chalk';
import { getDirectoriesContainingFiles, existsAsync, readJsonFile, IPackageJson, writeJsonFile, Logger } from '@tylertech/forge-build-tools';

import { ICommand, ICommandParameter, ICommandArg, ICommandOption } from '../../core/command';
import { BumpComponentCommand } from './bump-component-command';
import { assertBoolean } from '../../utils/utils';

export const RELEASE_TYPES = ['major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'prerelease'];

/**
 * The command definition for the `bump` command.
 */
export class BumpCommand implements ICommand {
  public name = 'bump';
  public description = 'Bumps the package version across the whole library.';
  public subCommands: ICommand[] = [
    new BumpComponentCommand()
  ];
  public options: ICommandOption[] = [
    {
      name: 'libOnly',
      description: 'Bumps only the full package version.',
      type: Boolean,
      defaultValue: 'false'
    },
    {
      name: 'version',
      type: String.name,
      description: 'Sets the version explicitly to the value provided.'
    },
    {
      name: 'sync',
      type: String.name,
      description: 'Synchronizes the package version across the library. Default is true.'
    }
  ];
  public args: ICommandArg[] = [
    {
      name: 'type',
      type: String.name,
      description: `The release type (${RELEASE_TYPES.join(', ')}).`,
      required: true
    },
    {
      name: 'identifier',
      type: String.name,
      description: 'The release type (beta, rc, dev... etc.).'
    }
  ];

  public validator(param: ICommandParameter): string | undefined {
    if (!param.args.version) {
      if (!param.args._[1]) {
        return `You must provide a release type (${RELEASE_TYPES.join(', ')}).`;
      }

      if (!param.args.version && RELEASE_TYPES.indexOf(param.args._[1]) === -1) {
        return `You must provide a valid release type: ${RELEASE_TYPES.join(', ')}`;
      }
    }
  }

  public async run(param: ICommandParameter): Promise<void> {
    const releaseType = param.args._[1] as semver.ReleaseType;
    const identifier = param.args._[2] as string || undefined;
    const hardVersion = param.args.version || undefined;
    const sync = assertBoolean(param.args.sync, true);
    const libPackageJsonPath = join(param.config.context.paths.libDir, 'package.json');

    if (param.args.libOnly) {
      if (!await existsAsync(libPackageJsonPath)) {
        throw new Error(`Unable to locate a package.json file at: ${libPackageJsonPath}`);
      }
      const packageJson = await bumpPackageVersion(param.config.context.paths.libDir, releaseType, identifier, hardVersion);
      if (sync) {
        await syncPackageVersion(param.config.context.paths.libDir, packageJson.name, packageJson.version);
      }
      return;
    }

    const dirs = getDirectoriesContainingFiles(param.config.context.paths.libDir, 'package.json')
      .map(dir => join(param.config.context.paths.libDir, dir));

    if (await existsAsync(libPackageJsonPath)) {
      dirs.unshift(param.config.context.paths.libDir);
    }

    for (const dir of dirs) {
      const packageJson = await bumpPackageVersion(dir, releaseType, identifier, hardVersion);
      if (sync) {
        await syncPackageVersion(param.config.context.paths.libDir, packageJson.name, packageJson.version);
      }
    }
  }
}

/**
 * Bumps the version in the package.json specified in the provided directory.
 */
export async function bumpPackageVersion(dir: string, releaseType: semver.ReleaseType, identifier?: string, version?: string): Promise<IPackageJson> {
  const packageJsonPath = join(dir, 'package.json');
  const packageJson = await readJsonFile<IPackageJson>(packageJsonPath);

  if (packageJson) {
    const previousVersion = packageJson.version;
    
    // If we are setting to an explicit version, then we need to validate and use that version
    if (version && !semver.valid(version)) {
      throw new Error(`Invalid package version (${version}). Format is not compatible with semver.`);
    }

    const newVersion = version ? version : semver.inc(packageJson.version, releaseType, identifier) as string;

    packageJson.version = newVersion;
    await writeJsonFile(packageJsonPath, packageJson);

    Logger.success(`Bumped ${chalk.blue(packageJson.name)} version from ${chalk.red(previousVersion)} to ${chalk.green(newVersion)}`);
  } else {
    throw new Error(`Unable to locate package.json at: ${packageJsonPath}`);
  }

  return packageJson;
}

export async function syncPackageVersion(libDir: string, packageName: string, packageVersion: string): Promise<void> {
  // Find all other package.json files in the library so we can check for this package 
  // in their dependencies to sync the version
  const componentDirectories = [
    join(libDir, 'package.json'),
    ...getDirectoriesContainingFiles(libDir, 'package.json')
      .map(name => join(libDir, name, 'package.json'))
  ];

  for (const dir of componentDirectories) {
    // Read in the package.json file within this directory
    const packageJson = await readJsonFile<IPackageJson>(dir);

    if (!packageJson) {
      continue;
    }

    // Check the dependencies object for a package with the name of the package we are bumping
    if (packageJson.dependencies && packageJson.dependencies[packageName]) {
      const newVersion = packageJson.dependencies[packageName].replace(/\d+\.\d+\.\d+.*/g, packageVersion);
      packageJson.dependencies[packageName] = newVersion;

      try {
        await writeJsonFile(dir, packageJson);
        Logger.success(`Synchronized package version in package: ${packageJson.name}`);
      } catch (e) {
        Logger.warn(`Unable to synchronize package (${packageName}) version at ${dir} because of a version conflict.\n\n${e}`);
      }
    }
  }
}
