#!/usr/bin/env node
/**
 * Generates assets/rocket-calendar.svg: a rocket that flies through the
 * user's real GitHub contribution calendar, igniting each day as it passes.
 *
 * Usage:
 *   GH_TOKEN=xxxx GH_USERNAME=SrijanCherupally node generate-rocket-svg.mjs
 *
 * GH_TOKEN needs no special scopes for public data — a token with just
 * "read:user" works. In GitHub Actions, the built-in GITHUB_TOKEN does NOT
 * have permission to read the contribution calendar of an arbitrary user via
 * GraphQL, so you'll need a Personal Access Token (classic, scope
 * "read:user") saved as a repo secret, e.g. GH_PAT.
 */

const CELL = 10;      // square size
const GAP = 3;        // gap between squares
const MARGIN_L = 24;
const MARGIN_T = 28;  // leaves room for month labels
const MARGIN_R = 20;
const MARGIN_B = 16;

async function fetchCalendar(username, token) {
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                weekday
                color
                contributionCount
              }
            }
          }
        }
      }
    }`;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data.user.contributionsCollection.contributionCalendar;
}

function monthLabel(dateStr) {
  return new Date(dateStr + "T00:00:00Z").toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

function adjustColorForDarkMode(hexColor) {
  // Convert hex to RGB
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Reduce brightness by mixing with dark color for dark theme
  const darkR = Math.floor(r * 0.6);
  const darkG = Math.floor(g * 0.6);
  const darkB = Math.floor(b * 0.6);

  return `#${darkR.toString(16).padStart(2, "0")}${darkG.toString(16).padStart(2, "0")}${darkB.toString(16).padStart(2, "0")}`;
}

/**
 * Builds the SVG string from a contributionCalendar object
 * ({ totalContributions, weeks: [{ contributionDays: [...] }] }).
 */
export function buildSVG(calendar) {
  const { weeks } = calendar;
  const numWeeks = weeks.length;

  const width = MARGIN_L + numWeeks * (CELL + GAP) - GAP + MARGIN_R;
  const height = MARGIN_T + 7 * (CELL + GAP) - GAP + MARGIN_B;

  // Collect all cells with their positions
  const allCells = [];
  weeks.forEach((week, w) => {
    const days = week.contributionDays;
    days.forEach((day, dayIdx) => {
      const cx = MARGIN_L + w * (CELL + GAP) + CELL / 2;
      const cy = MARGIN_T + dayIdx * (CELL + GAP) + CELL / 2;
      allCells.push({ ...day, x: cx, y: cy, w, dayIdx });
    });
  });

  const startX = MARGIN_L + 10;
  const endX = MARGIN_L + numWeeks * (CELL + GAP) - 12;
  const centerY = MARGIN_T + 3 * (CELL + GAP) + CELL / 2; // middle of the calendar

  // Month labels: mark the week where a new month starts (first day only).
  const monthLabels = [];
  let lastMonth = null;
  weeks.forEach((week, w) => {
    const first = week.contributionDays[0];
    if (!first) return;
    const m = monthLabel(first.date);
    if (m !== lastMonth) {
      monthLabels.push({ label: m, x: MARGIN_L + w * (CELL + GAP) });
      lastMonth = m;
    }
  });

  // Dark mode friendly calendar squares - muted/dimmed versions
  const daySquares = allCells
    .map((cell) => {
      // Darken the colors for dark theme compatibility
      // Never inherit GitHub's light-theme greys.
      const color = cell.contributionCount === 0 ? "#161b22" : cell.contributionCount === 1 ? "#0e4429" : cell.contributionCount === 2 ? "#006d32" : cell.contributionCount === 3 ? "#26a641" : "#39d353";
      return `<rect id="cell-${cell.w}-${cell.dayIdx}" x="${(cell.x - CELL / 2).toFixed(1)}" y="${(cell.y - CELL / 2).toFixed(
        1
      )}" width="${CELL}" height="${CELL}" rx="2" fill="${color}"/>`;
    })
    .join("\n    ");

  const monthLabelSvg = monthLabels
    .map(
      (m) =>
        `<text x="${m.x}" y="${MARGIN_T - 10}" font-size="9" fill="#8b949e" font-family="Helvetica, Arial, sans-serif">${m.label}</text>`
    )
    .join("\n    ");

  // One gentle arc: readable at GitHub profile scale, without extra effects.
  const flightPath = `M ${startX.toFixed(1)} ${centerY.toFixed(1)} Q ${(width * 0.5).toFixed(1)} ${(centerY - 13).toFixed(1)} ${endX.toFixed(1)} ${centerY.toFixed(1)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="rocketBody" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#fff7dd"/>
      <stop offset="100%" stop-color="#d9d0b5"/>
    </linearGradient>
    <linearGradient id="fire" x1="0" x2="1">
      <stop offset="0%" stop-color="#ef4444" stop-opacity="0"/>
      <stop offset="45%" stop-color="#ff7a18"/>
      <stop offset="100%" stop-color="#fff3a3"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"/>

  <g>
    ${monthLabelSvg}
  </g>

  <g id="calendar">
    ${daySquares}
  </g>

  <path d="${flightPath}" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 9" opacity=".5"/>

  <g id="rocket" transform="translate(${(width * 0.24).toFixed(1)} ${(centerY - 4).toFixed(1)}) rotate(-4)">
    <path d="M -50 0 L -25 -10 L -25 10 Z" fill="url(#fire)">
      <animate attributeName="d" values="M -50 0 L -25 -10 L -25 10 Z;M -57 0 L -25 -12 L -25 12 Z;M -50 0 L -25 -10 L -25 10 Z" dur=".18s" repeatCount="indefinite"/>
    </path>
    <path d="M -24 -13 L 15 -13 Q 31 -13 40 0 Q 31 13 15 13 L -24 13 Z" fill="url(#rocketBody)" stroke="#1f2937" stroke-width="2"/>
    <path d="M 15 -13 Q 31 -13 40 0 Q 31 13 15 13 Z" fill="#e94d35" stroke="#1f2937" stroke-width="2"/>
    <path d="M -18 -12 L -35 -25 L -30 -4 L -10 -5 Z" fill="#e94d35" stroke="#1f2937" stroke-width="2" stroke-linejoin="round"/>
    <path d="M -18 12 L -35 25 L -30 4 L -10 5 Z" fill="#e94d35" stroke="#1f2937" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="1" cy="0" r="7" fill="#39c6dc" stroke="#1f2937" stroke-width="2"/>
    <circle cx="-22" cy="0" r="5" fill="#374151" stroke="#1f2937" stroke-width="2"/>
    <path d="M -12 -9 L 13 -9" stroke="#ffffff" stroke-width="2" opacity=".7" stroke-linecap="round"/>
  </g>
</svg>
`;
}

async function main() {
  const username = process.env.GH_USERNAME;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const outPath = process.argv[2] || "assets/rocket-calendar.svg";

  if (!username || !token) {
    console.error("Set GH_USERNAME and GH_TOKEN (or GITHUB_TOKEN) env vars.");
    process.exit(1);
  }

  const calendar = await fetchCalendar(username, token);
  const svg = buildSVG(calendar);

  const fs = await import("node:fs/promises");
  await fs.writeFile(outPath, svg, "utf8");
  console.log(`Wrote ${outPath} (${calendar.totalContributions} contributions, ${calendar.weeks.length} weeks)`);
}

// Only run main() when executed directly (so buildSVG can be unit-tested).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
