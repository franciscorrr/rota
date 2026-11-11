# Rota

A **serverless** web application that helps a manager balance the weekly schedules of the staff. You enter the employees, their contracted hours, absences and the weekly hours limit, and it generates a morning/afternoon schedule that can be edited by hand. Data is stored only in your browser.

> [!WARNING]
> **Disclaimer: vibe coded project.** This project has been developed extensively with AI tools, following the "vibe coding" approach.
>
> - The code may contain bugs, unhandled edge cases, or behaviour that does not match this README. The automated tests only check what they were written to check.
> - The scheduling rules are a simplified model. The app does not implement labour law or collective agreements, so a person must check every schedule before it is used for real staff and hours.
> - The code has not been formally audited.
> - The software is provided "as is", without warranty of any kind, under the [MIT license](LICENSE). Use it at your own risk.

## Quick start

```bash
npm install        # Vue and Vite (Node 26 is required: the version is in .node-version)
npm start          # development server at http://localhost:8080
```

With [fnm](https://github.com/Schniz/fnm) (or any manager that reads `.node-version`), `fnm use` activates the right version when you enter the folder.

For a static version: `npm run build` generates the `dist/` folder, which can be served from any static web server (`npm run preview` serves it locally). Browsers do not load ES modules from `file://`, so double-clicking `dist/index.html` does not work: it must be served over HTTP.

### Docker

```bash
docker build -t rota .
docker run --rm -p 8080:80 rota
```

Then open http://localhost:8080. The image is built in two stages: Node generates `dist/` and Nginx serves it as static content, with no backend.

To see a demo, click **Import JSON** and choose `examples/example-10-employees.json`; then click **Generate schedule**.

When you start from scratch there are no categories: create at least one in the settings before adding employees.

## Languages

The interface is available in **Spanish** and **English**. The **Language** selector in the settings immediately changes the page texts, buttons, labels and schedule warnings (including those produced by validation). The choice is saved with the rest of the data.

- **Importing** a schedule keeps the active language unless the file brings its own (`settings.locale`).
- **Reset all** deletes the data but keeps the chosen language.
- What the user types (employee and category names) is not translated; category names are kept exactly as typed when the language changes.
- To add a language: copy the catalog in `src/domain/i18n.js`, add its code to `LOCALES` and translate the keys (the tests warn if any key is missing).

## What you can configure

| Setting | Default |
| --- | --- |
| Interface language | Spanish (or English) |
| Week (Monday) | Next Monday |
| Weekly hours limit | 200 h |
| Minimum rest between shifts | 12 h |
| Opening days | Monday to Saturday |
| Days off per employee | 1 |
| Contract working days (to prorate absences) | 5 |
| Categories | None: create at least one before adding employees |
| Morning | 09:00–15:00, minimum staff: none until categories are created |
| Afternoon | 15:00–21:00, minimum staff: none until categories are created |

The minimum staff of each shift can be changed day by day in the **Edit** view.

Per employee: name, category, contracted hours per week, absences (holidays or sick leave, per day; the **Whole week** button marks all opening days at once and, when they are all marked, becomes **Clear all**), **blocked shifts** (zero or more, e.g. "Saturday afternoon") and, optionally, the end of their last shift of the previous week so rest between weeks is respected.

## Categories and minimum staff

Each employee has a **category** and each category has a **rank**: the higher the rank, the higher the category. The application starts **without categories**: create at least one in the settings before adding employees. You can rename, add and delete categories and change their rank in the settings section.

For each shift (morning and afternoon) you set the **minimum staff per category**: for example, 1 Manager, 2 Sales assistants and 1 Stock assistant.

- **A high rank covers a low one.** A Manager can fill a Sales assistant or Stock assistant place, but a Stock assistant never covers a Manager place.
- **Each person occupies a single place.** With a minimum of 1 Manager + 2 Sales assistants + 1 Stock assistant, the shift needs 4 people: at least 1 of rank ≥ 3, at least 3 of rank ≥ 2 and at least 4 of rank ≥ 1. A Manager does not count as both Manager and Sales assistant.
- These are **minimums**: there is a warning when someone is missing, not when there are extra people.
- The generator covers the highest-category places first, so it does not spend Managers on Stock assistant places before covering the places only they can fill.
- In **Edit** you can change the minimum of each category for a specific day and shift. In the **Sheet**, the coverage row shows which category is missing.
- If you ask for more people of a category (or higher) than exist, the "Staffing" warning appears.
- Deleting a category moves its employees to the remaining lowest-rank category and discards the minimums that mentioned it.

## Blocked shifts

To say that an employee **cannot** work a specific shift (for example, "Saturday afternoon"), add a block in their row with **+ block shift**; you can add as many as you need and remove them with the ×.

- The generator **ignores** that employee for that shift.
- Blocks **repeat every week** (they are per weekday and shift, not per date), unlike absences. If it is a one-off, use an absence.
- They do not reduce the employee's target hours (an absence does): if their blocks prevent them from reaching their contract, the "under target" warning appears.
- In **Edit** the employee appears disabled in their blocked shift. If you import a JSON with an assignment on a blocked shift, a red warning appears.
- In the **Sheet** they appear as "Blocked".

## Schedule views

The result can be seen in two ways, with the **Sheet** and **Edit** tabs:

- **Sheet** (default, editable): spreadsheet style, with one employee per row and the morning/afternoon shift of each day in columns.
  - Cells show the shift (extra shifts are marked) or "Absent".
  - At the end of each row you see contract, target, assigned hours and the difference (`OK`, `+X h` or `−X h`).
  - The last row shows the coverage of each shift against the staffing; an extra shift counts as a fraction of a place, so `3.33/3` can appear.
  - The table adapts to the screen width: cells and type shrink and times wrap onto two lines, so it fits entirely without horizontal scroll from about 960 px wide. On narrower screens (mobile) it scrolls horizontally.
  - The header and the name column stay fixed while scrolling.
  - **Edit shifts from the table itself:** click a cell (or press `Enter`/`F2` with the keyboard) to open its editor. In an empty cell you choose the start and end time (the full shift by default) and press **Add**; in a cell with a shift you can change the times and **Save**, or **Remove** the shift. If the range does not match the full shift it is marked as an extra shift. Changes are saved and revalidated immediately, just like in the Edit view.
  - You cannot add a shift for someone who is absent that day or has that shift blocked (the editor explains why); what they already have assigned can still be changed or removed. Absences and blocks are still edited in the employee table.
  - **Shift details:** click a shift header (e.g. "Morning 09:00–15:00") or its coverage cell to see, in a popup, the same data the Edit view shows for that shift: coverage, minimum staff per category (marking the ones changed for that day) and who is assigned, with extra shifts and rule violations flagged. The popup includes **Generate this shift** (see "Generating a single shift"). It closes with "Close", `Esc` or a click outside; "Edit in Edit view" takes you to that tab.
  - Select a cell with the mouse or the arrow keys (also `Home`/`End`) to see its details above the table.
  - Cells that break a rule appear in red. No state depends on colour alone: there is text ("Absent", "extra", `−X h`).
- **Edit**: add and remove employees from each shift, with custom times for extra shifts, and change the minimum staff of each day. Extra shifts are only created by hand (here or in the Sheet), never by generating. Each cell has a **Generate shift** button (see "Generating a single shift").

Changes made in **Edit** are immediately reflected in the **Sheet**, and vice versa: both views share the same state.

## How the schedule is calculated

1. **Target per employee** = contracted hours − absence hours. Each absence day subtracts `contracted hours / contract working days`.
2. **Full shifts**: the slot with the fewest possible candidates is filled first. The eligible employee with the most pending hours is chosen.
   - They are eligible if they are not absent that day and have enough hours left for the shift.
   - They must respect the minimum rest with any other shift of theirs and with the last shift of the previous week.
   - They must not exceed their maximum work days (opening days − days off).
3. **Extra shifts: by hand only.** The generator **does not** create partial extra shifts: it only assigns full shifts. Contracted hours that do not fit into full shifts remain as an "under target" warning, and the organizer decides where to add an extra shift, from the **Sheet** (clicking the cell) or from the **Edit** view: choose the employee in the shift, change the start and end time and press **Add**; if the range differs from the full shift, it is marked as an extra shift.
4. **Validation**: warnings are recalculated after generating and after every manual edit. Rule violations appear in red, and hour or coverage mismatches in amber.

### Generating a single shift

The **Generate shift** button (in each Edit view cell) and **Generate this shift** (in the popup of a shift header in the **Sheet**) run the generator only for that day and shift:

- **It touches nothing else**: every other assignment stays exactly as it is.
- **It keeps what is already in that shift** (including manual assignments and extra shifts) and **only adds what is missing** to meet the minimum staff. If the shift is already covered, it does nothing. To redo a whole shift, first remove the people from that shift and press the button again.
- It takes into account what is already assigned in the rest of the week: absences, blocks, minimum rest, days off and the hours each employee has left towards their target.
- It only adds full shifts, never extra shifts. If nobody is eligible, it says so: "still missing 1 Manager", and leaves the shift as it is.
- It does not ask for confirmation because it is additive; the status bar (or the popup itself) shows who was added.

### Warnings

| Warning | Meaning |
| --- | --- |
| Insufficient coverage | A shift does not meet its minimum staff; it shows which category is missing |
| Staffing | More people of a category (or higher) are requested than exist |
| Hours below or above target | An employee is short of or over their contract (minus absences) |
| Insufficient rest / overlapping shifts | Less than the minimum rest between two shifts, or two shifts at the same time |
| Assigned absentee, assigned blocked shift, closed day | There is a shift on an absence day, on a blocked shift or on a closing day |
| Days off | An employee works more days than allowed |
| Weekly limit | Contracted hours, or planned hours plus absences, exceed the limit |

**The weekly limit only warns.** If contracts exceed it, the app does not cut hours: it flags it and you decide. Absences count within the limit.

## Known limitations

- **A 40 h contract cannot be met with the default values.** With 6 h shifts, 12 h of rest (which prevents two shifts on the same day) and a maximum of 5 work days, the cap is 30 h per person. To reach 40 h you must lengthen shifts, reduce rest or require fewer days off.
- Days off are counted only among opening days: with Sunday closed and 1 day off, each employee actually rests 2 days. Check the minimum required by your collective agreement; the app does not assume any rule.
- The generator is greedy: it does not look for the optimal distribution and may leave someone below their target even when a better solution exists. Warnings and manual editing help correct it.
- Shifts cannot cross midnight.
- Coverage per category counts fractions: two Manager extra shifts from 09:00 to 12:00 add up to "1 Manager" even when there is nobody from 12:00 to 15:00. Review extra shifts of high categories by hand.
- Blocks are recurring: there are no single-week blocks (use absences for that).
- Changing the week clears the schedule and the day templates (absences are stored by date and are kept).

## JSON format

This is the format the application exports and imports (see `examples/example-10-employees.json`):

```jsonc
{
  "settings": {
    "weekStart": "2026-11-16",        // Monday
    "locale": "es",                   // interface language: "es" | "en"
    "weeklyCap": 230,
    "openDays": [0, 1, 2, 3, 4, 5],   // 0 = Monday ... 6 = Sunday
    "daysOffPerEmployee": 1,
    "contractDaysPerWeek": 5,
    "minRestHours": 12,
    "categories": [
      { "id": "manager",     "name": "Manager",     "rank": 3 },
      { "id": "salesperson", "name": "Salesperson", "rank": 2 },
      { "id": "stock-clerk",  "name": "Stock clerk", "rank": 1 }
    ],
    "shifts": {   // "required" = minimum staff per category
      "morning":   { "start": "09:00", "end": "15:00", "required": { "manager": 1, "salesperson": 1, "stock-clerk": 1 } },
      "afternoon": { "start": "15:00", "end": "21:00", "required": { "salesperson": 1, "stock-clerk": 1 } }
    }
  },
  "employees": [
    {
      "id": "e1", "name": "Lucía Fernández", "categoryId": "manager", "contractHours": 30,
      "absences": ["2026-11-16"],                       // ISO dates
      "blockedShifts": ["5|afternoon"],                 // "<day 0-6>|<morning|afternoon>", repeats every week
      "prevWeekLastShiftEnd": "2026-11-15T21:00"        // optional
    }
  ],
  "overrides": { "2026-11-21|morning": { "mozo": 2 } },  // minimum per day and shift (only the listed categories)
  "assignments": [
    { "id": "a1", "employeeId": "e1", "day": "2026-11-16", "shift": "morning",
      "start": "09:00", "end": "15:00", "partial": false }
  ]
}
```

When importing, missing or invalid fields are replaced by the default values, except categories: they are user data, so a file without them starts with none and asks you to create one.

## Development

```bash
npm test           # node --test (test/*.test.js: domain logic)
npm run test:e2e   # browser tests with Playwright (e2e/); E2E_BUILD=1 runs them against dist/
npm run lint       # ESLint (with eslint-plugin-vue)
npm run build      # dist/ (Vite)
npm start          # development server at :8080
npm run preview    # serves dist/ locally
```

### Continuous integration and image publishing

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main` and `v*` tags. It runs lint, unit tests, build and Playwright tests against `dist/`. On pushes to `main` and `v*` tags, if the checks pass, it builds the Docker image and publishes it to GitHub Container Registry as `ghcr.io/<owner>/<repo>`, with the tags `latest` (main), `sha-<short commit>` and, for tags such as `v1.2.0`, `1.2.0` and `1.2`.

No secrets are needed: it uses the workflow's `GITHUB_TOKEN`. The app is not deployed anywhere: publishing the image is the last step.

Structure:

```
index.html              page (mounts src/main.js)
src/main.js             entry point: mounts App.vue
src/App.vue             page structure
src/state.js            reactive state, derived warnings and statistics, persistence, open dialog
src/components/         Vue components (one per page area)
src/domain/             pure business logic, no Vue or DOM:
  time.js                 dates and times
  i18n.js                 interface texts in Spanish and English (flat keys with parameters)
  scheduler.js            generate(), generateShift() and validate()
  sheet.js                Sheet view model: buildSheet(), shiftDetail(), cellDetail()
  actions.js              actions that modify the state (assignments, employees, categories, week...)
  navigation.js           keyboard navigation across the grid
  storage.js              localStorage, normalisation and JSON import
src/styles.css          styles (light/dark/print)
test/                   domain logic tests (node --test)
e2e/                    browser tests (Playwright)
playwright.config.js    browser test configuration
examples/               importable example data
```

More details for contributors, human or agent, in [AGENTS.md](AGENTS.md).
