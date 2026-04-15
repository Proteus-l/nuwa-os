import { AgentAction, AgentContext, AgentState, Percept } from './types';
import { SimpleBaseAgent } from './simple-runtime';

export class VisionAgent extends SimpleBaseAgent {
  private framesProcessed = 0;
  private totalActions: AgentAction[] = [];

  constructor(id: string = 'vision-agent-1', name: string = 'VisionAgent') {
    super({ id, name, perceptBufferSize: 5, subscriptions: ['sensor.camera.**'] });
  }

  async init(context: AgentContext): Promise<void> {
    await super.init(context);
    this.subscribeTo('sensor.camera.**');
    this.subscribeTo('device.camera.*');
  }

  async think(percepts: Percept[]): Promise<AgentAction[]> {
    const actions: AgentAction[] = [];
    const visualPercepts = percepts.filter(
      (p) => p.type === 'sensor' || (p.data && typeof p.data === 'object'),
    );

    this.framesProcessed += visualPercepts.length;

    // Log what we see
    actions.push({
      type: 'log',
      payload: `Processed ${visualPercepts.length} visual frames (total: ${this.framesProcessed})`,
    });

    // Speak about the scene (simulated)
    if (visualPercepts.length > 0) {
      actions.push({
        type: 'speak',
        payload: `I can see ${visualPercepts.length} new frames. Scene appears normal.`,
      });
    }

    // Emit analysis event
    actions.push({
      type: 'emit',
      payload: {
        type: 'vision_analysis',
        framesAnalyzed: visualPercepts.length,
        totalFrames: this.framesProcessed,
        timestamp: Date.now(),
      },
    });

    this.totalActions.push(...actions);
    return actions;
  }

  getStats(): { framesProcessed: number; actionsProduced: number; state: AgentState } {
    return {
      framesProcessed: this.framesProcessed,
      actionsProduced: this.totalActions.length,
      state: this.state,
    };
  }
}
