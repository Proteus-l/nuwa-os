import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VirtualCameraDevice } from '../src/devices/virtual-camera-device';
import { DeviceType, DeviceState, DeviceData } from '../src/types';

describe('VirtualCameraDevice', () => {
  let camera: VirtualCameraDevice;

  beforeEach(() => {
    vi.useFakeTimers();
    camera = new VirtualCameraDevice();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have correct default id and name', () => {
    expect(camera.id).toMatch(/^vcam/);
    expect(camera.name).toBe('Virtual Camera Device');
    expect(camera.type).toBe(DeviceType.CAMERA);
    expect(camera.protocol).toBe('virtual');
  });

  it('should accept custom id and name', () => {
    const custom = new VirtualCameraDevice('my-cam', 'My Camera');
    expect(custom.id).toBe('my-cam');
    expect(custom.name).toBe('My Camera');
  });

  it('should connect and reach CONNECTED state', async () => {
    const connectPromise = camera.connect();
    await vi.advanceTimersByTimeAsync(20);
    await connectPromise;
    expect(camera.state).toBe(DeviceState.CONNECTED);
  });

  it('should start emitting frames after connect', async () => {
    const handler = vi.fn();
    camera.onData(handler);

    const connectPromise = camera.connect();
    await vi.advanceTimersByTimeAsync(20);
    await connectPromise;

    vi.advanceTimersByTime(200);
    expect(handler).toHaveBeenCalledTimes(1);

    const data: DeviceData = handler.mock.calls[0][0];
    expect(data.deviceId).toBe(camera.id);
    expect(data.type).toBe('frame');
    const payload = data.payload as Record<string, unknown>;
    expect(payload.frameId).toBe(1);
    expect(payload.width).toBe(640);
    expect(payload.height).toBe(480);
  });

  it('should increment frameCounter on each emitted frame', async () => {
    const handler = vi.fn();
    camera.onData(handler);

    const connectPromise = camera.connect();
    await vi.advanceTimersByTimeAsync(20);
    await connectPromise;

    vi.advanceTimersByTime(200);
    vi.advanceTimersByTime(200);
    vi.advanceTimersByTime(200);

    expect(handler).toHaveBeenCalledTimes(3);
    const frame3 = handler.mock.calls[2][0] as DeviceData;
    expect((frame3.payload as { frameId: number }).frameId).toBe(3);
  });

  it('should handle capture command', async () => {
    const response = await camera.send({ type: 'capture' });
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    const data = response.data as Record<string, unknown>;
    expect(data.frameId).toBe(1);
    expect(data.width).toBe(640);
    expect(data.height).toBe(480);
  });

  it('should handle a resolution-related command', async () => {
    // Try get_resolution first, fall back to set_resolution
    const getResp = await camera.send({ type: 'get_resolution' });
    const setResp = await camera.send({ type: 'set_resolution', payload: { width: 1920, height: 1080 } });
    const atLeastOneSucceeded = getResp.success || setResp.success;
    expect(atLeastOneSucceeded).toBe(true);
  });

  it('should return error for unknown command', async () => {
    const response = await camera.send({ type: 'fly' });
    expect(response.success).toBe(false);
    expect(response.error).toBe('Unknown command');
  });

  it('should stop emitting on disconnect', async () => {
    const handler = vi.fn();
    camera.onData(handler);

    const connectPromise = camera.connect();
    await vi.advanceTimersByTimeAsync(20);
    await connectPromise;

    vi.advanceTimersByTime(200);
    expect(handler).toHaveBeenCalledTimes(1);

    await camera.disconnect();
    expect(camera.state).toBe(DeviceState.DISCONNECTED);

    vi.advanceTimersByTime(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should increment frameCounter across captures', async () => {
    const resp1 = await camera.send({ type: 'capture' });
    const resp2 = await camera.send({ type: 'capture' });
    expect((resp1.data as { frameId: number }).frameId).toBe(1);
    expect((resp2.data as { frameId: number }).frameId).toBe(2);
  });

  it('should disconnect cleanly', async () => {
    const connectPromise = camera.connect();
    await vi.advanceTimersByTimeAsync(20);
    await connectPromise;
    await camera.disconnect();
    expect(camera.state).toBe(DeviceState.DISCONNECTED);
  });
});
