import cpath from 'canonical-path';
import { formatHrTime, Logger } from '@tylertech/forge-build-tools';
import chalk from 'chalk';
import { ICommand, ICommandOption, ICommandParameter } from '../../core/command.js';
import { generateCustomElementsManifest } from '../../utils/manifest-utils.js';
import { getTimeStamp } from '../../utils/utils.js';

const { relative } = cpath;

/** The command definition for generating a custom elements manifest. */
export class CustomElementsManifestCommand implements ICommand {
  public name = 'custom-elements-manifest';
  public alias = 'cem';
  public description = 'Generates a Custom Elements Manifest for the project.';
  public options: ICommandOption[] = [
    {
      name: 'config',
      type: String,
      description: 'The path to a custom config file. Will override any project-level configuration.'
    },
    {
      name: 'outdir',
      type: String,
      description: 'The directory to output the manifest.  Defaults to the metadata directory specified in project-level configuration.'
    }
  ];

  public async run({ config, args }: ICommandParameter): Promise<void> {
    const start = process.hrtime();
    Logger.info(`[${getTimeStamp()}] Custom Elements Manifest generation started...`);

    const outDir = args.outdir ?? config.context.paths.distMetadataDir;
    await generateCustomElementsManifest(
      config.context,
      config.context.paths.libDir,
      {
        configFileName: args.config,
        outDir
      }
    );

    Logger.info(`[${getTimeStamp()}] File created at: ${chalk.yellow(`${relative(config.context.paths.rootDir, outDir)}/custom-elements.json`)}`);

    const elapsed = process.hrtime(start);
    Logger.success(`[${getTimeStamp()}] Created Custom Elements Manifest in ${chalk.dim(`in ${formatHrTime(elapsed)}`)}`);
  }
}
