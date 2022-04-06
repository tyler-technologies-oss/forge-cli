import { ICommand, ICommandParameter } from '../../core/command';
import { LintESLintCommand } from './lint-eslint';
import { LintStylesCommand } from './lint-styles-command';
import { lintESLintTask, lintStyleSheetsTask } from '../../utils/lint-utils';

export class LintCommand implements ICommand {
  public name = 'lint';
  public alias = 'l';
  public description = 'Lints the JavaScript/TypeScript and Sass/CSS for the entire component library.';
  public subCommands = [
    new LintESLintCommand(),
    new LintStylesCommand()
  ];

  public async run(param: ICommandParameter): Promise<void> {
    await lintESLintTask(param.config.context.paths.libDir);
    await lintStyleSheetsTask(param.config.context.paths.libDir, param.config.context.paths.stylelintConfigPath);
  }
}
