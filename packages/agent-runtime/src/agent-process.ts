import { IProcess, ProcessState } from './types.js';
import { BaseAgent } from './base-agent.js';

export class AgentProcess implements IProcess {
  readonly id: string;
  readonly name: string;
  priority: number;
  state: ProcessState = ProcessState.CREATED;
  private agent: BaseAgent;

  constructor(agent: BaseAgent, priority: number = 5) {
    this.id = `proc_${agent.id}`;
    this.name = `AgentProcess[${agent.name}]`;
    this.priority = priority;
    this.agent = agent;
  }

  async onStart(): Promise<void> {
    this.state = ProcessState.RUNNING;
    await this.agent.start();
  }

  async onStop(): Promise<void> {
    this.state = ProcessState.TERMINATED;
    await this.agent.stop();
  }

  async onTick(_tick: number): Promise<void> {
    await this.agent._triggerThink();
  }
}
