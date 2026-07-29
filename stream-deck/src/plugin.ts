import streamDeck from "@elgato/streamdeck";
import {
  animateThreadActions,
  refreshAllActions,
  threadSlotAction,
} from "./actions";
import { companionClient } from "./companion-client";
import { scheduleAnimation, scheduleRefresh } from "./refresh-scheduler";

streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(threadSlotAction);
streamDeck.connect();

scheduleRefresh(refreshAllActions);
scheduleAnimation(animateThreadActions);
setTimeout(() => {
  streamDeck.logger.info("Deck Threads ready", {
    companionOnline: companionClient.online,
    tasks: companionClient.tasks.filter(Boolean).length,
    threadKeys: [...threadSlotAction.actions].length,
  });
}, 2500);
