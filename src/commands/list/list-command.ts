import { join } from 'path';
import chalk from 'chalk';
import { getDirectoriesContainingFiles, readJsonFile, IPackageJson, existsAsync, Logger } from '@tylertech/forge-build-tools';

import { ICommandParameter, ICommand } from '../../core/command';

/**
 * The command definition for generating a new web component.
 */
export class ListCommand implements ICommand {
  public name = 'list';
  public alias = ['ls', 'll', 'lp'];
  public description = 'Lists all web component packages within the project.';

  public async run(param: ICommandParameter): Promise<void> {
    // Finds all packages within the lib directory
    const dirs = getDirectoriesContainingFiles(param.config.context.paths.libDir, 'package.json')
      .map(dir => ({
        name: dir,
        path: join(param.config.context.paths.libDir, dir)
      }));

    // Check for and add the main package
    if (await existsAsync(join(param.config.context.paths.libDir, 'package.json'))) {
      dirs.unshift({
        name: param.config.context.libDirName,
        path: param.config.context.paths.libDir
      });
    }

    // Print the package name and version from the package.json for each package
    for (const dir of dirs) {
      const packageJson = await readJsonFile<IPackageJson>(join(dir.path, 'package.json')) as IPackageJson;
      Logger.print(`${chalk.blue(packageJson.name)}@${chalk.green(packageJson.version)}`);
    }
  }
}
