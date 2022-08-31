import { runCommand } from '@tylertech/forge-build-tools';
import { IProjectConfig } from '../core/definitions';

export async function generateCustomElementsManifest(config: IProjectConfig, srcDir: string, configOverride?: string): Promise<string> {
  let cmd = 'npx custom-elements-manifest analyze';

  if (configOverride ?? config.customElementsManifestConfig?.configFileName) {
    cmd += `--config ${configOverride ?? config.customElementsManifestConfig.configFileName}`;
  } else {
    cmd += ` --globs "**/*.ts"`;
  }
  return await runCommand(cmd, srcDir, false);
}
