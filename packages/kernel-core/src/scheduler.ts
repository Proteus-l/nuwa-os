import { ProcessState } from './types.js';
import type { IProcess } from './types.js';

export class Scheduler {
  private processes: Map<string, IProcess> = new Map();

  register(process: IProcess): void {
    this.processes.set(process.id, process);
  }

  unregister(processId: string): boolean {
    return this.processes.delete(processId);
  }

  getProcess(id: string): IProcess | undefined {
    return this.processes.get(id);
  }

  getAllProcesses(): IProcess[] {
    return Array.from(this.processes.values());
  }

  getReadyProcesses(): IProcess[] {
    return this.getAllProcesses()
      .filter(
        (p) =>
          p.state === ProcessState.READY || p.state === ProcessState.RUNNING,
      )
      .sort((a, b) => a.priority - b.priority);
  }
}
