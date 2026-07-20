import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = path.join(root, "com.roie.deck-threads.sdPlugin");
const outputPath = path.join(pluginRoot, "deck-threads.streamDeckProfile");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "deck-threads-profile-"));
const profileName = "6E0E45F9-8D8B-4A93-A128-6A22E9F6C31A.sdProfile";
const profileRoot = path.join(temporaryRoot, profileName);
// Stream Deck profiles use opaque 27-character page directory identifiers.
// These values mirror the layout emitted by Elgato's official profile samples.
const mainPage = "6VNA6HBI4T10LFWGJ26HM1DEL8Z";
const blankPage = "ELB0ST0NB56F937RI7BJHE86OGZ";

const state = {
  FontFamily: "",
  FontSize: 9,
  FontStyle: "",
  FontUnderline: false,
  OutlineThickness: 0,
  ShowTitle: false,
  TitleAlignment: "middle",
  TitleColor: "#FFFFFF",
};

function actionEntry({ actionId, name, settings, uuid }) {
  return {
    ActionID: actionId,
    LinkedTitle: true,
    Name: name,
    Settings: settings,
    State: 0,
    States: [state],
    UUID: uuid,
  };
}

const actions = {};
const coordinates = ["0,0", "1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1"];
for (let slot = 0; slot < 8; slot += 1) {
  actions[coordinates[slot]] = actionEntry({
    actionId: `10000000-0000-4000-8000-00000000000${slot}`,
    name: `Thread ${slot + 1}`,
    settings: { slot },
    uuid: "com.roie.deck-threads.thread",
  });
}
try {
  fs.mkdirSync(path.join(profileRoot, "Profiles", mainPage, "Images"), { recursive: true });
  fs.mkdirSync(path.join(profileRoot, "Profiles", blankPage, "Images"), { recursive: true });
  fs.writeFileSync(path.join(profileRoot, "manifest.json"), JSON.stringify({
    Device: { Model: "20GBD9901", UUID: "" },
    Name: "Deck Threads",
    Pages: {
      Current: "37aea345-7227-420a-bff0-988d1b05aeaa",
      Default: "75560e74-1759-4cf4-8cfb-91d738b906c4",
      Pages: ["37aea345-7227-420a-bff0-988d1b05aeaa"],
    },
    Version: "2.0",
  }));
  fs.writeFileSync(path.join(profileRoot, "Profiles", mainPage, "manifest.json"), JSON.stringify({
    Controllers: [
      { Actions: actions, Type: "Keypad" },
      { Actions: {}, Type: "Encoder" },
    ],
    Icon: "",
    Name: "",
  }));
  fs.writeFileSync(path.join(profileRoot, "Profiles", blankPage, "manifest.json"), JSON.stringify({
    Controllers: [
      { Actions: {}, Type: "Keypad" },
      { Actions: {}, Type: "Encoder" },
    ],
    Icon: "",
    Name: "",
  }));

  fs.rmSync(outputPath, { force: true });
  execFileSync("zip", ["-qr", outputPath, profileName], { cwd: temporaryRoot });
  process.stdout.write(`Built ${outputPath}\n`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
