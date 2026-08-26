# F1 Pulse v1.7.0

F1 Pulse is an independent, responsive Formula 1 fan dashboard built for static hosting such as GitHub Pages.

## Core features

- Current and historical Formula 1 seasons (1950-current)
- Driver and constructor standings
- Driver and constructor profiles
- Race winners and podiums
- Race calendar and venue information
- Race Weekend Hub with session schedule and published classifications
- Championship trends, poles, fastest laps, podiums and recent-form analytics
- Circuit Intelligence with historical venue records and derived track metrics
- Live Race Weekend Center
- Championship Scenario / Points Calculator
- My F1 favorites dashboard with browser-local persistence

## Live Race Weekend Center (v1.5.0)

The Live Center focuses automatically on the active race weekend, or the next Grand Prix when no weekend is underway. It includes:

- Weekend session timeline with local visitor times
- Session-window / next-session status and countdown
- Latest qualifying, sprint or race classification published by Jolpica
- Race fastest-lap callout when available
- Championship and recent-race story context
- Circuit Intelligence and full Weekend Hub shortcuts
- Coordinate-based qualifying/sprint/race weather forecast from Open-Meteo when the event is inside the available forecast horizon
- Clear labeling that F1 Pulse is not an official real-time lap timing or telemetry service

## Data sources

- Formula 1 data: Jolpica F1 API (Ergast-compatible API)
- Weather: Open-Meteo Forecast API

No API keys are stored in this project.

Circuit length and race-distance values shown in Circuit Intelligence are derived estimates when sufficient fastest-lap speed/time data exists. They are not official FIA specifications.

## GitHub Pages deployment

Place these files in the root of your repository:

- `index.html`
- `app.js`
- `styles.css`
- `favicon.svg`
- `README.md`

In GitHub:

1. Open **Settings → Pages**.
2. Set **Source** to **Deploy from a branch**.
3. Select **main** and **/ (root)**.
4. Save.

The site uses versioned assets (`styles.css?v=1.7.0` and `app.js?v=1.7.0`) to reduce stale browser/GitHub Pages caching after deployment.

## Notes

F1 Pulse is an unofficial fan project and is not affiliated with Formula 1, FIA, any Formula 1 team, or any driver.


## v1.6.0 — Head-to-Head Comparisons
- Driver vs Driver and Constructor vs Constructor comparison modes.
- Season-synchronized points, wins, podiums, poles, fastest laps, average finish, best finish, and qualifying averages.
- Round-by-round Grand Prix results and points, including Sprint points where available.
- Direct links from comparison cards into existing driver and constructor profiles.


## v1.7.0 — Scenario Calculator + My F1

### Championship Scenario / Points Calculator
- Compare two drivers in a hypothetical next-race result.
- Set race finishing positions and Sprint positions when the focused weekend includes a Sprint.
- Projects championship points and top-10 order immediately.
- Shows position gains/losses and scenario points added.
- Infers scoring from the selected season's published results rather than hard-coding one era.
- Historical projections are labeled as estimates because dropped-score rules, half-points events, and other era-specific regulations can affect official championships.

### My F1 Dashboard
- Pin favorite drivers, constructors, and circuits.
- Favorites persist in browser localStorage; no login or backend is required.
- Favorites remain saved while switching seasons.
- Current-season/selected-season standings and venue context appear when the favorite is present in that season.
- Favorite cards open the existing driver, constructor, and Circuit Intelligence views.
