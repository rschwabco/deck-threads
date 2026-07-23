import type { AgentTask, KeyAnimation, KeyTypography, StatusAppearance } from "./companion-client";

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

function mixHex(color: string, target: string, amount: number) {
  const sourceMatch = /^#([0-9a-f]{6})$/i.exec(color);
  const targetMatch = /^#([0-9a-f]{6})$/i.exec(target);
  if (!sourceMatch || !targetMatch) return color;
  const source = Number.parseInt(sourceMatch[1], 16);
  const destination = Number.parseInt(targetMatch[1], 16);
  const channels = [16, 8, 0].map((shift) => {
    const start = (source >> shift) & 255;
    const end = (destination >> shift) & 255;
    return Math.round(start + (end - start) * amount).toString(16).padStart(2, "0");
  });
  return `#${channels.join("").toUpperCase()}`;
}

function animatedBackground(color: string, animation: KeyAnimation, frame: number) {
  if (animation !== "breathe" && animation !== "pulse") return color;
  const speed = animation === "breathe" ? 0.12 : 0.2;
  const strength = animation === "breathe" ? 0.12 : 0.17;
  const amount = ((Math.sin(frame * speed) + 1) / 2) * strength;
  return mixHex(color, "#FFFFFF", amount);
}

function contrastForeground(backgroundColor: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(backgroundColor);
  if (!match) return "#FFFFFF";
  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return (red * 299 + green * 587 + blue * 114) / 1000 > 158 ? "#111722" : "#FFFFFF";
}

function motionLayer(animation: KeyAnimation, frame: number, foreground: string) {
  if (animation === "sweep") {
    const sheenX = -92 + (frame % 48) * 6.5;
    return `<rect x="${sheenX}" y="-30" width="30" height="210" fill="${foreground}" opacity="0.16" transform="rotate(20 72 72)"/>`;
  }
  if (animation === "breathe") {
    const opacity = (0.025 + (Math.sin(frame * 0.12) + 1) * 0.035).toFixed(3);
    return `<rect width="144" height="144" rx="16" fill="${foreground}" opacity="${opacity}"/>`;
  }
  if (animation === "pulse") {
    const phase = Math.abs(frame) % 32;
    const radius = 20 + phase * 1.65;
    const opacity = Math.max(0.04, 0.36 - phase * 0.01).toFixed(2);
    return `<circle cx="72" cy="72" r="${radius}" fill="none" stroke="${foreground}" stroke-width="7" opacity="${opacity}"/>`;
  }
  return "";
}

function pinIcon(fill: string) {
  return `<g aria-label="Pinned">
    <path d="M113 13h18l-4 7v6l4 4v2h-18v-2l4-4v-6z" fill="${fill}"/>
    <path d="M122 31v9" fill="none" stroke="${fill}" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function sourcePalette(task: AgentTask) {
  if (task.sourceId === "claude") {
    return { border: "#E18452" };
  }
  return { border: "#6682FF" };
}

const DEFAULT_STATUS_APPEARANCE: Record<Exclude<AgentTask["status"], "off">, StatusAppearance> = {
  working: { backgroundColor: "#24375F", animation: "sweep" },
  question: { backgroundColor: "#57321F", animation: "pulse" },
  unread: { backgroundColor: "#1C4934", animation: "breathe" },
  read: { backgroundColor: "#2B333F", animation: "still" },
  waiting: { backgroundColor: "#4A3920", animation: "still" },
  error: { backgroundColor: "#4D2730", animation: "still" },
};
const DEFAULT_KEY_TYPOGRAPHY: KeyTypography = { slotHandleFontSize: 17, threadNameFontSize: 12 };

function scaledFontSize(value: number, defaultValue: number, baseSize: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round((value / defaultValue) * baseSize)));
}

function maxCharactersForFont(baseCharacters: number, baseFontSize: number, fontSize: number) {
  return Math.max(7, Math.round((baseCharacters * baseFontSize) / fontSize));
}

function handleText(
  value: string,
  x: number,
  y: number,
  fill: string,
  fontSize: number,
  anchor: "start" | "middle" = "middle",
  maxWidth = 110,
) {
  const estimatedWidth = value.length * fontSize * 0.62;
  const fit = estimatedWidth > maxWidth ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : "";
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" font-family="-apple-system, sans-serif" font-size="${fontSize}" font-weight="900"${fit}>${value}</text>`;
}

function titleText(value: string, startY: number, fill: string, fontSize = 15, maxCharacters = 13, maxLines = 2) {
  return wrapTitle(value, maxCharacters, maxLines).map((line, index) =>
    `<text x="72" y="${startY + index * (fontSize + 4)}" text-anchor="middle" fill="${fill}" font-family="-apple-system, sans-serif" font-size="${fontSize}" font-weight="750">${escapeXml(line)}</text>`,
  ).join("");
}

export function threadKey(
  task: AgentTask | null | undefined,
  slot: number,
  online: boolean,
  frame = 0,
  showThreadTitle = task?.status === "read",
  appearance?: StatusAppearance,
  typography?: KeyTypography,
) {
  if (!online) {
    return shell(`<text x="72" y="59" text-anchor="middle" fill="#E9EBE4" font-family="-apple-system, sans-serif" font-size="15" font-weight="750">COMPANION</text>
      <text x="72" y="87" text-anchor="middle" fill="#AEB3A7" font-family="-apple-system, sans-serif" font-size="14" font-weight="650">OFFLINE</text>`, "#111722", "#3C485B");
  }
  if (!task) {
    return shell(`<text x="72" y="82" text-anchor="middle" fill="#AEB3A7" font-family="-apple-system, sans-serif" font-size="18" font-weight="750">EMPTY</text>`, COLORS.off, "#34382D");
  }

  const projectLabel = escapeXml(task.projectLabel || `${slot + 1}`);
  const palette = sourcePalette(task);
  const statusAppearance = task.status === "off"
    ? { backgroundColor: "#202630", animation: "still" as const }
    : appearance || DEFAULT_STATUS_APPEARANCE[task.status];
  const background = animatedBackground(statusAppearance.backgroundColor, statusAppearance.animation, frame);
  const foreground = contrastForeground(statusAppearance.backgroundColor);
  const motion = motionLayer(statusAppearance.animation, frame, foreground);
  const keyTypography = typography || DEFAULT_KEY_TYPOGRAPHY;
  const compactHandleFontSize = scaledFontSize(keyTypography.slotHandleFontSize, 17, 42, 28, 64);
  const titleHandleFontSize = scaledFontSize(keyTypography.slotHandleFontSize, 17, 24, 17, 38);
  const secondaryHandleFontSize = scaledFontSize(keyTypography.slotHandleFontSize, 17, 19, 13, 31);
  const threadNameFontSize = scaledFontSize(keyTypography.threadNameFontSize, 12, 14, 10, 24);
  const titleHandleY = Math.max(30, titleHandleFontSize + 7);
  const compactHandleY = Math.round(72 + compactHandleFontSize * 0.36);

  if (task.status === "working") {
    const label = showThreadTitle
      ? `${handleText(projectLabel, 18, titleHandleY, foreground, titleHandleFontSize, "start", 88)}${titleText(task.title, 91, foreground, threadNameFontSize, maxCharactersForFont(14, 14, threadNameFontSize), 2)}`
      : handleText(projectLabel, 72, compactHandleY, foreground, compactHandleFontSize);
    return shell(`${motion}${label}
      ${task.pinned ? pinIcon(foreground) : ""}`, background, palette.border);
  }

  if (task.status === "question") {
    const content = showThreadTitle
      ? `${handleText(projectLabel, 18, titleHandleY, foreground, titleHandleFontSize, "start", 88)}
        <text x="72" y="78" text-anchor="middle" fill="${foreground}" font-family="-apple-system, sans-serif" font-size="58" font-weight="950">?</text>
        ${titleText(task.title, 108, foreground, threadNameFontSize, maxCharactersForFont(15, 13, threadNameFontSize), 2)}`
      : `<text x="72" y="91" text-anchor="middle" fill="${foreground}" font-family="-apple-system, sans-serif" font-size="76" font-weight="950">?</text>
        ${handleText(projectLabel, 72, 126, foreground, secondaryHandleFontSize)}`;
    return shell(`${motion}${content}
      ${task.pinned ? pinIcon(foreground) : ""}`, background, palette.border);
  }

  if (task.status === "unread") {
    const content = showThreadTitle
      ? `${handleText(projectLabel, 18, titleHandleY, foreground, titleHandleFontSize, "start", 88)}<text x="72" y="76" text-anchor="middle" fill="${foreground}" font-family="-apple-system, sans-serif" font-size="51" font-weight="900">✓</text>${titleText(task.title, 107, foreground, threadNameFontSize, maxCharactersForFont(15, 13, threadNameFontSize), 2)}`
      : `<text x="72" y="88" text-anchor="middle" fill="${foreground}" font-family="-apple-system, sans-serif" font-size="67" font-weight="900">✓</text>${handleText(projectLabel, 72, 125, foreground, secondaryHandleFontSize)}`;
    return shell(`${motion}${content}
      ${task.pinned ? pinIcon(foreground) : ""}`, background, palette.border);
  }

  if (task.status === "waiting") {
    const content = showThreadTitle
      ? `${handleText(projectLabel, 18, titleHandleY, foreground, titleHandleFontSize, "start", 88)}<text x="72" y="73" text-anchor="middle" fill="${foreground}" font-family="-apple-system, sans-serif" font-size="50" font-weight="850">…</text>${titleText(task.title, 107, foreground, threadNameFontSize, maxCharactersForFont(15, 13, threadNameFontSize), 2)}`
      : `<text x="72" y="88" text-anchor="middle" fill="${foreground}" font-family="-apple-system, sans-serif" font-size="62" font-weight="850">…</text>${handleText(projectLabel, 72, 125, foreground, secondaryHandleFontSize)}`;
    return shell(`${motion}${content}
      ${task.pinned ? pinIcon(foreground) : ""}`, background, palette.border);
  }

  if (task.status === "error") {
    const content = showThreadTitle
      ? `${handleText(projectLabel, 18, titleHandleY, foreground, titleHandleFontSize, "start", 88)}<text x="72" y="73" text-anchor="middle" fill="${foreground}" font-family="-apple-system, sans-serif" font-size="50" font-weight="900">!</text>${titleText(task.title, 107, foreground, threadNameFontSize, maxCharactersForFont(15, 13, threadNameFontSize), 2)}`
      : `<text x="72" y="88" text-anchor="middle" fill="${foreground}" font-family="-apple-system, sans-serif" font-size="64" font-weight="900">!</text>${handleText(projectLabel, 72, 125, foreground, secondaryHandleFontSize)}`;
    return shell(`${motion}${content}
      ${task.pinned ? pinIcon(foreground) : ""}`, background, palette.border);
  }

  const readTitle = titleText(
    task.title,
    74,
    foreground,
    threadNameFontSize,
    maxCharactersForFont(10, 14, threadNameFontSize),
    threadNameFontSize > 18 ? 2 : 3,
  );

  return shell(`${motion}${showThreadTitle
    ? handleText(projectLabel, 72, titleHandleY, foreground, titleHandleFontSize)
    : handleText(projectLabel, 72, compactHandleY, foreground, compactHandleFontSize)}
    ${showThreadTitle ? readTitle : ""}
    ${task.pinned ? pinIcon(foreground) : ""}`, background, palette.border);
}
