import { join } from 'canonical-path';
import * as semver from 'semver';
import chalk from 'chalk';
import { getDirectoriesContainingFiles, existsAsync, readJsonFile, IPackageJson, writeJsonFile, Logger } from '@tylertech/forge-build-tools';
import { ICommand, ICommandParameter, ICommandArg, ICommandOption } from '../../core/command';

export const RELEASE_TYPES = ['major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'prerelease'];

/** The command definition for the `bump` command. */
export class BumpCommand implements ICommand {
  public name = 'bump';
  public description = 'Bumps the package version across the whole library.';
  public subCommands: ICommand[] = [];
  public options: ICommandOption[] = [
    {
      name: 'version',
      type: String,
      description: 'Sets the version explicitly to the value provided.'
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
    const identifier = param.args._[2] as string ?? undefined;
    const hardVersion = param.args.version ?? undefined;
    const packageJsonPath = join(param.config.context.paths.rootDir, 'package.json');

    if (!await existsAsync(packageJsonPath)) {
      throw new Error(`Unable to locate a package.json file at: ${packageJsonPath}`);
    }

    await bumpPackageVersion(packageJsonPath, releaseType, identifier, hardVersion);
  }
}

/** Bumps the version in the package.json specified in the provided directory. */
export async function bumpPackageVersion(packageJsonPath: string, releaseType: semver.ReleaseType, identifier?: string, version?: string): Promise<IPackageJson> {
  const packageJson = await readJsonFile<IPackageJson>(packageJsonPath);
  
  if (!packageJson) {
    throw new Error(`Invalid package.json at: ${packageJsonPath}`);
  }

  const previousVersion = packageJson.version;
  
  // If we are setting to an explicit version, then we need to validate and use that version
  if (version && !semver.valid(version)) {
    throw new Error(`Invalid package version (${version}). Format is not compatible with semver.`);
  }

  const newVersion = version ? version : semver.inc(packageJson.version, releaseType, identifier) as string;

  packageJson.version = newVersion;
  await writeJsonFile(packageJsonPath, packageJson);

  Logger.success(`Bumped ${chalk.blue(packageJson.name)} version from ${chalk.red(previousVersion)} to ${chalk.green(newVersion)}`);

  return packageJson;
}
