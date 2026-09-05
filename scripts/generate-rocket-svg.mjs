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
      // Never inherit GitHub's light-theme greys.
      const color = cell.contributionCount === 0 ? "#161b22" : cell.contributionCount === 1 ? "#0e4429" : cell.contributionCount === 2 ? "#006d32" : cell.contributionCount === 3 ? "#26a641" : "#39d353";
      const fadeAt = ((cell.w / Math.max(1, numWeeks - 1)) * blastDuration / cycleDuration).toFixed(3);
      const fadeOut = (Number(fadeAt) + 0.018).toFixed(3);
      return `<rect id="cell-${cell.w}-${cell.dayIdx}" x="${(cell.x - CELL / 2).toFixed(1)}" y="${(cell.y - CELL / 2).toFixed(
        1
      )}" width="${CELL}" height="${CELL}" rx="2" fill="${color}">
        <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;${fadeAt};${fadeOut};.985;1" dur="${cycleDuration}s" repeatCount="indefinite"/>
      </rect>`;
    })
    .join("\n    ");

  const monthLabelSvg = monthLabels
    .map(
      (m) =>
        `<text x="${m.x}" y="${MARGIN_T - 10}" font-size="9" fill="#8b949e" font-family="Helvetica, Arial, sans-serif">${m.label}</text>`
    )
    .join("\n    ");

  // A deliberate S-curve makes the rocket visibly weave through the grid.
  const wave = Math.min(31, Math.round(height * 0.26));
  const p1 = startX + (endX - startX) * 0.29;
  const p2 = startX + (endX - startX) * 0.55;
  const p3 = startX + (endX - startX) * 0.79;
  const flightPath = `M ${startX.toFixed(1)} ${centerY.toFixed(1)} C ${(startX + 64).toFixed(1)} ${(centerY - wave).toFixed(1)}, ${(p1 - 44).toFixed(1)} ${(centerY - wave).toFixed(1)}, ${p1.toFixed(1)} ${centerY.toFixed(1)} S ${(p2 - 36).toFixed(1)} ${(centerY + wave).toFixed(1)}, ${p2.toFixed(1)} ${centerY.toFixed(1)} S ${(p3 - 36).toFixed(1)} ${(centerY - wave).toFixed(1)}, ${p3.toFixed(1)} ${centerY.toFixed(1)} S ${(endX - 42).toFixed(1)} ${(centerY + wave).toFixed(1)}, ${endX.toFixed(1)} ${centerY.toFixed(1)}`;

  // Delayed particles follow the same curve, so the exhaust also weaves.
  // They fade by 3.4s, well before the rocket comes back at 7s.
  const smokeTrail = Array.from({ length: 30 }, (_, i) => {
    const delay = (i * 0.045).toFixed(3);
    const size = 3.5 + ((i * 17) % 9) / 2;
    const drift = i % 2 ? 1 : -1;
    return `<circle cx="${startX}" cy="${centerY}" r="${size.toFixed(1)}" fill="#b8c4d2">
      <animateMotion path="${flightPath}" keyPoints="0;1;1" keyTimes="0;.286;1" dur="${cycleDuration}s" begin="${delay}s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="translate" values="0 0;${(drift * (8 + i % 5)).toFixed(1)} ${(drift * (5 + i % 7)).toFixed(1)};${(drift * (12 + i % 5)).toFixed(1)} ${(drift * (9 + i % 7)).toFixed(1)}" keyTimes="0;.43;1" dur="${cycleDuration}s" begin="${delay}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;.52;.28;0;0" keyTimes="0;.08;.31;.48;1" dur="${cycleDuration}s" begin="${delay}s" repeatCount="indefinite"/>
      <animate attributeName="r" values="${size.toFixed(1)};${(size * 1.5).toFixed(1)};${(size * 2.6).toFixed(1)}" keyTimes="0;.31;1" dur="${cycleDuration}s" begin="${delay}s" repeatCount="indefinite"/>
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
    <filter id="pathGlow" x="-10%" y="-30%" width="120%" height="160%">
      <feGaussianBlur stdDeviation="1.3"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"/>

  <g>
    ${monthLabelSvg}
  </g>

  <g id="calendar">
    ${daySquares}
  </g>

  <path d="${flightPath}" fill="none" stroke="#ff7a18" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="10 10" opacity=".7" filter="url(#pathGlow)">
    <animate attributeName="stroke-dashoffset" from="0" to="-120" dur="1s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values=".12;.82;.12" keyTimes="0;.286;.48" dur="${cycleDuration}s" repeatCount="indefinite"/>
  </path>

  <g id="smokeTrail" opacity="0.7">
    ${smokeTrail}
  </g>

  <g id="rocket" filter="url(#glow)">
    <ellipse cx="-91" cy="0" rx="32" ry="12" fill="url(#flame)" opacity=".9">
      <animate attributeName="rx" values="26;41;29;36;26" dur=".18s" repeatCount="indefinite"/>
      <animate attributeName="ry" values="9;16;11;14;9" dur=".18s" repeatCount="indefinite"/>
    </ellipse>
    <image href="rocket-v2.png" x="-100" y="-55" width="200" height="110" preserveAspectRatio="xMidYMid meet"/>
    <animateMotion path="${flightPath}" rotate="auto" keyPoints="0;1;1" keyTimes="0;.286;1" dur="${cycleDuration}s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;.27;.286;.985;1" dur="${cycleDuration}s" repeatCount="indefinite"/>
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
