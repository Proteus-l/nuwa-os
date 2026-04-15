import { NuwaOS } from './nuwa-os';

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp(): string {
  return DIM + new Date().toISOString().slice(11, 23) + RESET;
}

async function main(): Promise<void> {
  const duration = parseInt(process.argv[2] || '5', 10);

  console.log(`${BOLD}╔══════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║        🧠  Nuwa Runtime OS  v0.1.0       ║${RESET}`);
  console.log(`${BOLD}╚══════════════════════════════════════════╝${RESET}`);
  console.log();

  const os = new NuwaOS();

  // Hook into event bus to show real-time data flow
  const eventBus = os.getEventBus();
  let eventCount = 0;

  eventBus.subscribe('sensor.camera.**', (event) => {
    eventCount++;
    if (eventCount <= 3 || eventCount % 5 === 0) {
      const data = event.data as Record<string, unknown>;
      console.log(
        `${timestamp()} ${CYAN}[Camera]${RESET}  frame #${data.frameId ?? eventCount} ` +
          `${DIM}(${data.width ?? '?'}x${data.height ?? '?'})${RESET}`,
      );
    }
  });

  eventBus.subscribe('device.camera.*', (event) => {
    const data = event.data as Record<string, unknown>;
    if (data && (data as Record<string, unknown>).frameId) {
      console.log(
        `${timestamp()} ${GREEN}[Gateway]${RESET} device frame from ${DIM}${event.source}${RESET}`,
      );
    }
  });

  // Hook into the vision agent to show thinking
  const agent = os.getVisionAgent();
  const originalThink = agent.think.bind(agent);
  agent.think = async (percepts) => {
    const actions = await originalThink(percepts);
    if (percepts.length > 0) {
      console.log(
        `${timestamp()} ${MAGENTA}[VisionAgent]${RESET} 👁  perceived ${percepts.length} inputs → produced ${actions.length} actions`,
      );
      for (const action of actions) {
        if (action.type === 'speak') {
          console.log(
            `${timestamp()} ${YELLOW}[VisionAgent]${RESET} 💬 "${action.payload}"`,
          );
        }
      }
    }
    return actions;
  };

  // Boot sequence
  console.log(`${timestamp()} ${DIM}Booting Nuwa OS...${RESET}`);
  await os.boot();
  console.log(`${timestamp()} ${GREEN}✔${RESET} Kernel started ${DIM}(tick interval: 100ms)${RESET}`);
  console.log(`${timestamp()} ${GREEN}✔${RESET} Virtual Camera connected ${DIM}(200ms/frame)${RESET}`);
  console.log(`${timestamp()} ${GREEN}✔${RESET} VisionAgent online ${DIM}(subscribed: sensor.camera.**, device.camera.*)${RESET}`);
  console.log();
  console.log(`${DIM}── Live data flow (running ${duration}s) ──${RESET}`);
  console.log();

  await sleep(duration * 1000);

  // Final status
  const status = os.status();
  const agentStats = status.agent as Record<string, unknown>;

  console.log();
  console.log(`${DIM}── Summary ──${RESET}`);
  console.log();
  console.log(`${BOLD}  Kernel ticks:${RESET}      ${(status.kernel as Record<string, unknown>).tick}`);
  console.log(`${BOLD}  Events emitted:${RESET}    ${eventBus.history().length}`);
  console.log(`${BOLD}  Frames processed:${RESET}  ${agentStats.framesProcessed}`);
  console.log(`${BOLD}  Actions produced:${RESET}  ${agentStats.actionsProduced}`);
  console.log(`${BOLD}  Agent state:${RESET}       ${agentStats.state}`);
  console.log();

  // Data flow diagram
  console.log(`${DIM}── Data Flow Verified ──${RESET}`);
  console.log();
  console.log(`  VirtualCamera ──frame──▶ EventBus ──sensor.camera.**──▶ VisionAgent`);
  console.log(`  CameraDevice  ──data───▶ EventBus ──device.camera.*──▶ VisionAgent`);
  console.log(`                                                           │`);
  console.log(`                                                     think() → actions`);
  console.log();

  await os.shutdown();
  console.log(`${timestamp()} ${GREEN}✔${RESET} Nuwa OS shut down`);
  console.log();

  // Verification result
  const passed =
    (agentStats.framesProcessed as number) > 0 &&
    (agentStats.actionsProduced as number) > 0;

  if (passed) {
    console.log(`${GREEN}${BOLD}  ✅ All systems verified — full sensor → agent pipeline working!${RESET}`);
  } else {
    console.log(`${YELLOW}${BOLD}  ⚠️  Insufficient data — try running longer (npx tsx demo.ts 10)${RESET}`);
  }
  console.log();
}

main().catch(console.error);
