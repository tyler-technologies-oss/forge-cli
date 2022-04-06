import { join } from 'canonical-path';

import { ICommand, ICommandParameter } from '../../core/command';
import { runTask, compileSass, logError } from '@tylertech/forge-build-tools';
import { getTimeStamp } from '../../utils/utils';

/**
 * The command definition for the build global stylesheet command.
 */
export class BuildStyleSheetCommand implements ICommand {
  public name = 'stylesheet';
  public alias = ['sass', 'css', 'styles'];
  public description = 'Builds the global stylesheet.';

  public async run(param: ICommandParameter): Promise<void> {
    const { libDir, distStylesDir } = param.config.context.paths;
    await buildStyleSheetTask(libDir, distStylesDir);
  }
}

/** The async sass compilation task. */
export async function buildStyleSheetTask(libDir: string, distStylesDir: string): Promise<void> {
  return runTask(`[${getTimeStamp()}] Building StyleSheet...`, async () => {
    try {
      await compileSass(join(libDir, '*.scss'),  libDir, distStylesDir);
    } catch (e) {
      logError('Sass error: ' + e.message);
    }
  });
}
