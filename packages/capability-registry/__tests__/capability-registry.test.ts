import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CAPABILITY_TOPIC,
  CapabilityRegistry,
  DeviceRegistryLike,
  DeviceSource,
  IEventPublisher,
  NuwaEvent,
  SensorRegistryLike,
  SensorSource,
} from '../src/index.js';

function makeFakeBus() {
  const events: NuwaEvent[] = [];
  const bus: IEventPublisher = {
    publish: (e) => {
      events.push(e);
    },
  };
  return { bus, events };
}

function makeFakeSensorRegistry(initial: SensorSource[] = []) {
  const sensors = new Map(initial.map((s) => [s.id, s]));
  const regCbs = new Set<(s: SensorSource) => void>();
  const unregCbs = new Set<(id: string) => void>();

  const reg: SensorRegistryLike = {
    getAllSensors: () => Array.from(sensors.values()),
    onRegistered: (cb) => {
      regCbs.add(cb);
      return () => {
        regCbs.delete(cb);
      };
    },
    onUnregistered: (cb) => {
      unregCbs.add(cb);
      return () => {
        unregCbs.delete(cb);
      };
    },
  };

  return {
    reg,
    add: (s: SensorSource) => {
      sensors.set(s.id, s);
      for (const cb of regCbs) cb(s);
    },
    remove: (id: string) => {
      if (!sensors.delete(id)) return;
      for (const cb of unregCbs) cb(id);
    },
  };
}

function makeFakeDeviceRegistry(initial: DeviceSource[] = []) {
  const devices = new Map(initial.map((d) => [d.id, d]));
  const regCbs = new Set<(d: DeviceSource) => void>();
  const unregCbs = new Set<(id: string) => void>();

  const reg: DeviceRegistryLike = {
    getAllDevices: () => Array.from(devices.values()),
    onDeviceRegistered: (cb) => {
      regCbs.add(cb);
      return () => {
        regCbs.delete(cb);
      };
    },
    onDeviceUnregistered: (cb) => {
      unregCbs.add(cb);
      return () => {
        unregCbs.delete(cb);
      };
    },
  };

  return {
    reg,
    add: (d: DeviceSource) => {
      devices.set(d.id, d);
      for (const cb of regCbs) cb(d);
    },
    remove: (id: string) => {
      if (!devices.delete(id)) return;
      for (const cb of unregCbs) cb(id);
    },
  };
}

describe('CapabilityRegistry', () => {
  let reg: CapabilityRegistry;

  beforeEach(() => {
    reg = new CapabilityRegistry();
  });

  describe('manual attach/detach', () => {
    it('attaches a capability and exposes it via list()', () => {
      reg.attach({
        id: 'c1',
        modality: 'vision',
        sourceKind: 'sensor',
        sourceId: 'cam-1',
        name: 'Living room camera',
      });
      expect(reg.list()).toHaveLength(1);
      expect(reg.has('vision')).toBe(true);
      expect(reg.byModality('vision')).toHaveLength(1);
    });

    it('detach removes capability and returns true only if present', () => {
      reg.attach({
        id: 'c1',
        modality: 'thermal',
        sourceKind: 'device',
        sourceId: 'thermo-1',
        name: 't',
      });
      expect(reg.detach('c1')).toBe(true);
      expect(reg.detach('c1')).toBe(false);
      expect(reg.has('thermal')).toBe(false);
    });

    it('throws when attaching duplicate id', () => {
      reg.attach({
        id: 'dup',
        modality: 'vision',
        sourceKind: 'sensor',
        sourceId: 'x',
        name: 'x',
      });
      expect(() =>
        reg.attach({
          id: 'dup',
          modality: 'thermal',
          sourceKind: 'sensor',
          sourceId: 'y',
          name: 'y',
        }),
      ).toThrow(/already attached/);
    });
  });

  describe('onChange callbacks', () => {
    it('fires attached/detached events to local subscribers', () => {
      const cb = vi.fn();
      reg.onChange(cb);
      reg.attach({
        id: 'c1',
        modality: 'audio',
        sourceKind: 'sensor',
        sourceId: 'mic-1',
        name: 'mic',
      });
      reg.detach('c1');
      expect(cb).toHaveBeenCalledTimes(2);
      expect(cb.mock.calls[0][0].kind).toBe('attached');
      expect(cb.mock.calls[1][0].kind).toBe('detached');
    });

    it('unsubscribe stops future callbacks', () => {
      const cb = vi.fn();
      const off = reg.onChange(cb);
      off();
      reg.attach({
        id: 'c1',
        modality: 'audio',
        sourceKind: 'sensor',
        sourceId: 'mic-1',
        name: 'mic',
      });
      expect(cb).not.toHaveBeenCalled();
    });

    it('one failing subscriber does not break others', () => {
      const good = vi.fn();
      reg.onChange(() => {
        throw new Error('boom');
      });
      reg.onChange(good);
      reg.attach({
        id: 'c1',
        modality: 'vision',
        sourceKind: 'sensor',
        sourceId: 'x',
        name: 'x',
      });
      expect(good).toHaveBeenCalledTimes(1);
    });
  });

  describe('bus publishing', () => {
    it('publishes capability.attached and capability.detached NuwaEvents', () => {
      const { bus, events } = makeFakeBus();
      const r = new CapabilityRegistry({ bus });
      r.attach({
        id: 'c1',
        modality: 'vision',
        sourceKind: 'sensor',
        sourceId: 'cam-1',
        name: 'cam',
      });
      r.detach('c1');

      expect(events).toHaveLength(2);
      expect(events[0].topic).toBe(CAPABILITY_TOPIC.attached);
      expect(events[0].type).toBe('capability');
      expect((events[0].data as { modality: string }).modality).toBe('vision');
      expect(events[1].topic).toBe(CAPABILITY_TOPIC.detached);
    });

    it('emits no bus events when no bus is provided', () => {
      const r = new CapabilityRegistry();
      // Should not throw
      r.attach({
        id: 'c1',
        modality: 'vision',
        sourceKind: 'sensor',
        sourceId: 'x',
        name: 'x',
      });
      r.detach('c1');
      expect(r.list()).toHaveLength(0);
    });
  });

  describe('bindSensorRegistry', () => {
    it('snapshots existing sensors on bind', () => {
      const { reg: sensorReg } = makeFakeSensorRegistry([
        { id: 'cam-1', name: 'Camera 1', type: 'camera' },
        { id: 'therm-1', name: 'Therm 1', type: 'temperature' },
      ]);
      reg.bindSensorRegistry(sensorReg);
      expect(reg.list()).toHaveLength(2);
      expect(reg.has('vision')).toBe(true);
      expect(reg.has('thermal')).toBe(true);
    });

    it('reacts to future registrations + unregistrations', () => {
      const { reg: sensorReg, add, remove } = makeFakeSensorRegistry();
      const { bus, events } = makeFakeBus();
      const r = new CapabilityRegistry({ bus });
      r.bindSensorRegistry(sensorReg);

      add({ id: 'cam-1', name: 'Camera 1', type: 'camera' });
      expect(r.has('vision')).toBe(true);
      expect(events[0].topic).toBe(CAPABILITY_TOPIC.attached);

      remove('cam-1');
      expect(r.has('vision')).toBe(false);
      expect(events[1].topic).toBe(CAPABILITY_TOPIC.detached);
    });

    it('maps unknown sensor type to generic modality', () => {
      const { reg: sensorReg, add } = makeFakeSensorRegistry();
      reg.bindSensorRegistry(sensorReg);
      add({ id: 'x-1', name: 'Odd', type: 'mystery' });
      expect(reg.byModality('generic')).toHaveLength(1);
    });

    it('custom sensorModality overrides default', () => {
      const r = new CapabilityRegistry({
        sensorModality: () => 'audio',
      });
      const { reg: sensorReg, add } = makeFakeSensorRegistry();
      r.bindSensorRegistry(sensorReg);
      add({ id: 'cam-1', name: 'Cam', type: 'camera' });
      expect(r.byModality('audio')).toHaveLength(1);
      expect(r.has('vision')).toBe(false);
    });

    it('unbind stops listening', () => {
      const { reg: sensorReg, add } = makeFakeSensorRegistry();
      const unbind = reg.bindSensorRegistry(sensorReg);
      unbind();
      add({ id: 'cam-1', name: 'cam', type: 'camera' });
      expect(reg.list()).toHaveLength(0);
    });
  });

  describe('bindDeviceRegistry', () => {
    it('snapshots + subscribes device registry', () => {
      const { reg: devReg, add } = makeFakeDeviceRegistry([
        { id: 'd1', name: 'Cam Device', type: 'camera' },
      ]);
      reg.bindDeviceRegistry(devReg);
      expect(reg.byModality('vision')).toHaveLength(1);

      add({ id: 'd2', name: 'Therm Device', type: 'thermometer' });
      expect(reg.has('thermal')).toBe(true);
    });

    it('maps thermometer -> thermal and microphone -> audio', () => {
      const { reg: devReg, add } = makeFakeDeviceRegistry();
      reg.bindDeviceRegistry(devReg);
      add({ id: 'd1', name: 'Mic', type: 'microphone' });
      add({ id: 'd2', name: 'Therm', type: 'thermometer' });
      expect(reg.has('audio')).toBe(true);
      expect(reg.has('thermal')).toBe(true);
    });
  });

  describe('co-located source ids', () => {
    it('does not collide when a sensor and device share an id', () => {
      const { reg: sensorReg, add: addSensor } = makeFakeSensorRegistry();
      const { reg: devReg, add: addDevice } = makeFakeDeviceRegistry();
      reg.bindSensorRegistry(sensorReg);
      reg.bindDeviceRegistry(devReg);
      addSensor({ id: 'x', name: 's-x', type: 'camera' });
      addDevice({ id: 'x', name: 'd-x', type: 'camera' });
      expect(reg.list()).toHaveLength(2);
    });
  });
});
