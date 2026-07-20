import streamDeck from "@elgato/streamdeck";
import {
  animateThreadActions,
  refreshAllActions,
  threadSlotAction,
} from "./actions";
import { companionClient } from "./companion-client";

streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(threadSlotAction);
streamDeck.connect();

void refreshAllActions();
setInterval(() => void refreshAllActions(), 1500);
setInterval(() => void animateThreadActions(), 120);
setTimeout(() => {
  streamDeck.logger.info("Deck Threads ready", {
    companionOnline: companionClient.online,
    tasks: companionClient.tasks.filter(Boolean).length,
    threadKeys: [...threadSlotAction.actions].length,
  });
}, 2500);
