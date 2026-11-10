# F1 Focus

A mobile focus-timer app with a Formula 1 theme. You pick a race length in laps, a car drives around a real circuit while you focus, and you earn XP and credits to spend on your car.

Built with Expo (React Native) and TypeScript. Runs on a phone through Expo Go.

**Status:** version 1 is complete, and it has grown since: 23 circuits, a tire strategy builder with pit stops, a 3D car garage with era-accurate liveries, and distraction rules that penalize leaving the app mid-race. See [BACKLOG.md](BACKLOG.md) for what comes next.

*Unofficial fan project. It is not affiliated with or endorsed by Formula 1, the FIA or any team; team and sponsor names appear only as theme.*

## Highlights

- **Tech stack:** Expo SDK 58, React Native, TypeScript, Expo Router, `@react-three/fiber` + `three` for the 3D car, `react-native-svg` for tracks and strategy graphics, AsyncStorage for local persistence.
- **Strategy builder:** drag pit stops to set stint lengths, with strict per-compound tire windows and whole-minute stints (`src/logic/strategy.ts`).
- **3D garage:** procedurally built cars for five F1 eras, each with team liveries (`src/components/car3d`, `src/data/liveries`).
- **Tested game rules:** laps, rewards, streaks, distraction penalties and paint output are covered by `npm run check`.
- **Design system:** every color, font and spacing value comes from one tokens file, so screens never hard-code styles.

## Running the app

Requirements: Node.js, the **Expo Go** app on your phone, and a free Expo account (Expo Go asks you to sign in). The phone and computer must be on the same Wi-Fi.

```bash
npm install
npx expo start
```

Scan the QR code with your phone. Leave the server running while you work: saving a file updates the phone within a second or two. Restart with `npx expo start --clear` after installing packages or changing `app.json`.

### Running in a web browser (for presenting on a screen)

The same app runs in a desktop browser, shown as a phone-sized column in the middle of the page:

```bash
npx expo start --web
```

It opens at http://localhost:8081. Data is saved in the browser's own storage, so open **Settings > Load demo data** once to fill it with example races. Browser dialogs replace the phone's pop-up alerts (`src/ui/alert.ts`). This is meant for demos; the phone app is the real target.

Useful commands:

| Command | What it does |
|---|---|
| `npm run check` | Runs the automated rule tests (laps, rewards, streaks, car position, garage, history) |
| `npx tsc --noEmit` | Typecheck |
| `npx expo lint` | Lint |
| `npx expo install <package>` | Add a package (always use this, not `npm install`, so versions match the Expo SDK) |

Run the typecheck and lint before calling any change done (required by `AGENTS.md`).

## How it works

### The race
- You choose a track and a number of **whole laps**. Focus time is always `laps x lap time`, so laps are never fractional.
- Every track has one fixed **lap time**: the real lap record rounded to the nearest 10 seconds. Silverstone's record is 1:27.097, so one lap takes **90 s**. A 10-lap race is 15 minutes; the full 52-lap race is 78 minutes.
- Distance = completed laps x the track's lap length (Silverstone: 5.891 km).
- You can **pause** at any time. **End early** is only offered (and only allowed by the timer) while paused.
- A race shorter than **1 minute** earns nothing and is not saved.
- A race can run **past the real race distance**, up to **2 hours of racing** (`logic/raceLength.ts`); pit stop breaks come on top.

### Tires and pit stops
Pit stops are the planned breaks in a long race (`src/logic/strategy.ts`, tested in `npm run check`).
- Each stint runs on one compound. A tire has a target life and some wiggle room past it: **soft 15 min (up to 20), medium 30 (up to 40), hard 45 (up to 60)**. A stint is whole laps, rounded down, and never runs past its tire's maximum, so **a race over an hour must have a stop**. At most 3 stops.
- The **Strategy** screen (after New Race) offers the **recommended** strategy first (a break about every 45 minutes, no fewer stops than the tires need, stints as close to their tire's target as possible and as even as possible), then one stop **fewer** and one stop **more** where they work, and **Build your own** (number of stops and a compound per stint; laps are shared out in proportion to tire life). The pit stop break is **2 to 5 minutes**, remembered in `settings.v1`.
- In the race, a strip under the lap counter shows the current tire and when you box; the last lap of a stint shows a **"Box, box"** call. At the end of the stint the race clock stops and the **pit stop screen** covers the race: the tire change (each corner swaps to the new compound), then the break counting down. Leaving the app during the break is fine.
- When the break ends the **pit exit opens and the race waits for you**. More than **1 minute** late is a **slow stop** (a warning that counts toward the rewards penalty like track limits); **3 minutes** late ends the race with a **DNF**.
- Test speed (development) shortens the breaks too, but not the 1 and 3 minute pit exit limits.

### Rewards
- **1 XP and 1 credit per full minute focused.** Ending early still pays for the time you focused.
- **Levels:** level n needs `50 x (n-1)^2` total XP (level 2 at 50 XP, level 3 at 200, level 4 at 450, ...).
- **Streak:** consecutive calendar days with at least one counted race. Same day keeps it, the next day extends it, a missed day resets it to 1. The displayed streak drops to 0 once a whole day has been missed.
- These numbers are placeholders (see the backlog).

### The garage
- Spend credits on **liveries**: real team paint schemes, like skins. Each livery belongs to **one generation of car** (`src/data/eras.ts`: 1980s, 2004, 2014, 2022, 2026) and is only ever put on that generation's model. All five generations have a car, and there are **42 liveries** (placeholder prices): every team on the grid for **2022** (10 teams) and **2026** (11 teams), and the best-known ones for **2014** (7), **2004** (7) and the **1980s** (7). They use real team names, colors and sponsor names (a personal project; this would need licensing before any public release). Ferrari 2022 is the free starter.
- A livery is data (one file per generation in `src/data/liveries/`, helpers in `liveryHelpers.ts`, types in `liveryTypes.ts`): a stable id, name, era, team, price, body color, accent color, wing/floor colors, two sets of shapes (`top` and `side`, in the car's own metre measurements: polygons or SVG-style paths, filled, outlined or with a gradient) painted over the body, `decals`: logos from the logo library in `src/data/logos/` (vector shapes with recolorable slots, drawn for this project; `/dev/logos` shows them all), and `texts`: lettering in the Inter typeface (`font: 'sans'`, from the app's own font files), the bold stroke font (`car3d/strokeFont.ts`) or the old 5x7 pixel font (`car3d/font.ts`). Everything is painted on the CPU by `car3d/liveryRaster.ts` (no browser canvas, so it works through expo-gl) and turned into textures by `paint.ts`; left-side lettering and logos are mirrored so they read correctly from both sides. A livery can also paint the halo (`parts.halo`); otherwise it is bare carbon. The model is built in named parts (body, sidepods, floor, frontWing, rearWing, cockpit, halo, wheels, extras), so a livery never needs a change to the model. `/dev/car-views` shows any livery from fixed angles, several liveries side by side, or a contact sheet of a whole generation (see docs/car-realism/ and docs/livery-detail/). Add a livery by adding one entry. Never rename or reuse an id, because players' saves refer to it (retired ids go in `RENAMED_LIVERY_IDS` so owners keep something similar).
- The **Garage** tab is what you own: the big 3D car (tap a card to preview it, then Equip), the **race icon** at a decent size, a collection counter and progress bar, era filter chips with owned counts, and the liveries grouped by generation (the equipped one first).
- The **Store** tab is a **weekly drop**: six liveries picked at random from the ones you do not own yet, from any generation (`src/logic/shop.ts`). They are saved (`shop.v1`) and stay the same all week; a new set arrives every **Monday** at midnight, and the Store shows a countdown to it. A livery you buy is swapped, in its place, for another you do not own; owned liveries only appear when fewer than six are left to buy. Each offer is a glass card lit in the livery's own colors (`components/LiveryTile.tsx`), with the car, name, generation and price. Tapping a card opens the **Livery** screen (`src/app/livery.tsx`): the 3D car, the race icon and the Buy for N credits button (it shows how many more credits you need if you can't afford it yet). Buying a livery equips it.
- Garage and Store share `useGarage` (`src/ui/useGarage.ts`: profile, equip, buy, race number) `LiveryPreview` and the glass card `LiveryTile` (`src/components/`): the Store's show a price, the Garage's show which livery is equipped, with a brighter edge on the one being previewed.
- Liveries use real team names and are drawn from the best-known paint schemes (a personal project; this would need licensing before any public release).
- The race number (1 to 99) is free and shows on the rear wing.
- The car has two levels of detail (`src/components/CarIcon.tsx`): `simple` for the small car on the track and `full` for Home and the garage.

### Saved data
Everything is stored **on the phone only**, using AsyncStorage (no accounts, no server):
- `profile.v1`: total XP, credits, streak, owned liveries, and the car (livery id and race number).
- `sessions.v1`: the list of finished races.
- `shop.v1`: this week's Store offers (the Monday they belong to and six livery ids).
- `settings.v1`: the player's preferences (`src/logic/settings.ts`): driver name and code, remember last race (and the last race itself), laps or minutes, start lights on/off, km or miles, haptics on/off, pit stop break length. Read once at launch (the splash screen waits for it) into one shared copy (`src/storage/settings.ts`); screens read it with `useSettings()` and change it with `updateSettings()`, so a change shows everywhere at once. Every bad or missing field falls back to its default on its own.

Older saved profiles are upgraded automatically when fields change (`src/logic/profileMigration.ts`); for example, saves from the paint-color days keep their XP, credits and streak and get the default livery. **Settings > Reset all data** wipes all of them.

## Screens

| Screen | File | Purpose |
|---|---|---|
| Home | `src/app/index.tsx` | Level and XP bar, credits, your car in 3D, stats, Start Race |
| New Race | `src/app/create-session.tsx` | Swipe between three **circuit cards** (inspired by the F1 circuit graphics: the flag beside the circuit name in large bold with the country below, the track outline, and bordered stat blocks for circuit length, race laps, race distance and lap time), then set the race length with a slider (round handle) that toggles between **laps** and **minutes** (minutes snap to whole laps). The slider goes up to 2 hours of racing, with a tick at the real race distance and an "Extended race" label past it. **Choose strategy** goes on to the Strategy screen. In development builds it also has a **Test speed** row (10x/30x/60x) so races finish quickly |
| Strategy | `src/app/strategy.tsx` | Tire strategy and pit stops, drawn like a broadcast strategy graphic (`components/TireStrategyBar.tsx`, `components/TireIcon.tsx`): the recommended strategy first, alternatives, Build your own, the pit stop length and the totals (racing, stops, time in the pits, finish time) |
| Race | `src/app/session.tsx` | Live race: track with the moving car, lap counter, the current tire and when to box, time remaining, pause/resume/end. The pit stop screen (`components/PitStop.tsx`) covers it during a stop. Saves the race when it ends |
| Summary | `src/app/summary.tsx` | Laps, time, distance, XP and credits earned, the strategy and each pit stop, level progress, streak |
| History | `src/app/history.tsx` | Current and longest streak, last-7-days chart, list of past races |
| Garage | `src/app/garage.tsx` | Your liveries: 3D preview, race icon, collection progress, era filters, equip, change race number |
| Store | `src/app/store.tsx` | This week's six liveries, your credits and the time until the next drop |
| Livery | `src/app/livery.tsx` | One livery in full (3D car, race icon) with its Buy or Equip button |
| How races work | `src/app/how-races-work.tsx` | The rules in plain words: laps and lap times, pausing, leaving the app (track limits, yellow flag, crash, the rewards penalty), rewards, levels and streaks. Every number comes from the rule constants, so it stays right when a rule changes |
| Settings | `src/app/settings.tsx` | **Driver**: name, three-letter code (taken from the name if left empty, shown on Home and the race summary) and race number. **Race**: remember last race, laps or minutes, start lights, km or miles. **Feedback**: haptics (`expo-haptics`, `src/ui/haptics.ts`: each start light, lights out, every lap, warnings, crash, finish; off on the web). Links to How races work and Compare generations, and Reset all data. In development builds also **Load demo data**: replaces everything with a week of example races (191 XP, 141 credits, a 5-day streak, the Cobalt livery owned) so the app looks lived-in for demos; one 15-minute race then triggers a level-up |

Navigation uses **Expo Router** (file-based): every file in `src/app/` is a screen, and `_layout.tsx` defines the navigation stack.

## Code layout

```
src/
  app/          Screens (Expo Router)
  components/   CarIcon.tsx (the car drawing), TrackView.tsx (track + moving car), Slider.tsx (race-length slider)
  data/         tracks/ (track definitions and shapes), cosmetics.ts (paint colors)
  hooks/        useSessionTimer.ts (the race clock)
  logic/        Pure functions: no screens, no storage, easy to test
  models/       types.ts (Track, Session, PlayerProfile, CarSettings)
  storage/      Reading and writing saved data
  theme.ts      Colors and spacing
scripts/        check-rules.ts (automated tests) and helpers
tools/          trace_track.py (turns an F1 track graphic into a track shape file)
```

Design rule: **rules live in `src/logic/`** as plain functions, and screens only display them. That is why the rules can be tested without a phone.

### Key modules
- `logic/rewards.ts`: laps/time/distance conversions, XP and credits, levels, building a saved session record.
- `logic/lapProgress.ts`: turns "planned laps + elapsed seconds" into current lap, completed laps and how far through the lap (0 to 1).
- `logic/trackPosition.ts`: turns a lap fraction into the car's position and heading on the track, using a smooth curve through the traced points so turning is not jerky.
- `logic/raceLength.ts`: converts between laps and minutes for the race-length slider (always whole laps, at most 2 hours of racing).
- `logic/strategy.ts`: tire life, splitting laps into stints, the recommended strategies, and the pit exit limits.
- `logic/streak.ts`, `logic/history.ts`, `logic/stats.ts`, `logic/garage.ts`, `logic/sessionOptions.ts`: streaks, the weekly chart, lifetime totals, buying and equipping, formatting.
- `hooks/useSessionTimer.ts`: the race clock (idle, running, paused, finished, ended). Elapsed time comes from the real clock, not counted ticks, so it stays correct if the app is throttled. Updates once per screen frame for smooth motion.
- `storage/`: `storage.ts` wraps AsyncStorage and falls back to defaults if data is missing or corrupt; `profile.ts` and `sessions.ts` hold the profile and race list; `sessions.ts > recordSession` saves a race and adds its rewards to the profile.

## Design system

- **Look:** a dark "timing screen": Inter for text and JetBrains Mono for every number, one red accent (primary button, active tab, progress, the equipped livery), 4 px corners, hairline dividers, corner-tick frames (`BracketFrame`) instead of boxes, and a soft glow in the car's color behind the car screens (`AmbientGlow`). Text contrast meets WCAG AA and every touch target is at least 44 px; `npm run check` tests this.
- **Colors and shape:** a fixed F1 red accent, **sharp corners** (nearly square), hairline borders, comfortable spacing, small uppercase section labels, and a **bottom tab bar** (Home, Garage, Store, History, Settings). Home is the "hub" layout: your car in the middle, stats underneath, one big Start Race button.
- **Design values** live in `src/design/tokens.ts` (colors, fonts, text styles, spacing, radius, sizes, glass). Styles are built from them with `makeStyles` (`src/design/styles.ts`); screens never write colors, font sizes or spacing numbers themselves. The shared components (Button, StartButton, Panel, BracketFrame, Glass, StatBlock, SegmentedProgress, SegmentedControl, ListRow, Chip, CreditAmount, AmbientGlow) are in `src/components/ui`, the tab bar is `src/ui/TabBar.tsx`, and every alert is drawn by the app's own dialog (`src/ui/AlertHost.tsx`, called through `showAlert`). In development, Settings > Development only > Design system shows them all. To change the look app-wide, change a value in `tokens.ts`.
- **Credits** are shown with an outlined octagonal coin icon (`src/components/CreditIcon.tsx`, used through `CreditAmount`). The icon is a placeholder, easy to swap.
- The app went through a development-only "design lab" to choose between corner styles, spacings, Home layouts and navigation styles. The choices (sharp, comfortable, hub, tab bar) are now the only look, and the lab and the unused variants were removed. They are in git history (commit a6e6b9d) if you want to look again.

## 3D car

- Home and the garage show the player's car as a **smooth, stylized 3D model you can spin and tilt** (drag it; it also turns slowly by itself and stops drawing while its screen is not in front). It is built entirely in code with **three.js** and **react-three-fiber** (`src/components/car3d/`), so there is no model file and a livery recolors it directly.
- **Fallback:** `src/components/HeroCar.tsx` loads the 3D view the first time it is needed and shows the flat 2D car instead if 3D cannot start on a device, so a 3D problem cannot break the app. The 3D code is never loaded at app start.
- `buildCar.ts` builds the car for a livery's generation from that generation's **measurements** (`src/data/cars/gen2022.ts`, `gen2026.ts`, shared types in `spec.ts`) using one generic builder, `modernCar.ts`: one lofted surface for the nose, cockpit, airbox and engine cover, sidepods in a team design (`downwash`, `scoop`, `slim` in 2022; `compact` in 2026, chosen by the livery's `sidepod`), a flat floor with an edge wing, fences and a diffuser, a swept front wing, a rear wing, a low halo, a raised cockpit rim, cooling slats, mirrors, wheels with covers and flattened suspension arms. Dark parts get a carbon-weave texture. The 2D race icon (`CarIcon.tsx`) is drawn from the same measurements. The 1980s, 2004 and 2014 cars do **not** share that body: `classicBody.ts` builds each one its own way (1980s: a boxy flat-sided slab with the driver's helmet showing, a thin tall roll-hoop blade, box radiator pods with upright inlets; 2004: a slim cigar with a high nose, a tall wedge periscope airbox and pillow sidepods with scoops; 2014: a wide car with a low finger nose, big pod mouths over an undercut, small turning vanes and floor fences, no halo), while the wings, wheels and extras still come from the spec. A generation is a new data file (plus any new features the builder needs): `gen1980s.ts` (turbo era: gold dished wheels, nose-mounted wing, roll-hoop airbox, twin exhausts, huge rear wing), `gen2004.ts` (V10 era: grooved tires on spoked wheels, high nose, periscope airbox, turning vanes, no halo), `gen2014.ts` (the 2014 Mercedes W05: a 1.65 m front wing, a narrow rear wing with no beam wing, spoked 13-inch wheels, no halo). Cars before 2018 have no halo; parts only some generations have (shark fin, bargeboards, T-wing, exhaust pipes) are listed in a spec's `extras`.
- **2026 vs 2022** (see `gen2026.ts`): wheelbase 3400 mm vs 3600, width 1900 vs 2000, front wing 240 mm narrower (about as wide as the front tires, with swept-back, upturned tips) with two elements (the flap is an active one built in sections), tires 25 mm (front) and 30 mm (rear) narrower on the same 18-inch wheels, slimmer sidepods with a small inlet and less undercut, a narrower plainer floor, a raised nose on pylons, a rear wing with no separate DRS flap and no beam wing, on one centre pylon. The 2026 wings have two settings: cornering (default, high downforce) and straight ("X-mode", flaps flattened); `buildCar(livery, { aero: 'straight' })`.
- **Compare screen** (Settings > Compare cars, pick any two generations; `src/app/compare.tsx`): both cars in team-neutral paint at the same scale, camera and light, from 3/4 front, side, top and rear, with a table of the numbers (differences shown). `scripts/check-rules.ts` checks the 2026 measurements against the 2026 rules.
`paint.ts` turns a livery's top and side shapes into two small pictures and colors the body by position on the car (top picture for upward-facing surfaces, side picture for the rest). `studio.ts` makes fake studio surroundings for paint reflections plus the floor glow and shadow; the **glow and rim lights take the livery's color** (`glow.ts`; very dark paint uses its accent). `Car3DView.tsx` is the view (drag to orbit; the camera backs off to fit the space it is given). `canvas.ts` / `canvas.native.ts` pick the web or the phone (expo-gl) canvas.
- **The garage and the livery screen show the flat race icon** at a decent size on a plain dark panel (no road strip).
- **Phones need one build setting.** `three` 0.18x ships a CommonJS file that calls the Node-only `process.emitWarning`, which crashes on a phone ("undefined is not a function"). `metro.config.js` points every `three` import at `build/three.module.js`. If `three` is upgraded and 3D breaks on a phone, check that first. After changing `metro.config.js`, restart Expo with `npx expo start --clear`.
- Packages: `three`, `@react-three/fiber`, `expo-gl`, `@types/three`. The 3D folder has its own lint settings because three.js objects are meant to be changed in place.

## Tracks

Three circuits: **Silverstone**, **Monaco** and **Spa-Francorchamps**. Each track (`src/data/tracks/`) has its real lap count and length, the app lap time, and a **traced shape**.

| Track | Race laps | Lap length | Lap record used | App lap time | Full race |
|---|---|---|---|---|---|
| Silverstone | 52 | 5.891 km | 1:27.097 | 90 s | 78 min |
| Monaco | 78 | 3.337 km | 1:12.909 | 70 s | 91 min |
| Spa-Francorchamps | 44 | 7.004 km | 1:44.701 | 100 s | 73 min |

- Each track also has a `countryCode` (which flag to show; flags are drawn in code in `src/components/Flag.tsx`, because Windows does not render flag emoji) and the official `raceDistanceKm`, shown on the New Race card. Facts and the circuit graphic come from each race's page on formula1.com. The app lap time is the lap record rounded to the nearest 10 s.
- Each `<track>Shape.ts` holds an SVG path, 360 points spaced evenly by distance along one lap (point `i` is `i/360` of a lap, starting at the start/finish line and running in race direction), the start/finish line, the drawing box (1000 wide) and the road width.
- Shapes are generated by **`tools/trace_track.py`** from the track image in `reference/` (the downloaded F1 graphics, **not in git** because they are F1's copyrighted artwork). The same pipeline is used for every track: extract a mask, skeletonize to a centerline, chain the pieces into a loop, fit a smooth curve, resample to 360 points. Silverstone traces the road outline; Monaco, Spa and most of the calendar trace the thin colored center line (picked by hue), because the road outlines fuse together or the sector colors are easier to follow; Bahrain's graphic has only a black road, so its road is traced. Where a label or the chequered flag hides the line, the gap is bridged straight on; Suzuka crosses itself on a bridge, so it is split at the crossing and the order of its pieces is listed by hand. See the docstring at the top of the script. Needs `pip install -r tools/requirements.txt`.
- Road width is per track (26 units, 14 on Monaco where two strands run only about 25 units apart). The car and start line are scaled to match.
- Adding a track: download its detailed graphic to `reference/<id>.webp`, add an entry to `CONFIGS` in the tracing tool (start/finish pixel, a point just after the line to set the direction, road width), run `python tools/trace_track.py <id>`, check the overlay with `--debug-dir`, then add a track file and register it in `src/data/tracks/index.ts` and the `TrackId` type.

## Testing

`npm run check` runs `scripts/check-rules.ts`, which covers lap and time math, rewards, levels, streak edge cases (month and year boundaries, gaps), lap progress, car position and heading smoothness, the garage, lifetime stats, and the weekly history. Screens are checked by hand on the phone.

## Decisions and history

- **One race pace for v1:** a fixed lap time per track (record rounded to 10 s).
- **Focus time is a whole number of laps**, chosen by you, rather than a time split into fractional laps.
- **Rewards follow focus time, not laps**, so ending early is still paid for the time focused.
- **Everything local:** friends, leaderboards and shared sessions need a backend and are future work.
- Build order followed: project setup, data model, timer and lap logic, track and car animation, create-session screen, live race screen, summary, real Home, garage, history. Each step is one git commit (`git log --oneline`).

## Known issues and next steps

See [BACKLOG.md](BACKLOG.md): XP and credit balance, car design, and the longer-term multiplayer and distraction-blocking ideas.

Expo projects change quickly between releases, so `AGENTS.md` tells coding assistants to check the current Expo docs for the installed SDK before using any Expo API.

## More design and gameplay notes

- Home: level, credits and a thin XP bar under them; the 3D car over a soft glow in the car's color; a corner-ticked strip of streak, races and distance; and a Start Race button with a thin red outer outline.
- The bottom bar is a flat glass strip with text labels only: the active tab is red with a thin line above it, and Home sits on a red trapezoid (wider at the bottom) with a thin red line along each slanted side, echoing the Start Race button.
- The look is a "timing screen": see `src/design/tokens.ts` for every color, font (Inter and JetBrains Mono), size and corner radius, and `src/components/ui` for the shared components. In development, Settings > Development only > Design system shows them all.
- **Distractions during a race:** time spent out of the app never counts as focus. Away 5 s or more earns a track limits warning, 30 s or more a yellow flag, and 3 minutes or more a crash that ends the race with a DNF (the focus done before leaving still earns XP). Two or more warnings (track limits warnings and yellow flags together) cut the XP and credits earned by 10%, and by 10% more for each further one, up to 50%. Pausing first excuses a break of up to 5 minutes, after which the race restarts by itself. The rules and their numbers are in `src/logic/distraction.ts`, they are applied by `src/hooks/useSessionTimer.ts` when the app comes back to the front, and `npm run check` tests them. The app can only see that you left it, not which app you opened, and locking the phone counts as leaving. Turning on Do Not Disturb and blocking other apps are not built yet (they need native code).
- **Tracks:** 23 circuits of the 2026 calendar (Jeddah is left out for now because its outline did not look good). Silverstone, Spa-Francorchamps and Monaco are free; the other 20 open when you reach a player level, one after another in race order, two tracks to a level: Albert Park and Shanghai at level 2 up to Yas Marina at level 12 (level 2 is 50 XP, level 5 is 800 XP, level 10 is 4050 XP, level 12 is 6050 XP). The levels are in `UNLOCK_LEVEL` in `src/data/tracks/calendar.ts`. A locked track shows the level it needs on the New Race screen and its Start button is disabled. Their outlines are traced from the official F1 circuit graphics the same way as the first three, with `tools/trace_track.py`, into `src/data/tracks/<name>Shape.ts` (the road drawn only as wide as fits, narrower where strands run close). Lap lengths and race laps are the published 2026 figures, and lap times are each circuit's lap record rounded to 10 s (Madring is new, so its time is an estimate). The flags are drawn in code and simplified.
