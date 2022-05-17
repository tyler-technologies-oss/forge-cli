import { ICommand, ICommandParameter, ICommandOption } from '../../core/command';
import { TestComponentCommand } from './test-component-command';
import { generateKarmaConfig, startKarma } from '../../utils/test-utils';
import { assertBoolean } from '../../utils/utils';

/**
 * The command definition for the `test` command.
 */
export class TestCommand implements ICommand {
  public name = 'test';
  public alias = 't';
  public description = 'Executes all unit tests.';
  public subCommands: ICommand[] = [
    new TestComponentCommand()
  ];
  public options: ICommandOption[] = [
    {
      name: 'once',
      type: Boolean,
      description: 'Runs the tests once and exits.',
      defaultValue: 'false'
    },
    {
      name: 'browser',
      type: String,
      description: 'The browser to run the tests in.'
    },
    {
      name: 'port',
      type: Number,
      description: 'The port to serve the test server on.'
    },
    {
      name: 'coverage',
      type: Boolean,
      description: 'Capture and report code coverage results.'
    },
    {
      name: 'ci',
      type: Boolean,
      description: 'Specifies that the test run is being executed within a CI environment.'
    },
    {
      name: 'stop',
      type: Boolean,
      description: 'Controls whether test run finishes with an error after first failed test.'
    },
    {
      name: 'seed',
      type: String,
      description: 'The seed to use when randomizing the tests.'
    },
    {
      name: 'sandbox',
      type: Boolean,
      description: 'Turns off sandbox mode, this is a requirement to work inside of a container'
    }
  ];

  public async run(param: ICommandParameter): Promise<void> {
    const port = param.args.port ? +param.args.port : undefined;
    const singleRun = assertBoolean(param.args.once, false);
    const browser = param.args.browser ? param.args.browser : undefined;
    const coverage = assertBoolean(param.args.coverage, true);
    const sandbox = assertBoolean(param.args.sandbox, true);
    const ci = assertBoolean(param.args.ci, false);
    const stopOnSpecFailure = assertBoolean(param.args.stop, false);
    const seed = param.args.seed ? param.args.seed : undefined;
    const karmaConfig = generateKarmaConfig(param.config, browser, singleRun, { port, coverage, ci, stopOnSpecFailure, seed, sandbox });
    const exitCode = await startKarma(karmaConfig);
    process.exit(exitCode);
  }
}
