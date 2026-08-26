# F1 Pulse

A deployable, responsive Formula 1 fan dashboard showing current driver and constructor standings, championship trends, season leaders, race winners, weekend results, the current calendar, next-race countdown, podium results, and circuit/venue information.

## Live data

The app reads current-season data from the public Jolpica F1 API (the maintained successor to the Ergast API):

- Current driver standings
- Current constructor standings
- Race winners/results
- Current race schedule and circuit locations
- Full season race results, qualifying results, sprint results and fastest-lap data

The dashboard automatically refreshes every five minutes and has a manual Refresh Data button.

## Run locally

Because the browser fetches live HTTPS API data, serve the folder with a local web server rather than double-clicking `index.html`.

Python:

```bash
python -m http.server 8080
```

Then open http://localhost:8080.

## Publish to a public URL

### Easiest: Netlify Drop

1. Unzip the project.
2. Go to Netlify Drop.
3. Drag the `F1-Pulse` folder onto the deployment page.
4. Netlify will issue a public HTTPS URL you can share immediately.
5. Optionally assign a custom site name or domain in Netlify.

### GitHub Pages

Upload these files to a repository and enable Pages from the repository root. No build process is required.

### Cloudflare Pages / Vercel

Import the folder/repository as a static site. No framework or build command is required.

## Notes

This is an unofficial fan dashboard and is not affiliated with Formula 1, FIA, teams, drivers, or Formula One Licensing B.V. Avoid using official F1 logos or other protected branding when publishing publicly unless you have permission.

## Publish with GitHub Pages

1. Create a new public GitHub repository, for example `f1-pulse`.
2. Upload the contents of this folder to the repository root. `index.html` must be in the root.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch **main**, folder **/(root)**, then click **Save**.
6. GitHub Pages will publish the site at a URL similar to `https://YOUR-USERNAME.github.io/f1-pulse/`.

The application is static and requires no server-side runtime, database, secret, or API key.

## Race Weekend Hub

Each race now opens an on-demand Weekend Hub with:
- Practice, qualifying, sprint and race session schedule (when present on the official season feed)
- Localized session times in the visitor's browser timezone
- Race, qualifying and sprint classifications when available
- Circuit location and coordinates
- Direct venue map access

Detailed session classifications are fetched only when a visitor opens a race weekend, keeping the initial page load lightweight.

## Driver & Constructor Profiles

Standings are now interactive. Selecting a driver or constructor opens an on-demand profile with current-season detail.

Driver profiles include:
- Championship position and points
- Current constructor and permanent number
- Season wins and podium count
- Best and average race finish
- Best qualifying position
- Recent race form
- Nationality, date of birth and driver reference link

Constructor profiles include:
- Championship position and points
- Season wins and combined podium count
- Current driver lineup
- Recent two-car race finishes
- Average combined finishing position
- Constructor reference link

Profile race and qualifying data is fetched only when a profile is opened and cached in the browser session to keep the dashboard responsive and reduce API requests.

## v1.2.1 profile click fix

This release cache-busts `app.js` and `styles.css` from `index.html` so GitHub Pages visitors receive the current profile-enabled assets immediately. It also makes delegated driver, constructor, and race click handling mutually exclusive and explicit.



## v1.3.0 Championship Trends & Season Analytics

The Trends view adds:
- Driver and constructor championship points progression by completed round
- Race-win, pole-position, podium and fastest-lap season leaders
- Last-five-round driver points momentum
- Click-through from analytics leaders to existing driver profiles
- Native SVG charts with no external charting dependency
- Driver/constructor chart toggle
- Mobile bottom navigation so every view remains accessible on smaller screens

Championship progression is reconstructed from race and sprint points for each completed round. API result endpoints are paginated in groups of 100 and throttled between requests to respect Jolpica's published request limits.
