import { ICommand, ICommandParameter } from '../../core/command.js';
import { LintESLintCommand } from './lint-eslint.js';
import { LintStylesCommand } from './lint-styles-command.js';
import { lintESLintTask, lintStyleSheetsTask } from '../../utils/lint-utils.js';

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
