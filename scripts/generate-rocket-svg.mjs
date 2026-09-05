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
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
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

  // Flatten into a boustrophedon (zig-zag) flight path: down column 0,
  // up column 1, down column 2, ... so the rocket's motion is continuous.
  const cells = [];
  weeks.forEach((week, w) => {
    const days = week.contributionDays;
    const order = w % 2 === 0 ? days.map((d, i) => i) : days.map((d, i) => i).reverse();
    order.forEach((dayIdx) => {
      const day = days[dayIdx];
      if (!day) return;
      const cx = MARGIN_L + w * (CELL + GAP) + CELL / 2;
      const cy = MARGIN_T + dayIdx * (CELL + GAP) + CELL / 2;
      cells.push({ ...day, x: cx, y: cy, week: w });
    });
  });

  const totalDuration = Math.max(8, Math.min(28, cells.length * 0.045)); // seconds
  const step = totalDuration / cells.length;

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

  const daySquares = cells
    .map(
      (c) =>
        `<rect x="${(c.x - CELL / 2).toFixed(1)}" y="${(c.y - CELL / 2).toFixed(
          1
        )}" width="${CELL}" height="${CELL}" rx="2" fill="${c.color}"/>`
    )
    .join("\n    ");

  const glowSquares = cells
    .map((c, i) => {
      const begin = (i * step).toFixed(2);
      return `<rect x="${(c.x - CELL / 2).toFixed(1)}" y="${(c.y - CELL / 2).toFixed(
        1
      )}" width="${CELL}" height="${CELL}" rx="2" fill="#ffffff" opacity="0">
      <animate attributeName="opacity" values="0;0.85;0" dur="0.5s" begin="${begin}s;${(
        Number(begin) + totalDuration
      ).toFixed(2)}s" repeatCount="indefinite"/>
    </rect>`;
    })
    .join("\n    ");

  const monthLabelSvg = monthLabels
    .map(
      (m) =>
        `<text x="${m.x}" y="${MARGIN_T - 10}" font-size="9" fill="#8b949e" font-family="Helvetica, Arial, sans-serif">${m.label}</text>`
    )
    .join("\n    ");

  // Flight path: straight lines through every cell center, in flight order.
  const pathD = cells
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="flame" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff59d"/>
      <stop offset="45%" stop-color="#ff9800"/>
      <stop offset="100%" stop-color="#ff5722" stop-opacity="0"/>
    </radialGradient>
    <path id="flightPath" d="${pathD}" fill="none"/>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"/>

  <g>
    ${monthLabelSvg}
  </g>

  <g>
    ${daySquares}
  </g>

  <g>
    ${glowSquares}
  </g>

  <g id="rocket">
    <ellipse cx="-11" cy="0" rx="6" ry="3" fill="url(#flame)">
      <animate attributeName="rx" values="4;7;4" dur="0.15s" repeatCount="indefinite"/>
    </ellipse>
    <path d="M -5 -3 L -9 -6 L -5 -3 Z" fill="#37474f"/>
    <path d="M -5 3 L -9 6 L -5 3 Z" fill="#37474f"/>
    <path d="M -5 -3 L 4 -3 Q 8 -3 10 0 Q 8 3 4 3 L -5 3 Z" fill="#eceff1" stroke="#b0bec5" stroke-width="0.4"/>
    <path d="M 4 -3 Q 8 -3 10 0 Q 8 3 4 3 Z" fill="#ff5722"/>
    <circle cx="-1" cy="0" r="1.6" fill="#29b6f6"/>
    <animateMotion dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite" rotate="auto">
      <mpath href="#flightPath"/>
    </animateMotion>
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
