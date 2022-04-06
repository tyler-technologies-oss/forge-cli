import { resolve } from 'path';
import { EventEmitter } from 'events';
import { AsyncResource } from 'async_hooks';
import { Worker } from 'worker_threads';
import { Logger } from '@tylertech/forge-build-tools';
import { getPhysicalCoreCount } from './utils';

const TASK_INFO = Symbol('TaskInfo');
const WORKER_AVAILABLE_EVENT = Symbol('WorkerFreedEvent');
const PHYSICAL_CORE_COUNT = getPhysicalCoreCount();
const MAX_THREADS = Math.ceil(PHYSICAL_CORE_COUNT / 2);

export class WorkerPoolTaskInfo<T> extends AsyncResource {
  constructor(private _callback: () => T | Promise<T>) {
    super('WorkerPoolTaskInfo');
  }

  public done(err: string, result: string): void {
    this.runInAsyncScope(this._callback, null, err, result);
    this.emitDestroy();
  }
}

export class WorkerPool extends EventEmitter {
  private _workers: Worker[] = [];
  private _availableWorkers: Worker[] = [];

  constructor(private _workerPath: string, private _maxThreads = MAX_THREADS) {
    super();
    Logger.newline();
    Logger.info(`Using parallelization with ${this._maxThreads} workers. Total core count is ${PHYSICAL_CORE_COUNT}.`);
    this.setMaxListeners(0); // We will add one listener for every component when our pool is full, so let's disable the warning for default of 10
    this._initialize();
  }

  private _initialize(): void {
    for (let i = 0; i < this._maxThreads; i++) {
      this._queueWorker();
    }
  }

  private _queueWorker(): void {
    const worker = new Worker(resolve(this._workerPath));
    worker.on('message', (result) => {
      worker[TASK_INFO].done(null, result);
      worker[TASK_INFO] = null;
      this._availableWorkers.push(worker);
      this.emit(WORKER_AVAILABLE_EVENT);
    });
    worker.on('error', (err) => {
      if (worker[TASK_INFO]) {
        worker[TASK_INFO].done(err, null);
      } else {
        this.emit('error', err);
      }

      this._workers.splice(this._workers.indexOf(worker), 1);
      this._queueWorker();
    });

    this._workers.push(worker);
    this._availableWorkers.push(worker);
    this.emit(WORKER_AVAILABLE_EVENT);
  }

  public runTask(task: any, callback: () => void): void {
    if (this._availableWorkers.length === 0) {
      this.once(WORKER_AVAILABLE_EVENT, () => this.runTask(task, callback));
      return;
    }

    const worker = this._availableWorkers.pop() as Worker;
    worker[TASK_INFO] = new WorkerPoolTaskInfo(callback);
    worker.postMessage(task);
  }

  public destroy(): void {
    this._workers.forEach(worker => worker.terminate());
    this._workers = [];
    this._availableWorkers = [];
  }
}
