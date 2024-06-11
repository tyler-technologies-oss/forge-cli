import { ICommand, ICommandParameter } from '../../core/command.js';
import { lintESLintTask } from '../../utils/lint-utils.js';
import { assertBoolean } from '../../utils/utils.js';

export class LintESLintCommand implements ICommand {
  public name = 'eslint';
  public alias = ['es', 'ts', 'js'];
  public description = 'Lints the JavaScript and TypeScript for the entire component library.';
  public options = [
    {
      name: 'fix',
      type: Boolean,
      description: 'Controls whether fixable issues will be automatically fixed. This will commit the changes to the files.',
      defaultValue: 'false'
    }
  ];

  public async run(param: ICommandParameter): Promise<void> {
    const fix = assertBoolean(param.args.fix, false);
    await lintESLintTask(param.config.context.paths.libDir, { fix });
  }
}
