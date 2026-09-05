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

/**
 * Builds the SVG string from a contributionCalendar object
 * ({ totalContributions, weeks: [{ contributionDays: [...] }] }).
 */
export function buildSVG(calendar) {
  const { weeks } = calendar;
  const numWeeks = weeks.length;

  const width = MARGIN_L + numWeeks * (CELL + GAP) - GAP + MARGIN_R;
  const height = MARGIN_T + 7 * (CELL + GAP) - GAP + MARGIN_B;

  // Blast straight across the calendar horizontally, then loop back
  const startX = MARGIN_L - 20;
  const endX = MARGIN_L + numWeeks * (CELL + GAP) + 20;
  const centerY = MARGIN_T + 3 * (CELL + GAP); // middle of the calendar

  const blastDuration = 2; // 2 seconds to blast across
  const loopCycle = 7; // 7 seconds total loop

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

  const daySquares = weeks
    .flatMap((week, w) => {
      const days = week.contributionDays;
      return days.map((day, dayIdx) => {
        const cx = MARGIN_L + w * (CELL + GAP) + CELL / 2;
        const cy = MARGIN_T + dayIdx * (CELL + GAP) + CELL / 2;
        return `<rect x="${(cx - CELL / 2).toFixed(1)}" y="${(cy - CELL / 2).toFixed(
          1
        )}" width="${CELL}" height="${CELL}" rx="2" fill="${day.color}"/>`;
      });
    })
    .join("\n    ");

  const monthLabelSvg = monthLabels
    .map(
      (m) =>
        `<text x="${m.x}" y="${MARGIN_T - 10}" font-size="9" fill="#8b949e" font-family="Helvetica, Arial, sans-serif">${m.label}</text>`
    )
    .join("\n    ");

  // Smoke particles: scattered during blast across
  const smokeParticles = Array.from({ length: 20 }, (_, i) => {
    const startDelay = (i * 0.08).toFixed(2);
    const randomOffset = Math.random() * 40 - 20;
    const randomY = Math.random() * 20 - 10;
    return `<circle cx="${startX}" cy="${centerY + randomY}" r="${(Math.random() * 3 + 2).toFixed(1)}" fill="url(#smoke)" opacity="0.6">
      <animate attributeName="cx" from="${startX}" to="${endX + randomOffset}" dur="${blastDuration.toFixed(2)}s" begin="${startDelay}s;${(Number(startDelay) + loopCycle).toFixed(2)}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.7" to="0" dur="${blastDuration.toFixed(2)}s" begin="${startDelay}s;${(Number(startDelay) + loopCycle).toFixed(2)}s" repeatCount="indefinite"/>
      <animate attributeName="r" from="${(Math.random() * 3 + 2).toFixed(1)}" to="${(Math.random() * 5 + 6).toFixed(1)}" dur="${blastDuration.toFixed(2)}s" begin="${startDelay}s;${(Number(startDelay) + loopCycle).toFixed(2)}s" repeatCount="indefinite"/>
    </circle>`;
  }).join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="smoke" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#9ca3af" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#6b7280" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="flame" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff59d"/>
      <stop offset="45%" stop-color="#ff9800"/>
      <stop offset="100%" stop-color="#ff5722" stop-opacity="0"/>
    </radialGradient>
    <filter id="smokeGlow">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.5"/>
    </filter>
    <style>
      @media (prefers-color-scheme: dark) {
        #smokeLayer { filter: opacity(0.7); }
      }
      @media (prefers-color-scheme: light) {
        #smokeLayer { filter: opacity(0.5); }
      }
    </style>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"/>

  <g>
    ${monthLabelSvg}
  </g>

  <g>
    ${daySquares}
  </g>

  <g id="smokeLayer" filter="url(#smokeGlow)">
    ${smokeParticles}
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
    <animate attributeName="cx" from="${startX}" to="${endX}" dur="${blastDuration.toFixed(2)}s" begin="0s;${loopCycle.toFixed(2)}s" repeatCount="indefinite"/>
    <animate attributeName="cy" from="${centerY}" to="${centerY}" dur="${blastDuration.toFixed(2)}s" begin="0s;${loopCycle.toFixed(2)}s" repeatCount="indefinite"/>
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
