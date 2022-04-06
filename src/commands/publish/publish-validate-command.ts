import { getDirectoriesContainingFiles, existsAsync, IPackageJson, Logger, readJsonFile } from '@tylertech/forge-build-tools';
import { join } from 'canonical-path';

import { ICommand, ICommandParameter, ICommandOption, ICommandArg } from '../../core/command';

/**
 * The command definition for the `publish validate` command.
 */
export class PublishValidateCommand implements ICommand {
  public name = 'validate';
  public alias = 'v';
  public description = 'Validates all packages prior to publishing.';
  public subCommands = [];
  public args: ICommandArg[] = [];
  public options: ICommandOption[] = [];

  public async run(param: ICommandParameter): Promise<void> {
    // Find all of the individual component packages
    const packageDirectories = getDirectoriesContainingFiles(param.config.context.paths.libDir, 'package.json')
      .map(dir => join(param.config.context.paths.libDir, dir, 'package.json'));
    const releasePackagesDirectories = await Promise.all(packageDirectories.filter(dir => existsAsync(dir)));

    // Add the full package
    const fullPackagePath = join(param.config.context.paths.libDir, 'package.json');
    if (await existsAsync(fullPackagePath)) {
      releasePackagesDirectories.unshift(fullPackagePath);
    }

    let isOutOfSync = false;

    for (const packagePath of releasePackagesDirectories) {
      const packageJson = await readJsonFile<IPackageJson>(packagePath);

      if (!packageJson) {
        continue;
      }

      const packageName = packageJson.name;
      const packageVersion = packageJson.version;
      const outOfSyncPackages = await this._ensurePackageSynchronized(packageName, packageVersion, releasePackagesDirectories.filter(dir => dir !== packagePath));

      if (outOfSyncPackages.length) {
        isOutOfSync = true;
        Logger.error(`The package version (${packageVersion}) for "${packageName}" is out of sync in the following packages:`);
        outOfSyncPackages.forEach(name => {
          Logger.print(`          - ${name}`);
        });
        Logger.newline();
      }
    }
    
    if (!isOutOfSync) {
      Logger.success('All package versions are synchronized.');
    } else {
      throw new Error('Package versions are not syncrhonized.');
    }
  }

  private async _ensurePackageSynchronized(packageName: string, packageVersion: string, packageDirs: string[]): Promise<string[]> {
    const packageNames: string[] = [];

    for (const packagePath of packageDirs) {
      const packageJson = await readJsonFile<IPackageJson>(packagePath);
      
      if (!packageJson) {
        continue;
      }

      // Check dependencies first, then peerDependencies
      if (packageJson.dependencies && packageJson.dependencies[packageName] && !packageJson.dependencies[packageName].endsWith(packageVersion)) {
        packageNames.push(packageJson.name);
      } else if (packageJson.peerDependencies && packageJson.peerDependencies[packageName] && !packageJson.peerDependencies[packageName].endsWith(packageVersion)) {
        packageNames.push(packageJson.name);
      }
    }

    return packageNames;
  }
}
