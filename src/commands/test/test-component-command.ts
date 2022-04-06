import { ICommand, ICommandParameter, ICommandArg, ICommandOption } from '../../core/command';
import { startKarma, generateKarmaConfig } from '../../utils/test-utils';
import { assertBoolean, coerceBoolean } from '../../utils/utils';

/**
 * The command definition for the test component command.
 */
export class TestComponentCommand implements ICommand {
  public name = 'component';
  public alias = 'c';
  public description = 'Executes the unit tests for a specific component. Specify multiple components separated by a space.';
  public args: ICommandArg[] = [
    {
      name: 'component',
      type: String.name,
      description: 'The component name.',
      required: true
    }
  ];
  public options: ICommandOption[] = [
    {
      name: 'once',
      type: Boolean,
      description: 'Runs the tests once and exits',
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
      name: 'stopOnSpecFailure',
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

  public validator(param: ICommandParameter): string | undefined {
    const component = param.args._.slice(2);
    return !component || !component.length ? 'You must provide at least one component name.' : undefined;
  }

  public async run(param: ICommandParameter): Promise<void> {
    const components = param.args._.slice(2);
    const port = param.args.port ? +param.args.port : undefined;
    const singleRun = assertBoolean(param.args.once, false);
    const browser = param.args.browser ? param.args.browser : undefined;
    const coverage = assertBoolean(param.args.coverage, true);
    const sandbox = assertBoolean(param.args.sandbox, true);
    const ci = assertBoolean(param.args.ci, false);
    const stopOnSpecFailure = assertBoolean(param.args.stopOnSpecFailure, false);
    const seed = param.args.seed ? param.args.seed : undefined;
    const karmaConfig = generateKarmaConfig(param.config, browser, singleRun, { port, components, coverage, ci, stopOnSpecFailure, seed, sandbox});
    const exitCode = await startKarma(karmaConfig);
    process.exit(exitCode);
  }
}
