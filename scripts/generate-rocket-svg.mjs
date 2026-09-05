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

  const blastDuration = 2; // 2 seconds to blast across
  const cycleDuration = 7; // 7 seconds total cycle
  const restDuration = cycleDuration - blastDuration; // 5 seconds rest

  const startX = MARGIN_L - 30;
  const endX = MARGIN_L + numWeeks * (CELL + GAP) + 30;
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
      // GitHub's light empty-cell colour is nearly white; force a dark base.
      let color = cell.contributionCount === 0 ? "#161b22" : adjustColorForDarkMode(cell.color);
      return `<rect id="cell-${cell.w}-${cell.dayIdx}" x="${(cell.x - CELL / 2).toFixed(1)}" y="${(cell.y - CELL / 2).toFixed(
        1
      )}" width="${CELL}" height="${CELL}" rx="2" fill="${color}">
        <animate attributeName="opacity" values="1;0;1" dur="${blastDuration.toFixed(2)}s" begin="${(Number(blastDuration) + cycleDuration).toFixed(2)}s;${(Number(blastDuration) * 2 + cycleDuration * 2).toFixed(2)}s" repeatCount="indefinite"/>
      </rect>`;
    })
    .join("\n    ");

  const monthLabelSvg = monthLabels
    .map(
      (m) =>
        `<text x="${m.x}" y="${MARGIN_T - 10}" font-size="9" fill="#8b949e" font-family="Helvetica, Arial, sans-serif">${m.label}</text>`
    )
    .join("\n    ");

  // Large rocket
  const rocketScale = 2;

  // Smoke trail - heavy particles that fade out
  const smokeTrail = Array.from({ length: 30 }, (_, i) => {
    const delay = (i * 0.05).toFixed(2);
    const offsetX = Math.random() * 20 - 10;
    const offsetY = Math.random() * 30 - 15;
    const size = Math.random() * 6 + 4;
    return `<circle cx="${startX}" cy="${centerY + offsetY}" r="${size.toFixed(1)}" fill="#4b5563" opacity="0.5">
      <animate attributeName="cx" from="${startX}" to="${endX + offsetX}" dur="${blastDuration.toFixed(2)}s" begin="${delay}s;${(Number(delay) + cycleDuration).toFixed(2)}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.6" to="0" dur="${blastDuration.toFixed(2)}s" begin="${delay}s;${(Number(delay) + cycleDuration).toFixed(2)}s" repeatCount="indefinite"/>
      <animate attributeName="r" from="${size.toFixed(1)}" to="${(size * 2).toFixed(1)}" dur="${blastDuration.toFixed(2)}s" begin="${delay}s;${(Number(delay) + cycleDuration).toFixed(2)}s" repeatCount="indefinite"/>
    </circle>`;
  }).join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="flame" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff59d"/>
      <stop offset="45%" stop-color="#ff9800"/>
      <stop offset="100%" stop-color="#ff5722" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.5"/>
      <feColorMatrix type="saturate" values="1.5"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"/>

  <g>
    ${monthLabelSvg}
  </g>

  <g id="calendar">
    ${daySquares}
  </g>

  <g id="smokeTrail" opacity="0.7">
    ${smokeTrail}
  </g>

  <g id="rocket" filter="url(#glow)" transform="translate(${startX.toFixed(1)} ${centerY.toFixed(1)})">
    <!-- Scaled up rocket: 2x bigger -->
    <ellipse cx="${(-22 * rocketScale).toFixed(1)}" cy="0" rx="${(12 * rocketScale).toFixed(1)}" ry="${(6 * rocketScale).toFixed(1)}" fill="url(#flame)">
      <animate attributeName="rx" values="${(8 * rocketScale).toFixed(1)};${(14 * rocketScale).toFixed(1)};${(8 * rocketScale).toFixed(1)}" dur="0.15s" repeatCount="indefinite"/>
    </ellipse>
    <path d="M ${(-10 * rocketScale).toFixed(1)} ${(-6 * rocketScale).toFixed(1)} L ${(-18 * rocketScale).toFixed(1)} ${(-12 * rocketScale).toFixed(1)} L ${(-10 * rocketScale).toFixed(1)} ${(-6 * rocketScale).toFixed(1)} Z" fill="#37474f"/>
    <path d="M ${(-10 * rocketScale).toFixed(1)} ${(6 * rocketScale).toFixed(1)} L ${(-18 * rocketScale).toFixed(1)} ${(12 * rocketScale).toFixed(1)} L ${(-10 * rocketScale).toFixed(1)} ${(6 * rocketScale).toFixed(1)} Z" fill="#37474f"/>
    <path d="M ${(-10 * rocketScale).toFixed(1)} ${(-6 * rocketScale).toFixed(1)} L ${(8 * rocketScale).toFixed(1)} ${(-6 * rocketScale).toFixed(1)} Q ${(16 * rocketScale).toFixed(1)} ${(-6 * rocketScale).toFixed(1)} ${(20 * rocketScale).toFixed(1)} 0 Q ${(16 * rocketScale).toFixed(1)} ${(6 * rocketScale).toFixed(1)} ${(8 * rocketScale).toFixed(1)} ${(6 * rocketScale).toFixed(1)} L ${(-10 * rocketScale).toFixed(1)} ${(6 * rocketScale).toFixed(1)} Z" fill="#eceff1" stroke="#b0bec5" stroke-width="0.8"/>
    <path d="M ${(8 * rocketScale).toFixed(1)} ${(-6 * rocketScale).toFixed(1)} Q ${(16 * rocketScale).toFixed(1)} ${(-6 * rocketScale).toFixed(1)} ${(20 * rocketScale).toFixed(1)} 0 Q ${(16 * rocketScale).toFixed(1)} ${(6 * rocketScale).toFixed(1)} ${(8 * rocketScale).toFixed(1)} ${(6 * rocketScale).toFixed(1)} Z" fill="#ff5722"/>
    <circle cx="${(-2 * rocketScale).toFixed(1)}" cy="0" r="${(3.2 * rocketScale).toFixed(1)}" fill="#29b6f6"/>
    <animateTransform attributeName="transform" type="translate" values="${startX.toFixed(1)} ${centerY.toFixed(1)};${endX.toFixed(1)} ${centerY.toFixed(1)};${endX.toFixed(1)} ${centerY.toFixed(1)}" keyTimes="0;.286;1" dur="${cycleDuration}s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.02;.26;.30;1" dur="${cycleDuration}s" repeatCount="indefinite"/>
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
