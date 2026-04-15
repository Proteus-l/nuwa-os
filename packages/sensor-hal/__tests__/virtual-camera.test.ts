import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VirtualCamera } from '../src/sensors/virtual-camera';
import { SensorType, SensorState } from '../src/types';

describe('VirtualCamera', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have default id and name', () => {
    const camera = new VirtualCamera();
    expect(camera.id).toBe('vcam-1');
    expect(camera.name).toBe('Virtual Camera');
  });

  it('should accept custom id and name', () => {
    const camera = new VirtualCamera('cam-custom', 'My Camera');
    expect(camera.id).toBe('cam-custom');
    expect(camera.name).toBe('My Camera');
  });

  it('should have CAMERA sensor type', () => {
    const camera = new VirtualCamera();
    expect(camera.type).toBe(SensorType.CAMERA);
  });

  it('should generate frames with incrementing frameId', async () => {
    const camera = new VirtualCamera();
    const r1 = await camera.read();
    const r2 = await camera.read();
    const r3 = await camera.read();
    expect(r1.data.frameId).toBe(1);
    expect(r2.data.frameId).toBe(2);
    expect(r3.data.frameId).toBe(3);
  });

  it('should generate frames with correct dimensions', async () => {
    const camera = new VirtualCamera();
    const reading = await camera.read();
    expect(reading.data.width).toBe(640);
    expect(reading.data.height).toBe(480);
  });

  it('should generate frames with rgb24 format', async () => {
    const camera = new VirtualCamera();
    const reading = await camera.read();
    expect(reading.data.format).toBe('rgb24');
  });

  it('should generate frames with correct frameData string', async () => {
    const camera = new VirtualCamera();
    const reading = await camera.read();
    expect(reading.data.frameData).toBe('frame_1');
  });

  it('should start and stop correctly', async () => {
    const camera = new VirtualCamera();
    expect(camera.state).toBe(SensorState.IDLE);
    await camera.start();
    expect(camera.state).toBe(SensorState.ACTIVE);
    await camera.stop();
    expect(camera.state).toBe(SensorState.IDLE);
  });

  it('should fire subscriber handler when started', async () => {
    const camera = new VirtualCamera();
    const handler = vi.fn();
    camera.subscribe(handler);

    await camera.start();
    vi.advanceTimersByTime(1000);

    expect(handler).toHaveBeenCalledTimes(1);
    const reading = handler.mock.calls[0][0];
    expect(reading.sensorId).toBe('vcam-1');
    expect(reading.sensorType).toBe(SensorType.CAMERA);
    expect(reading.data.frameId).toBe(1);

    await camera.stop();
  });

  it('should set correct sensorId and sensorType in reading', async () => {
    const camera = new VirtualCamera();
    const reading = await camera.read();
    expect(reading.sensorId).toBe('vcam-1');
    expect(reading.sensorType).toBe(SensorType.CAMERA);
  });
});
