import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GatewayProcess } from '../src/gateway-process';
import { DeviceGateway } from '../src/device-gateway';
import { ProcessState } from '../src/types';

describe('GatewayProcess', () => {
  let gateway: DeviceGateway;
  let process: GatewayProcess;

  beforeEach(() => {
    vi.useFakeTimers();
    gateway = new DeviceGateway();
    process = new GatewayProcess(gateway);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have correct id and name', () => {
    expect(process.id).toBe('gateway-process');
    expect(process.name).toBe('DeviceGatewayProcess');
  });

  it('should start in CREATED state', () => {
    expect(process.state).toBe(ProcessState.CREATED);
  });

  it('should have default priority of 5', () => {
    expect(process.priority).toBe(5);
  });

  it('should accept a custom priority', () => {
    const customProc = new GatewayProcess(gateway, 10);
    expect(customProc.priority).toBe(10);
  });

  it('should transition to RUNNING on onStart and start the gateway', async () => {
    const startSpy = vi.spyOn(gateway, 'start');
    await process.onStart();
    expect(process.state).toBe(ProcessState.RUNNING);
    expect(startSpy).toHaveBeenCalled();
    expect(gateway.isRunning()).toBe(true);
  });

  it('should transition to TERMINATED on onStop and stop the gateway', async () => {
    await process.onStart();
    const stopSpy = vi.spyOn(gateway, 'stop');
    await process.onStop();
    expect(process.state).toBe(ProcessState.TERMINATED);
    expect(stopSpy).toHaveBeenCalled();
    expect(gateway.isRunning()).toBe(false);
  });

  it('should handle onTick without error (no-op)', async () => {
    await expect(process.onTick(1)).resolves.not.toThrow();
  });

  it('should handle multiple onTick calls', async () => {
    await expect(process.onTick(1)).resolves.not.toThrow();
    await expect(process.onTick(2)).resolves.not.toThrow();
    await expect(process.onTick(3)).resolves.not.toThrow();
  });
});
