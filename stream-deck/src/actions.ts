import streamDeck, {
  action,
  KeyAction,
  KeyDownEvent,
  KeyUpEvent,
  PropertyInspectorDidAppearEvent,
  SendToPluginEvent,
  SingletonAction,
  Target,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { companionClient } from "./companion-client";
import { threadKey } from "./key-art";
import { NonOverlappingTask } from "./non-overlapping-task";

type ThreadSlotSettings = { slot?: number };
type InspectorCommand = { command?: string };

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
  private titleSignatures = new Map<string, string>();
  private renderGate = new NonOverlappingTask();

  override async onWillAppear(event: WillAppearEvent<ThreadSlotSettings>) {
    if (!event.action.isKey()) return;
    this.signatures.delete(event.action.id);
    this.titleSignatures.delete(event.action.id);
    await this.render(event.action, threadSlotFor(event.action, event.payload.settings));
  }

  override onWillDisappear(event: WillDisappearEvent<ThreadSlotSettings>) {
    this.signatures.delete(event.action.id);
    this.titleSignatures.delete(event.action.id);
  }

  override async onKeyDown(event: KeyDownEvent<ThreadSlotSettings>) {
    if (!event.action.isKey()) return;
    const slot = threadSlotFor(event.action, event.payload.settings);
    const task = companionClient.tasks[slot];
    streamDeck.logger.info(`Pressed task slot ${slot}`, {
      actionId: event.action.id,
      online: companionClient.online,
      taskId: task?.id || null,
      sourceId: task?.sourceId || null,
    });
    if (!companionClient.online || !task) {
      streamDeck.logger.warn(`Rejected task slot ${slot}`, {
        online: companionClient.online,
        hasTask: Boolean(task),
      });
      await event.action.showAlert();
      return;
    }
    try {
      await companionClient.openThread(task);
      streamDeck.logger.info(`Opened ${task.sourceId} task in slot ${slot}`, { taskId: task.id });
      await event.action.showOk();
      setTimeout(() => void refreshAllActions(), 650);
    } catch (error) {
      streamDeck.logger.error(`Failed to open ${task.sourceId} task in slot ${slot}`, error);
      await event.action.showAlert();
    }
  }

  override async onKeyUp(event: KeyUpEvent<ThreadSlotSettings>) {
    if (!event.action.isKey()) return;
    const slot = threadSlotFor(event.action, event.payload.settings);
    streamDeck.logger.info(`Released task slot ${slot}`, {
      actionId: event.action.id,
    });
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

  renderAll(): Promise<void> {
    // Stream Deck image updates can take longer than an animation tick. Never
    // queue another full-device render behind one that is still in flight: a
    // backlog here blocks key events for the entire device.
    return this.renderGate.run(() => this.performRenderAll());
  }

  private async performRenderAll() {
    // Serialize initial key updates. A companion launch can change all eight
    // keys at once, and a single ordered stream is safer for the hardware than
    // a burst of simultaneous image commands.
    for (const current of [...this.actions].filter((action) => action.isKey())) {
      try {
        const settings = await current.getSettings<ThreadSlotSettings>();
        await this.render(current, threadSlotFor(current, settings));
      } catch (error) {
        streamDeck.logger.error(`Failed to read settings for action ${current.id}`, error);
      }
    }
  }

  private async render(current: KeyAction<ThreadSlotSettings>, slot: number) {
    const task = companionClient.tasks[slot];
    const appearance = task ? companionClient.appearanceFor(task) : undefined;
    const typography = task ? companionClient.typographyFor(task) : undefined;
    const showThreadTitle = task ? companionClient.showThreadTitle(task.status) : false;
    const signature = `${companionClient.online}:${task?.stableId}:${task?.sourceLabel}:${task?.status}:${task?.title}:${task?.projectLabel}:${task?.pinned}:${showThreadTitle}:${appearance?.backgroundColor}:${appearance?.animation}:${typography?.slotHandleFontSize}:${typography?.threadNameFontSize}`;
    if (this.signatures.get(current.id) === signature) return;
    try {
      // Keep status visuals static on the physical device. Continuous image
      // writes can block the Stream Deck host's HID key-reading path.
      const image = threadKey(task, slot, companionClient.online, 0, showThreadTitle, appearance, typography);
      await current.setImage(image, { target: Target.HardwareAndSoftware });
      if (this.titleSignatures.get(current.id) !== "") {
        await current.setTitle("", { target: Target.HardwareAndSoftware });
        this.titleSignatures.set(current.id, "");
      }
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
