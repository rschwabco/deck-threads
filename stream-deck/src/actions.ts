import streamDeck, {
  action,
  KeyAction,
  KeyDownEvent,
  PropertyInspectorDidAppearEvent,
  SendToPluginEvent,
  SingletonAction,
  Target,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { companionClient } from "./companion-client";
import { threadKey } from "./key-art";

type ThreadSlotSettings = { slot?: number };
type InspectorCommand = { command?: string };
let animationFrame = 0;

function inspectorStatus() {
  return {
    type: "status",
    online: companionClient.online,
    taskCount: companionClient.tasks.filter(Boolean).length,
    scannedAt: companionClient.scannedAt || null,
  };
}

function threadSlotFor(action: KeyAction<ThreadSlotSettings>, settings: ThreadSlotSettings) {
  if (Number.isInteger(settings.slot) && Number(settings.slot) >= 0) {
    return Number(settings.slot);
  }

  const coordinates = action.coordinates;
  if (!coordinates) return 0;
  return coordinates.row === 0 ? coordinates.column : 4 + coordinates.column;
}

@action({ UUID: "com.roie.deck-threads.thread" })
export class ThreadSlotAction extends SingletonAction<ThreadSlotSettings> {
  private signatures = new Map<string, string>();

  override async onWillAppear(event: WillAppearEvent<ThreadSlotSettings>) {
    if (!event.action.isKey()) return;
    await this.render(event.action, threadSlotFor(event.action, event.payload.settings), animationFrame);
  }

  override async onKeyDown(event: KeyDownEvent<ThreadSlotSettings>) {
    if (!event.action.isKey()) return;
    const slot = threadSlotFor(event.action, event.payload.settings);
    const task = companionClient.tasks[slot];
    if (!companionClient.online || !task) {
      await event.action.showAlert();
      return;
    }
    try {
      await companionClient.openThread(task.id);
      await event.action.showOk();
      setTimeout(() => void refreshAllActions(), 650);
    } catch {
      await event.action.showAlert();
    }
  }

  override async onPropertyInspectorDidAppear(_event: PropertyInspectorDidAppearEvent<ThreadSlotSettings>) {
    await companionClient.refresh();
    await streamDeck.ui.sendToPropertyInspector(inspectorStatus());
  }

  override async onSendToPlugin(event: SendToPluginEvent<InspectorCommand, ThreadSlotSettings>) {
    const command = event.payload?.command;
    if (command === "focusCompanion") {
      try {
        await companionClient.focusCompanion();
      } catch {
        // The status response below guides the user when the companion is not running.
      }
    }
    await companionClient.refresh();
    await streamDeck.ui.sendToPropertyInspector(inspectorStatus());
  }

  async renderAll(frame = animationFrame) {
    await Promise.allSettled([...this.actions].filter((current) => current.isKey()).map(async (current) => {
      const settings = await current.getSettings<ThreadSlotSettings>();
      await this.render(current, threadSlotFor(current, settings), frame);
    }));
  }

  private async render(current: KeyAction<ThreadSlotSettings>, slot: number, frame: number) {
    const task = companionClient.tasks[slot];
    const animatedFrame = task?.status === "unread"
      ? Math.floor(frame / 2)
      : task?.status === "working"
        ? frame
        : 0;
    const signature = `${companionClient.online}:${task?.id}:${task?.status}:${task?.title}:${task?.projectLabel}:${task?.pinned}:${animatedFrame}`;
    if (this.signatures.get(current.id) === signature) return;
    try {
      const image = threadKey(task, slot, companionClient.online, frame);
      await current.setImage(image, { target: Target.Hardware });
      await current.setImage(image, { target: Target.Software });
      await current.setTitle("", { target: Target.HardwareAndSoftware });
      this.signatures.set(current.id, signature);
    } catch (error) {
      streamDeck.logger.error(`Failed to render thread slot ${slot}`, error);
    }
  }
}

export const threadSlotAction = new ThreadSlotAction();

export async function refreshAllActions() {
  await companionClient.refresh();
  await threadSlotAction.renderAll();
}

export async function animateThreadActions() {
  animationFrame += 1;
  await threadSlotAction.renderAll(animationFrame);
}
