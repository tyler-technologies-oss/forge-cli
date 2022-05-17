import { join } from 'path';
import * as bs from 'browser-sync';

import { ICommand, ICommandParameter, ICommandOption } from '../../core/command';
import { findClosestOpenPort } from '../../utils/network';
import { existsAsync } from '@tylertech/forge-build-tools';

const DEFAULT_BROWSER_PORT = 9040;

/**
 * The command definition for the serve coverage command.
 */
export class ServeCoverageCommand implements ICommand {
  public name = 'coverage';
  public description = 'Serves the unit test coverage report.';
  public options: ICommandOption[] = [
    {
      name: 'port',
      type: Number,
      description: 'The port to serve the coverate report on.',
      defaultValue: DEFAULT_BROWSER_PORT.toString()
    }
  ];

  public async run(param: ICommandParameter): Promise<void> {
    const servePath = join(param.config.context.paths.distDir, 'coverage/html-report/html');

    if (!await existsAsync(servePath)) {
      // TODO: Ask user if they would like to run the unit tests and await that task here, then serve the coverage
      throw new Error('Unable to create coverage report. Unit tests must be run to first generate the coverage.');
    }

    const port = param.args.port;
    const browser = bs.create();
    browser.init({
      server: servePath,
      port,
      notify: false,
      ghostMode: false,
      watch: true
    });
  }
}
