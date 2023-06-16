import { ICommand, ICommandParameter } from '../../core/command.js';
import { lintStyleSheetsTask } from '../../utils/lint-utils.js';

export class LintStylesCommand implements ICommand {
  public name = 'styles';
  public alias = ['sass', 'css'];
  public description = 'Lints the Sass/CSS for the entire component library.';

  public async run(param: ICommandParameter): Promise<void> {
    await lintStyleSheetsTask(param.config.context.paths.libDir, param.config.context.paths.stylelintConfigPath);
  }
}
