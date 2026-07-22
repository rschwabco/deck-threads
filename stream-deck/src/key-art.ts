import type { AgentTask } from "./companion-client";

const COLORS: Record<string, string> = {
  working: "#6682FF",
  question: "#FF9A52",
  unread: "#55DF96",
  read: "#7F8B9E",
  waiting: "#F5B554",
  error: "#FF6678",
  off: "#22251F",
};

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '\"': "&quot;",
  })[character] || character);
}

function wrapTitle(value: string, maxCharacters = 10, maxLines = 3) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharacters || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);

  const consumed = lines.join(" ").length;
  if (consumed < value.replace(/\s+/g, " ").trim().length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, maxCharacters - 1)}…`;
  }
  return lines;
}

function shell(content: string, background = "#151711", border = "#34382D") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="16" fill="${background}"/>
    <rect x="3" y="3" width="138" height="138" rx="13" fill="none" stroke="${border}" stroke-width="6"/>
    ${content}
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function animatedColor(colors: string[], frame: number) {
  return colors[Math.abs(frame) % colors.length];
}

function pinIcon(fill: string) {
  return `<g aria-label="Pinned">
    <path d="M113 13h18l-4 7v6l4 4v2h-18v-2l4-4v-6z" fill="${fill}"/>
    <path d="M122 31v9" fill="none" stroke="${fill}" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function sourcePalette(task: AgentTask) {
  if (task.sourceId === "claude") {
    return {
      border: "#E18452",
      shadow: "#27150F",
    };
  }
  return {
    border: "#6682FF",
    shadow: "#111A36",
  };
}

const STATUS_SURFACES = {
  working: [
    "#24375F", "#263B67", "#29406F", "#2B4477", "#2E497F", "#304D87",
    "#33528F", "#304D87", "#2E497F", "#2B4477", "#29406F", "#263B67",
  ],
  question: "#4B2B1D",
  unread: "#173A29",
  read: "#242D39",
  waiting: "#40321D",
  error: "#43232B",
};

function titleText(value: string, startY: number, fill: string, fontSize = 15, maxCharacters = 13, maxLines = 2) {
  return wrapTitle(value, maxCharacters, maxLines).map((line, index) =>
    `<text x="72" y="${startY + index * (fontSize + 4)}" text-anchor="middle" fill="${fill}" font-family="-apple-system, sans-serif" font-size="${fontSize}" font-weight="750">${escapeXml(line)}</text>`,
  ).join("");
}

export function threadKey(task: AgentTask | null | undefined, slot: number, online: boolean, frame = 0, showThreadTitle = task?.status === "read") {
  if (!online) {
    return shell(`<text x="72" y="59" text-anchor="middle" fill="#E9EBE4" font-family="-apple-system, sans-serif" font-size="15" font-weight="750">COMPANION</text>
      <text x="72" y="87" text-anchor="middle" fill="#AEB3A7" font-family="-apple-system, sans-serif" font-size="14" font-weight="650">OFFLINE</text>`, "#111722", "#3C485B");
  }
  if (!task) {
    return shell(`<text x="72" y="82" text-anchor="middle" fill="#AEB3A7" font-family="-apple-system, sans-serif" font-size="18" font-weight="750">EMPTY</text>`, COLORS.off, "#34382D");
  }

  const projectLabel = escapeXml(task.projectLabel || `${slot + 1}`);
  const palette = sourcePalette(task);

  if (task.status === "working") {
    const background = animatedColor(STATUS_SURFACES.working, frame);
    const flow = frame % 48;
    const waveA = -132 + flow * 5.75;
    const waveB = 112 - flow * 4.8;
    const sheenX = -92 + flow * 6.5;
    const breathe = (0.12 + (Math.sin(frame * 0.24) + 1) * 0.035).toFixed(3);
    const label = showThreadTitle
      ? `<text x="18" y="34" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="24" font-weight="850">${projectLabel}</text>${titleText(task.title, 91, "#FFFFFF", 14, 14, 2)}`
      : `<rect x="19" y="39" width="106" height="66" rx="33" fill="${palette.shadow}" opacity="${breathe}"/><text x="72" y="87" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="42" font-weight="850">${projectLabel}</text>`;
    return shell(`<path d="M-110 49 C-70 7 -28 91 14 49 S98 7 140 49 S224 91 266 49" fill="none" stroke="#8DA2FF" stroke-width="25" stroke-linecap="round" opacity="0.18" transform="translate(${waveA} 0)"/>
      <path d="M-120 94 C-76 53 -32 135 12 94 S100 53 144 94 S232 135 276 94" fill="none" stroke="#152344" stroke-width="31" stroke-linecap="round" opacity="0.24" transform="translate(${waveB} 0)"/>
      <rect x="${sheenX}" y="-30" width="28" height="210" fill="#FFFFFF" opacity="0.12" transform="rotate(20 72 72)"/>
      ${label}
      ${task.pinned ? pinIcon("#FFFFFF") : ""}`, background, palette.border);
  }

  if (task.status === "question") {
    const phase = frame % 36;
    const ringRadius = 22 + (phase % 18) * 1.5;
    const ringOpacity = (0.48 - (phase % 18) * 0.02).toFixed(2);
    const content = showThreadTitle
      ? `<text x="18" y="30" fill="#FFD9BA" font-family="-apple-system, sans-serif" font-size="23" font-weight="900">${projectLabel}</text>
        <text x="72" y="78" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="58" font-weight="950">?</text>
        ${titleText(task.title, 108, "#FFFFFF", 13, 15, 2)}`
      : `<text x="72" y="91" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="76" font-weight="950">?</text>
        <text x="72" y="125" text-anchor="middle" fill="#FFD9BA" font-family="-apple-system, sans-serif" font-size="20" font-weight="900">${projectLabel}</text>`;
    return shell(`<circle cx="72" cy="68" r="${ringRadius}" fill="none" stroke="#FFF3E8" stroke-width="6" opacity="${ringOpacity}"/>
      <circle cx="72" cy="68" r="${Math.max(12, ringRadius - 18)}" fill="none" stroke="#8F2E00" stroke-width="8" opacity="0.28"/>
      ${content}
      ${task.pinned ? pinIcon("#FFFFFF") : ""}`, STATUS_SURFACES.question, palette.border);
  }

  if (task.status === "unread") {
    const sheenX = -80 + (frame % 6) * 48;
    const content = showThreadTitle
      ? `<text x="18" y="30" fill="#C8FFDA" font-family="-apple-system, sans-serif" font-size="23" font-weight="900">${projectLabel}</text><text x="72" y="76" text-anchor="middle" fill="#C8FFDA" font-family="-apple-system, sans-serif" font-size="51" font-weight="900">✓</text>${titleText(task.title, 107, "#FFFFFF", 13, 15, 2)}`
      : `<text x="72" y="88" text-anchor="middle" fill="#C8FFDA" font-family="-apple-system, sans-serif" font-size="67" font-weight="900">✓</text><text x="72" y="124" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="19" font-weight="900">${projectLabel}</text>`;
    return shell(`<rect x="${sheenX}" y="-20" width="34" height="190" fill="#72F59F" opacity="0.18" transform="rotate(18 72 72)"/>
      ${content}
      ${task.pinned ? pinIcon("#C8FFDA") : ""}`, STATUS_SURFACES.unread, palette.border);
  }

  if (task.status === "waiting") {
    const content = showThreadTitle
      ? `<text x="18" y="30" fill="#FFD0A8" font-family="-apple-system, sans-serif" font-size="23" font-weight="900">${projectLabel}</text><text x="72" y="73" text-anchor="middle" fill="#FFD0A8" font-family="-apple-system, sans-serif" font-size="50" font-weight="850">…</text>${titleText(task.title, 107, "#FFFFFF", 13, 15, 2)}`
      : `<text x="72" y="88" text-anchor="middle" fill="#FFD0A8" font-family="-apple-system, sans-serif" font-size="62" font-weight="850">…</text><text x="72" y="124" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="19" font-weight="900">${projectLabel}</text>`;
    return shell(`${content}
      ${task.pinned ? pinIcon("#FFD0A8") : ""}`, STATUS_SURFACES.waiting, palette.border);
  }

  if (task.status === "error") {
    const content = showThreadTitle
      ? `<text x="18" y="30" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="23" font-weight="900">${projectLabel}</text><text x="72" y="73" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="50" font-weight="900">!</text>${titleText(task.title, 107, "#FFFFFF", 13, 15, 2)}`
      : `<text x="72" y="88" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="64" font-weight="900">!</text><text x="72" y="124" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="19" font-weight="900">${projectLabel}</text>`;
    return shell(`${content}
      ${task.pinned ? pinIcon("#FFFFFF") : ""}`, STATUS_SURFACES.error, palette.border);
  }

  const lines = wrapTitle(task.title).map((line, index) =>
    `<text x="72" y="${72 + index * 21}" text-anchor="middle" fill="#F0F2ED" font-family="-apple-system, sans-serif" font-size="17" font-weight="750">${escapeXml(line)}</text>`,
  ).join("");

  return shell(`<text x="72" y="${showThreadTitle ? 40 : 84}" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="${showThreadTitle ? 25 : 42}" font-weight="900">${projectLabel}</text>
    ${showThreadTitle ? lines : ""}
    ${task.pinned ? pinIcon("#C6CEDA") : ""}`, STATUS_SURFACES.read, palette.border);
}
