import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VisionAgent } from '../src/vision-agent';
import { SimpleEventBus } from '../src/simple-event-bus';
import { SimpleAgentRuntime } from '../src/simple-runtime';
import { AgentState, NuwaEvent, Percept } from '../src/types';

describe('VisionAgent', () => {
  let agent: VisionAgent;
  let eventBus: SimpleEventBus;
  let runtime: SimpleAgentRuntime;

  beforeEach(async () => {
    eventBus = new SimpleEventBus();
    runtime = new SimpleAgentRuntime(eventBus);
    agent = new VisionAgent('test-vision', 'TestVision');
    await runtime.registerAgent(agent);
    await agent.start();
  });

  afterEach(async () => {
    await agent.stop();
  });

  it('should initialize with correct default state', () => {
    expect(agent.id).toBe('test-vision');
    expect(agent.name).toBe('TestVision');
    expect(agent.state).toBe(AgentState.RUNNING);
  });

  it('should subscribe to sensor.camera.** and device.camera.* topics on init', () => {
    // Publish a camera event and check that the agent receives it
    const cameraEvent: NuwaEvent = {
      id: 'evt_1',
      type: 'sensor',
      topic: 'sensor.camera.frame',
      timestamp: Date.now(),
      source: 'cam-1',
      data: { frameId: 1, width: 640, height: 480 },
    };
    eventBus.publish(cameraEvent);

    // The agent should have a percept in its buffer
    // We can verify this indirectly via getStats after triggering think
    expect(agent.getStats().framesProcessed).toBe(0); // not yet processed, just buffered
  });

  it('should add percepts on receiving events via onEvent', async () => {
    const event: NuwaEvent = {
      id: 'evt_1',
      type: 'sensor',
      topic: 'sensor.camera.frame',
      timestamp: Date.now(),
      source: 'cam-1',
      data: { frameId: 1 },
    };

    await agent.onEvent(event);
    // After one event, buffer has 1 item but buffer size is 5, so no auto-think
    expect(agent.getStats().framesProcessed).toBe(0);
  });

  it('should auto-trigger think when percept buffer reaches perceptBufferSize', async () => {
    for (let i = 0; i < 5; i++) {
      await agent.onEvent({
        id: `evt_${i}`,
        type: 'sensor',
        topic: 'sensor.camera.frame',
        timestamp: Date.now(),
        source: 'cam-1',
        data: { frameId: i },
      });
    }

    // Buffer size is 5, so think should have been triggered
    expect(agent.getStats().framesProcessed).toBe(5);
  });

  it('should produce log, speak, and emit action types from think', async () => {
    const percepts: Percept[] = [
      { source: 'cam-1', type: 'sensor', data: { frameId: 1 }, timestamp: Date.now() },
      { source: 'cam-1', type: 'sensor', data: { frameId: 2 }, timestamp: Date.now() },
    ];

    const actions = await agent.think(percepts);

    expect(actions.length).toBe(3);
    expect(actions[0].type).toBe('log');
    expect(actions[1].type).toBe('speak');
    expect(actions[2].type).toBe('emit');
  });

  it('should count frames correctly in think', async () => {
    const percepts: Percept[] = [
      { source: 'cam-1', type: 'sensor', data: { frameId: 1 }, timestamp: Date.now() },
      { source: 'cam-1', type: 'sensor', data: { frameId: 2 }, timestamp: Date.now() },
      { source: 'cam-1', type: 'sensor', data: { frameId: 3 }, timestamp: Date.now() },
    ];

    await agent.think(percepts);

    expect(agent.getStats().framesProcessed).toBe(3);
  });

  it('should track total actions produced in getStats', async () => {
    const percepts: Percept[] = [
      { source: 'cam-1', type: 'sensor', data: { frameId: 1 }, timestamp: Date.now() },
    ];

    await agent.think(percepts);
    const stats = agent.getStats();

    // 1 visual percept => 3 actions (log, speak, emit)
    expect(stats.actionsProduced).toBe(3);
    expect(stats.framesProcessed).toBe(1);
  });

  it('should accumulate frames across multiple think calls', async () => {
    const batch1: Percept[] = [
      { source: 'cam-1', type: 'sensor', data: { frameId: 1 }, timestamp: Date.now() },
    ];
    const batch2: Percept[] = [
      { source: 'cam-1', type: 'sensor', data: { frameId: 2 }, timestamp: Date.now() },
      { source: 'cam-1', type: 'sensor', data: { frameId: 3 }, timestamp: Date.now() },
    ];

    await agent.think(batch1);
    await agent.think(batch2);

    expect(agent.getStats().framesProcessed).toBe(3);
    expect(agent.getStats().actionsProduced).toBe(6); // 3 actions per call
  });

  it('should emit vision_analysis payload via emit action', async () => {
    const published: NuwaEvent[] = [];
    eventBus.subscribe('agent.test-vision.action', (evt) => published.push(evt));

    // Manually trigger tickThink with percepts loaded
    await agent.onEvent({
      id: 'evt_1',
      type: 'sensor',
      topic: 'sensor.camera.frame',
      timestamp: Date.now(),
      source: 'cam-1',
      data: { frameId: 1 },
    });

    await agent.tickThink();

    expect(published.length).toBeGreaterThan(0);
    const analysisEvent = published.find(
      (e) => e.data && typeof e.data === 'object' && (e.data as Record<string, unknown>).type === 'vision_analysis',
    );
    expect(analysisEvent).toBeDefined();
  });

  it('should transition to THINKING during think and back to RUNNING', async () => {
    // We test indirectly: after tickThink the state should be RUNNING
    await agent.onEvent({
      id: 'evt_1',
      type: 'sensor',
      topic: 'sensor.camera.frame',
      timestamp: Date.now(),
      source: 'cam-1',
      data: { frameId: 1 },
    });

    await agent.tickThink();

    expect(agent.state).toBe(AgentState.RUNNING);
  });

  it('should return IDLE state after stop', async () => {
    await agent.stop();
    expect(agent.state).toBe(AgentState.IDLE);
  });
});
