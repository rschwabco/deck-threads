import streamDeck from "@elgato/streamdeck";
import {
  animateThreadActions,
  refreshAllActions,
  threadSlotAction,
} from "./actions";
import { companionClient } from "./companion-client";

const REFRESH_INTERVAL_MS = 1500;
const ANIMATION_INTERVAL_MS = 250;

streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(threadSlotAction);
streamDeck.connect();

void refreshAllActions();
setInterval(() => void refreshAllActions(), REFRESH_INTERVAL_MS);
setInterval(() => void animateThreadActions(), ANIMATION_INTERVAL_MS);
setTimeout(() => {
  streamDeck.logger.info("Deck Threads ready", {
    companionOnline: companionClient.online,
    tasks: companionClient.tasks.filter(Boolean).length,
    threadKeys: [...threadSlotAction.actions].length,
  });
}, 2500);
