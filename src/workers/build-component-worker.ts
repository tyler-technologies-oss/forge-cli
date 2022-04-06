import { parentPort } from 'worker_threads';
import { buildComponent, IBuildTaskConfiguration } from '../utils/build-utils';

export interface IBuildWorkerContext {
  componentName: string;
  taskContext: IBuildTaskConfiguration;
}

parentPort?.on('message', (data: IBuildWorkerContext) => executeTask(data));

async function executeTask(data: IBuildWorkerContext): Promise<void> {
  await buildComponent(data.taskContext, data.componentName);
  parentPort?.postMessage(data.componentName);
}
