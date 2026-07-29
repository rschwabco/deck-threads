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
  private animationSignatures = new Map<string, string>();
  private slots = new Map<string, number>();
  private animationCursor = 0;
  private animationPausedUntil = 0;
  private animationTelemetryStartedAt?: number;
  private animationWrites = 0;
  private animationTelemetryLogged = false;
  private renderGate = new NonOverlappingTask();

  override async onWillAppear(event: WillAppearEvent<ThreadSlotSettings>) {
    const current = event.action;
    if (!current.isKey()) return;
    const slot = threadSlotFor(current, event.payload.settings);
    this.signatures.delete(current.id);
    this.titleSignatures.delete(current.id);
    this.animationSignatures.delete(current.id);
    this.slots.set(current.id, slot);
    await this.renderGate.run(() => this.render(current, slot));
  }

  override onWillDisappear(event: WillDisappearEvent<ThreadSlotSettings>) {
    this.signatures.delete(event.action.id);
    this.titleSignatures.delete(event.action.id);
    this.animationSignatures.delete(event.action.id);
    this.slots.delete(event.action.id);
  }

  override async onKeyDown(event: KeyDownEvent<ThreadSlotSettings>) {
    if (!event.action.isKey()) return;
    // Keep the hardware transport clear while a key press is being handled.
    this.animationPausedUntil = Date.now() + 500;
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
    this.animationPausedUntil = Math.max(this.animationPausedUntil, Date.now() + 150);
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

  animateNext(frame: number): Promise<void> {
    // Animation ticks share the render gate with state changes. When a write is
    // slow, later ticks are dropped instead of building a device-wide backlog.
    return this.renderGate.run(() => this.performAnimateNext(frame));
  }

  private async performRenderAll() {
    // Serialize initial key updates. A companion launch can change all eight
    // keys at once, and a single ordered stream is safer for the hardware than
    // a burst of simultaneous image commands.
    for (const current of [...this.actions].filter((action) => action.isKey())) {
      try {
        const settings = await current.getSettings<ThreadSlotSettings>();
        const slot = threadSlotFor(current, settings);
        this.slots.set(current.id, slot);
        await this.render(current, slot);
      } catch (error) {
        streamDeck.logger.error(`Failed to read settings for action ${current.id}`, error);
      }
    }
  }

  private async performAnimateNext(frame: number) {
    if (!companionClient.online || Date.now() < this.animationPausedUntil) return;
    const keys = [...this.actions].filter((action) => action.isKey());
    if (!keys.length) return;

    for (let offset = 0; offset < keys.length; offset += 1) {
      const index = (this.animationCursor + offset) % keys.length;
      const current = keys[index];
      let slot = this.slots.get(current.id);
      if (slot === undefined) {
        const settings = await current.getSettings<ThreadSlotSettings>();
        slot = threadSlotFor(current, settings);
        this.slots.set(current.id, slot);
      }
      const task = companionClient.tasks[slot];
      if (!task || companionClient.appearanceFor(task).animation === "still") continue;

      this.animationCursor = (index + 1) % keys.length;
      await this.renderAnimationFrame(current, slot, frame);
      return;
    }
  }

  private visualSignature(slot: number) {
    const task = companionClient.tasks[slot];
    const appearance = task ? companionClient.appearanceFor(task) : undefined;
    const typography = task ? companionClient.typographyFor(task) : undefined;
    const showThreadTitle = task ? companionClient.showThreadTitle(task.status) : false;
    return {
      task,
      appearance,
      typography,
      showThreadTitle,
      signature: `${companionClient.online}:${task?.stableId}:${task?.sourceLabel}:${task?.status}:${task?.title}:${task?.projectLabel}:${task?.pinned}:${showThreadTitle}:${appearance?.backgroundColor}:${appearance?.animation}:${typography?.slotHandleFontSize}:${typography?.threadNameFontSize}`,
    };
  }

  private async renderAnimationFrame(current: KeyAction<ThreadSlotSettings>, slot: number, frame: number) {
    const visual = this.visualSignature(slot);
    if (!visual.task || !visual.appearance || visual.appearance.animation === "still") return;
    const signature = `${visual.signature}:${frame}`;
    if (this.animationSignatures.get(current.id) === signature) return;
    try {
      const image = threadKey(
        visual.task,
        slot,
        companionClient.online,
        frame,
        visual.showThreadTitle,
        visual.appearance,
        visual.typography,
      );
      // Animation is physical-device-only; the software preview is refreshed
      // by state changes and does not need a 20 Hz image stream.
      await current.setImage(image, { target: Target.Hardware });
      this.animationSignatures.set(current.id, signature);
      this.animationTelemetryStartedAt ||= Date.now();
      this.animationWrites += 1;
      const telemetryDuration = Date.now() - this.animationTelemetryStartedAt;
      if (!this.animationTelemetryLogged && telemetryDuration >= 3000) {
        this.animationTelemetryLogged = true;
        streamDeck.logger.info("Animation renderer active", {
          successfulWrites: this.animationWrites,
          writesPerSecond: Number((this.animationWrites / (telemetryDuration / 1000)).toFixed(1)),
        });
      }
    } catch (error) {
      streamDeck.logger.error(`Failed to animate thread slot ${slot}`, error);
    }
  }

  private async render(current: KeyAction<ThreadSlotSettings>, slot: number) {
    const { task, appearance, typography, showThreadTitle, signature } = this.visualSignature(slot);
    if (this.signatures.get(current.id) === signature) return;
    try {
      const image = threadKey(task, slot, companionClient.online, 0, showThreadTitle, appearance, typography);
      await current.setImage(image, { target: Target.HardwareAndSoftware });
      if (this.titleSignatures.get(current.id) !== "") {
        await current.setTitle("", { target: Target.HardwareAndSoftware });
        this.titleSignatures.set(current.id, "");
      }
      this.signatures.set(current.id, signature);
      this.animationSignatures.delete(current.id);
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

export async function animateThreadActions(frame: number) {
  await threadSlotAction.animateNext(frame);
}
