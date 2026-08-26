# F1 Pulse

F1 Pulse is a static Formula 1 fan dashboard designed for GitHub Pages. It uses the Jolpica F1 API for live/current-season and historical Formula 1 data.

## v1.4.0

### Historical season browser
- Select any Formula 1 season from 1950 through the current year.
- Driver standings, constructor standings, race winners, race calendar, trends, profiles and weekend classifications reload for the selected season.
- The current season remains the default.
- Historical seasons are marked as Archive data.
- Era-aware handling is included for seasons before the Constructors' Championship began in 1958 and for years where qualifying/session data is not available.

### Circuit Intelligence
- New Circuits navigation view for every venue on the selected season calendar.
- Circuit location and coordinates.
- Historical number of recorded Formula 1 Grands Prix at the circuit.
- First and most recent recorded Grand Prix.
- Latest recorded winner.
- Fastest recorded race lap available from Jolpica result data.
- Estimated circuit length derived from fastest-lap average speed and lap time.
- Estimated race distance derived from circuit length and winner lap count.
- Direct venue map and circuit reference links.

Circuit length and race-distance values are deliberately labelled as estimates. Jolpica does not currently expose official circuit length as part of the Ergast-compatible circuit metadata, so F1 Pulse derives these values from recorded race data instead of hard-coding specifications.

## Existing features
- Current driver and constructor standings
- Race winners and championship leaders
- Full race calendar and venues
- Next Grand Prix countdown and session schedule
- Race Weekend Hub with race, qualifying and sprint classifications
- Driver profiles and constructor profiles
- Championship trends and points progression
- Pole, podium, fastest-lap and recent-form leaderboards
- Automatic current-season refresh every five minutes
- Responsive dark modern-blue F1 enthusiast interface

## Files

```text
index.html
app.js
styles.css
favicon.svg
README.md
```

No build process, database, Node server or API key is required.

## GitHub Pages deployment

1. Create or open your public `f1-pulse` GitHub repository.
2. Place `index.html`, `app.js`, `styles.css`, `favicon.svg` and `README.md` in the repository root.
3. Commit the files to `main`.
4. Open **Settings > Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select `main` and `/ (root)`.
7. Save.

The site URL will normally be:

```text
https://YOUR-GITHUB-USERNAME.github.io/f1-pulse/
```

## Data source

F1 Pulse uses the Jolpica F1 API / Ergast-compatible endpoints at `https://api.jolpi.ca/ergast/f1/`.

This is an independent fan project and is not affiliated with Formula 1, FIA, any Formula 1 team or any driver.
