import { join } from 'canonical-path';
import * as semver from 'semver';
import { readJsonFile, writeJsonFile, getDirectoriesContainingFiles, Logger, IPackageJson } from '@tylertech/forge-build-tools';

import { ICommand, ICommandParameter, ICommandArg, ICommandOption } from '../../core/command';
import { RELEASE_TYPES, bumpPackageVersion, syncPackageVersion } from './bump-command';
import { assertBoolean } from '../../utils/utils';

/**
 * The command definition for the bump component command.
 */
export class BumpComponentCommand implements ICommand {
  public name = 'component';
  public alias = 'c';
  public description = 'Bumps the package version for a specific component.';
  public options: ICommandOption[] = [
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
      name: 'component',
      type: String.name,
      description: 'The component name.',
      required: true
    },
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
    if (!param.args._[2]) {
      return 'You must provide a component name.';
    }

    if (!param.args.version) {
      if (!param.args._[3]) {
        return 'You must provide a release type.';
      }

      if (RELEASE_TYPES.indexOf(param.args._[3]) === -1) {
        return `You must provide a valid release type: ${RELEASE_TYPES.join(', ')}`;
      }
    }
  }

  public async run(param: ICommandParameter): Promise<void> {
    const componentName = param.args._[2];
    const releaseType = param.args._[3] as semver.ReleaseType;
    const identifier = param.args._[4] as string || undefined;
    const hardVersion = param.args.version || undefined;
    const sync = assertBoolean(param.args.sync, true);
    const packageJsonPath = join(param.config.context.paths.libDir, componentName);
    const componentPackageJson = await bumpPackageVersion(packageJsonPath, releaseType, identifier, hardVersion);
    if (sync) {
      await syncPackageVersion(param.config.context.paths.libDir, componentPackageJson.name, componentPackageJson.version);
    }
  }
}
