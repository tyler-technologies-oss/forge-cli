import { runCommand } from '@tylertech/forge-build-tools';
import { IProjectConfig } from '../core/definitions.js';
import cpath from 'canonical-path';

export interface IGenerateCustomElementsManifestOptions {
  configFileName?: string;
  outDir?: string;
  quiet?: boolean;
}

export async function generateCustomElementsManifest(
  projectConfig: IProjectConfig,
  srcDir: string,
  { configFileName, outDir, quiet = true }: IGenerateCustomElementsManifestOptions = {}
): Promise<string> {
  let cmd = 'npx custom-elements-manifest analyze';
  configFileName = configFileName ?? projectConfig.customElementsManifestConfig?.configFileName;

  if (configFileName) {
    cmd += ` --config ${cpath.join(projectConfig.paths.rootDir, configFileName)}`;
  } else {
    cmd += ` --globs "**/*.ts"`;
  }

  if (outDir) {
    cmd += ` --outdir ${cpath.relative(srcDir, outDir)}`;
  }

  return await runCommand(cmd, srcDir, !quiet);
}
