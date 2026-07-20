import type { CodexTask } from "./companion-client";

const COLORS: Record<string, string> = {
  working: "#304FFE",
  unread: "#00FF4C",
  read: "#FFFFFF",
  waiting: "#FF6D00",
  error: "#FF0033",
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

export function threadKey(task: CodexTask | null | undefined, slot: number, online: boolean, frame = 0) {
  if (!online) {
    return shell(`<text x="72" y="59" text-anchor="middle" fill="#E9EBE4" font-family="-apple-system, sans-serif" font-size="15" font-weight="750">COMPANION</text>
      <text x="72" y="87" text-anchor="middle" fill="#AEB3A7" font-family="-apple-system, sans-serif" font-size="14" font-weight="650">OFFLINE</text>`, "#111722", "#3C485B");
  }
  if (!task) {
    return shell(`<text x="72" y="82" text-anchor="middle" fill="#AEB3A7" font-family="-apple-system, sans-serif" font-size="18" font-weight="750">EMPTY</text>`, COLORS.off, "#34382D");
  }

  const color = COLORS[task.status] || task.color || COLORS.off;
  const projectLabel = escapeXml(task.projectLabel || `${slot + 1}`);

  if (task.status === "working") {
    const background = animatedColor([
      "#1837CB", "#1B3DD6", "#2044E1", "#264AEC", "#2B4FF5", "#3054FC",
      "#3357FF", "#3054FC", "#2B4FF5", "#264AEC", "#2044E1", "#1B3DD6",
    ], frame);
    const flow = frame % 48;
    const waveA = -132 + flow * 5.75;
    const waveB = 112 - flow * 4.8;
    const sheenX = -92 + flow * 6.5;
    const breathe = (0.12 + (Math.sin(frame * 0.24) + 1) * 0.035).toFixed(3);
    return shell(`<path d="M-110 49 C-70 7 -28 91 14 49 S98 7 140 49 S224 91 266 49" fill="none" stroke="#91A3FF" stroke-width="25" stroke-linecap="round" opacity="0.18" transform="translate(${waveA} 0)"/>
      <path d="M-120 94 C-76 53 -32 135 12 94 S100 53 144 94 S232 135 276 94" fill="none" stroke="#0A1B7A" stroke-width="31" stroke-linecap="round" opacity="0.24" transform="translate(${waveB} 0)"/>
      <rect x="${sheenX}" y="-30" width="28" height="210" fill="#FFFFFF" opacity="0.12" transform="rotate(20 72 72)"/>
      <rect x="19" y="39" width="106" height="66" rx="33" fill="#081A7A" opacity="${breathe}"/>
      <text x="72" y="87" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="42" font-weight="850">${projectLabel}</text>
      ${task.pinned ? pinIcon("#FFFFFF") : ""}`, background, "#6E83FF");
  }

  if (task.status === "unread") {
    const background = animatedColor(["#00C83C", "#00FF4C", "#62FF8D", "#00FF4C"], frame);
    const border = frame % 2 === 0 ? "#FFFFFF" : "#07280F";
    const sheenX = -80 + (frame % 6) * 48;
    return shell(`<rect x="${sheenX}" y="-20" width="34" height="190" fill="#FFFFFF" opacity="0.22" transform="rotate(18 72 72)"/>
      <text x="72" y="88" text-anchor="middle" fill="#06240E" font-family="-apple-system, sans-serif" font-size="67" font-weight="900">✓</text>
      <text x="72" y="124" text-anchor="middle" fill="#06240E" font-family="-apple-system, sans-serif" font-size="19" font-weight="900">${projectLabel}</text>
      ${task.pinned ? pinIcon("#06240E") : ""}`, background, border);
  }

  if (task.status === "waiting") {
    return shell(`<text x="72" y="88" text-anchor="middle" fill="#2B1300" font-family="-apple-system, sans-serif" font-size="62" font-weight="850">…</text>
      <text x="72" y="124" text-anchor="middle" fill="#2B1300" font-family="-apple-system, sans-serif" font-size="19" font-weight="900">${projectLabel}</text>
      ${task.pinned ? pinIcon("#2B1300") : ""}`, color, "#FFD0A8");
  }

  if (task.status === "error") {
    return shell(`<text x="72" y="88" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="64" font-weight="900">!</text>
      <text x="72" y="124" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="19" font-weight="900">${projectLabel}</text>
      ${task.pinned ? pinIcon("#FFFFFF") : ""}`, color, "#FFFFFF");
  }

  const lines = wrapTitle(task.title).map((line, index) =>
    `<text x="72" y="${72 + index * 21}" text-anchor="middle" fill="#F0F2ED" font-family="-apple-system, sans-serif" font-size="17" font-weight="750">${escapeXml(line)}</text>`,
  ).join("");

  return shell(`<text x="72" y="40" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="25" font-weight="900">${projectLabel}</text>
    ${lines}
    ${task.pinned ? pinIcon("#C6CDC1") : ""}`, "#2B2F29", "#5C6359");
}
