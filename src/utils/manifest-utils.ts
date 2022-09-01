import { runCommand } from '@tylertech/forge-build-tools';
import { IProjectConfig } from '../core/definitions';
import { relative } from 'canonical-path';

export async function generateCustomElementsManifest(projectConfig: IProjectConfig, srcDir: string, config?: { configFileName?: string; outDir?: string }): Promise<string> {
  let cmd = 'npx custom-elements-manifest analyze';
  const configFileName = config?.configFileName ?? projectConfig.customElementsManifestConfig?.configFileName;

  if (configFileName) {
    cmd += `--config ${configFileName}`;
  } else {
    cmd += ` --globs "**/*.ts"`;
  }

  if (config?.outDir) {
    cmd += ` --outdir ${relative(srcDir, config.outDir)}`;
  }

  return await runCommand(cmd, srcDir, false);
}
