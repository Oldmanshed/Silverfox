# Build spec: Area Risk Review page

A brief for an AI coding assistant (e.g. Copilot) to build the regional risk review
page from scratch. Build it in the **stages** at the end, one at a time, checking each
before moving on. Everything a builder needs is in this document.

---

## 1. What we're building

Today, Customer Success builds one PowerPoint deck per sales region every two weeks
or monthly, from a Matik pull of Gainsight data. We're replacing those decks with
**one web page for all regions**. People pick a region and a week from dropdowns.

- The page is a **single self-contained HTML file** hosted as a SharePoint "HTML page"
  (Site Pages library).
- A **Python build script** reads the Matik Excel dumps and writes that HTML file.
- Account analysis and plans stay in **Gainsight**. The page links each account to
  Gainsight; it does **not** collect notes.

```
Matik (scheduled) ──▶ Dumps/CRS_Dump_YYYY-MM-DD.xlsx ──▶ build script ──▶ Output/risk-dashboard.html ──▶ SharePoint Site Pages
                      (synced SharePoint folder)          (Python)
```

Audience: regional sales and CS leaders preparing for a risk review call. It must be
**clean, visual and quick to scan**, not a data dump.

## 2. Hard constraints (learned from testing in our tenant)

SharePoint renders uploaded HTML pages inside a **sandboxed iframe (`about:srcdoc`)**:

- ✅ Inline JavaScript runs: dropdowns, tabs, sorting and charts all work.
- ❌ The page **cannot call SharePoint APIs or read lists**. There's no site context and no referrer.
- ❌ The page's own URL is `about:srcdoc`, so **"copy link to this view" can't work**. Hide any such button when `location.href` starts with `about:`.
- ⚠️ Opening links in a new tab (`target="_blank"`) and `window.print()` may or may not be allowed. Use them, but the page must not break if they're blocked.

So:

1. **Everything inline.** No CDNs, no external scripts, fonts or stylesheets, no `fetch`.
   Charts are hand-written inline SVG. Use only the system font stack.
2. **All data is embedded** in the HTML at build time, as JSON inside
   `<script type="application/json" id="risk-data">…</script>`. Escape `</` as `<\/`.
3. Plain ES5/ES2015 JavaScript, no framework, no build tooling. One `.html` file.
4. Include a `<noscript>` message saying scripts are blocked.
5. Must work in Edge/Chrome, at phone width (390px) with no horizontal page scroll,
   and in light and dark mode (`prefers-color-scheme`).
6. **Never put real customer data in source control.** Ignore `*.xlsx`, `*.csv` and generated JSON in git.

## 3. Folder layout and how it's run

A SharePoint document library folder, synced to the operator's laptop with OneDrive:

```
Risk Review/
  Tool/     Build risk page.bat, tools/build.py, src/template.html, requirements.txt
  Dumps/    CRS_Dump_2026-09-25.xlsx, CRS_Dump_2026-10-09.xlsx, …   (one per cycle)
  Output/   risk-dashboard.html                                     (written by the build)
```

- The operator double-clicks **`Build risk page.bat`**, which runs
  `python tools\build.py html --dumps "..\Dumps" --keep 13 -o "..\Output\risk-dashboard.html" --gainsight-url "…" --salesforce-url "…"`
  then pauses so the message can be read.
- The operator uploads `Output/risk-dashboard.html` to Site Pages.
- **The Dumps folder is the history.** Each dated file is one snapshot (one "week").
  There's no other database or history file.
- Requirements: Python 3.10+, `pandas`, `openpyxl`.

## 4. Input: the Matik dump

One workbook per cycle, sheet **`SourceData`**, header row in row 1, one row per account, all regions.

| Column header | Type / values | Notes |
|---|---|---|
| Sales Entity | text, e.g. EMEA, APJ, Partners | top-level grouping |
| Sales Region | text, e.g. Europe North, Channel, Service Provider | belongs to one entity |
| SFDC Account Id | text | Salesforce link; match accounts between weeks |
| Company GSID | text | Gainsight link (or a ready-made `Gainsight URL` column) |
| Account | text | account name |
| ESP | TRUE/FALSE or Y/N | Enterprise Success Partner |
| Type | `SaaS` or `Software` | |
| Quarter | e.g. `FY27-Q3` | renewal quarter |
| Baseline | number | ARR renewing |
| Risk $ | number | revenue at risk |
| Risk Reason | text, may be blank | e.g. Product & Technical Risk, Value Realization Risk, Competitive Risk, Relationship Risk, Financial Risk, Organizational Risk, Early Renewal, Low/No Risk |
| Risk Status | In-Play / Saved / Churn / blank | |
| Risk Sub Reason | text | |
| Consumption % | number, may be blank | see cleaning rules |
| SaaS Journey Phase, SW Journey Phase | Onboard / Activate / Adopt / Expand | |
| Risk | High / Medium / Low / blank | |
| CS Owner Name | text | (`CS Owner` is a Gainsight ID; use the name) |

### Cleaning rules (all are real issues found in test data)

- **Header names:** trim whitespace; map by name, not position. If `CS Owner Name` is missing, fall back to `CS Owner`.
- **Required columns:** Account, Type, Quarter, Baseline, Risk $, Risk Reason, Consumption %, Risk. Fail with a clear message listing the missing ones and the headers found.
- **Region fallback:** if `Sales Region`/`Sales Entity` are missing, accept `--region`/`--entity` arguments; otherwise fail clearly.
- **ESP:** true when the value is true/y/yes/1 (case-insensitive).
- **Baseline, Risk $:** numbers, blank → 0.
- **Consumption % scale:** some extracts use 0–1, others 0–100. Values **above 1 are legitimate** (over-consumption, e.g. 1.67 = 167%). So decide the scale per file by the **median**: if the median is > 1.5, divide every value by 100 and record a warning. Non-numeric → blank, with a warning.
- **Blank strings** → null. Drop rows with no Account. Fail clearly if the sheet has no data rows ("was the workbook saved after Matik filled it?").
- **Dumps folder:** take `*.xlsx`/`*.xlsm` files with a `YYYY-MM-DD` date in the name. Ignore Excel lock files (`~$…`). Skip undated files with a printed message. Fail if two files share a date. Keep the newest N (default 13).

## 5. Business rules

### Risk categories (one tab per "slide")
Each account goes into **exactly one** category, the first that matches, in this order:

| # | Category | Rule |
|---|---|---|
| 1 | Consumption | Consumption % < **50%** (blank counts as 0%) |
| 2 | Technical | Risk Reason = "Product & Technical Risk" |
| 3 | Value realisation | Risk Reason = "Value Realization Risk" |
| 4 | Competitive | Risk Reason = "Competitive Risk" |
| 5 | Other risk | Risk = High or Medium, **or** Risk $ > 0 |
| 6 | Healthy | everything else |

Also provide an **"As the current workbook"** mode (under More filters) that mimics the
old spreadsheet, where accounts can appear on several slides:
Consumption = consumption < 50%; Technical / Value / Competitive = reason match only;
Other = not one of those three reasons AND Risk High/Medium; Healthy = Risk Low AND
consumption ≥ 50% AND reason not Technical/Competitive. In this mode show a notice:
"N accounts are on more than one slide and M are on none."

Settings (keep in one place in `build.py`): consumption threshold 0.5, healthy consumption 0.8, blank consumption counts as zero = true, minimum baseline for the "≥ $100K" filter = 100000, currency USD.

### Weeks
- Snapshot id = the date in the file name.
- Fiscal year starts **April**: Apr–Jun = Q1, Jul–Sep = Q2, Oct–Dec = Q3, Jan–Mar = Q4.
  FY label = calendar year + 1 for Apr–Dec (e.g. Oct 2026 → FY27-Q3).
- Week of quarter = days since the 1st of the quarter's first month ÷ 7, rounded down, + 1.
- Header label: `FY27-Q3 · Week 2`. Dropdown label: `Week 2 · 9 Oct`, with "(latest)" on the newest.

### Comparisons
"vs last week" means vs the **previous snapshot** in the folder. An account is **New** on a
slide if it wasn't in that category in the previous snapshot (match on SFDC Account Id,
falling back to account name).

## 6. Page layout

### Header
- Eyebrow: `AREA RISK REVIEW · <region or entity or All regions> · FY27-Q3 · Week 2`
- Title: "Overview" / "Europe North overview" / "<Category> risk accounts"
- Subtitle: a one-line description of the view + "As of 9 Oct 2026"

### Toolbar (only two controls visible)
- **Region**: one dropdown grouped by entity: "All regions"; then for each entity an optgroup with "All EMEA", "Europe North", "Europe East", …
- **Week**: snapshots, newest first.
- **More filters** button (shows "(n on)" when active) toggles a panel: Renewal quarter, Type, CS owner (limited to the chosen region), "Enterprise Success Partner (ESP) accounts only", "Baseline ≥ $100K only", Slide rules (one slide / as the workbook), Clear filters.
- Right side: Copy link (hidden inside the sandbox), Print.
- Keep state (view, region, week, filters) in the URL hash. Read it on load; wrap all `history`/`location` access in try/catch.

### Tabs
`Overview | Consumption n | Technical n | Value realisation n | Competitive n | Other risk n | Healthy n`
(n = accounts in that category for the current selection).

### Overview tab
1. **Four tiles**:
   - **Total revenue at risk** (dark, highlighted tile): sum of Risk $, with "x% of $Y renewing" and the change vs last week.
   - **Accounts at risk**: non-Healthy count, "of N renewing", with the change.
   - **Top 3 accounts' risk**.
   - **Top 3 share of total risk**.
2. **Revenue at risk over baseline**: one card per renewal quarter showing Risk $ (large), Risk %, Risk accounts and Baseline.
3. Two columns:
   - **Revenue at risk by risk driver**: horizontal bars per category (excluding Healthy and zero rows), label "$2.09M · 67 accts", sorted largest first. Clicking a bar opens that tab.
   - **Revenue at risk by sales entity** (when viewing all regions) or **by sales region** (when viewing an entity): horizontal bars. Clicking drills in. Hidden when a single region is selected.
4. **Top 3 accounts at risk** table: Account, Quarter, Baseline, Risk $, Risk reason, Risk, Owner. Key underneath.

### Category tab ("slide")
1. **Five tiles**: `<Category> accounts` (with the change vs last week), Baseline of accounts, Average consumption (of non-blank values), High-risk accounts, and `<Category> risk $` (dark tile, with the change).
2. Count line ("Top 15 of 23 accounts by risk $. Click an account to open it in Gainsight.") and a search box (account, owner, reason, sub-reason, region).
3. **Key** (see 7) above the table.
4. **Account table**, sortable by clicking headers, default Risk $ descending, **top 15** with a "Show all N accounts" / "Show top 15 only" toggle:
   Account | Type | Quarter | Baseline (ARR) | Risk $ | Risk sub-reason | Consumption | Risk | Owner

### Footer
Sources, build time, and a collapsed **"Data checks: n issues in this selection"**
listing counts and the first three account names for: risk $ with no risk reason;
consumption blank; no risk level; no CS owner. Plus any warnings from the build
(e.g. consumption scale converted).

## 7. Visual design

Clean and calm: white cards on an off-white page, generous spacing, one accent colour.
Every coloured symbol also carries a text label or icon, so it works without colour.

| Element | Treatment |
|---|---|
| Account name | Bold link to Gainsight (`↗`, new tab). Under it, in small grey: region (when several regions are shown) · "Salesforce ↗" link |
| ESP | Solid **purple pill** "ESP" (white text) after the name; tooltip "Enterprise Success Partner" |
| New | Small soft-indigo tag "New" |
| Type | Grey chip: "☁ SaaS" / "▣ Software" |
| Quarter | Grey chip |
| Risk $ | Bold red amount, with a thin red bar under it sized relative to the largest on the slide |
| Consumption | 64px meter + %: **red < 50%, amber 50–80%, green ≥ 80%**, with a small tick at 50%. Over 100% caps the bar but shows the real % |
| Risk | Tinted pill: ✖ High (red tint), ▲ Medium (orange tint), ● Low (green tint). Under it, a status chip: "Churn" (red tint) or "Saved" (green tint) |
| Owner | Initials circle + name |
| Key | One-line strip above each table explaining the ESP, New, risk pills, consumption colours, risk $ bar and links |
| Money | Compact with 3 significant figures in tiles and charts ($218K, $1.18M); full in tables ($596,857) |
| Deltas | "▲ +$1.6M vs Week 13". Red when worse, green when better (more risk = worse) |

Colours (define as CSS variables, with dark-mode values):
page `#f6f6f3`, card `#ffffff`, ink `#121212`, secondary ink `#55534e`, muted `#8a8780`,
gridlines `#e6e4dd`, brand/dark tile `#23215c`, soft brand `#ecebf6`, accent bars `#2a78d6`,
ESP `#7b3fe4`, status good `#0ca30c`, warning `#fab219`, serious `#ec835a`, critical `#d03b3b`.

Charts: horizontal bars ≤ 24px thick with 4px rounded ends, recessive axis line, value
label at the bar end, hover tooltip with exact values, clickable rows where noted.

## 8. Account links

Templates set at build time, with `{field}` filled from the row (URL-encoded); omit the link if a field is blank:
- Gainsight: `--gainsight-url "https://<tenant>.gainsightcloud.com/v1/ui/customersuccess360?cid={gsid}"` (**confirm the format** by copying a real C360 page address). A `Gainsight URL` column, if present, overrides it.
- Salesforce: `--salesforce-url "https://<domain>.lightning.force.com/lightning/r/Account/{accountId}/view"`

## 9. Build script (`tools/build.py`)

- `html --dumps DIR --keep 13 -o OUT [--sheet SourceData] [--gainsight-url T] [--salesforce-url T]`
  reads the folder, applies the cleaning rules, writes the HTML from `src/template.html`
  by replacing the placeholder `__RISK_DATA__` with the JSON, and creates the output folder if needed.
- `sample`: writes fictional sample data (about 8 regions, 300 accounts, 6 fortnightly
  snapshots, a realistic spread of reasons and risk levels, a few blank reasons and owners)
  so the page can be tested without real data.
- Print a line per file read, each warning, and a final "Wrote … (KB, rows, snapshots)".

JSON shape embedded in the page:
```json
{ "meta": { "title": "Area Risk Review", "currency": "USD", "generatedAt": "…", "rules": {…}, "links": {…} },
  "snapshots": [ { "id": "2026-10-09", "week": "FY27-Q3 · Week 2", "label": "Week 2 · 9 Oct", "date": "9 Oct 2026" } ],
  "rows": [ { "snapshot": "2026-10-09", "entity": "EMEA", "region": "Europe North", "accountId": "…", "gsid": "…",
              "account": "…", "esp": true, "type": "SaaS", "quarter": "FY27-Q3", "baseline": 0, "riskAmt": 0,
              "riskReason": "…", "riskStatus": "…", "riskSubReason": "…", "consumption": 0.41,
              "saasPhase": "…", "swPhase": "…", "risk": "Medium", "owner": "…" } ],
  "warnings": { "CRS_Dump_2026-10-09.xlsx": ["…"] } }
```

## 10. Build in stages

1. **Build script + sample data.** `build.py sample` and `build.py html --dumps` with all cleaning rules. Check: the totals printed match the Excel.
2. **Page shell.** Header, toolbar with Region and Week, tabs, URL-hash state, `noscript`, light and dark mode. Check: switching changes the header text.
3. **Overview.** Tiles, quarter cards, driver bars and region bars (both drill down), top 3. Check: Total revenue at risk equals the sum of Risk $ for the selection.
4. **Category tabs.** Five tiles, sortable table, top 15 / show all, search, New tags, the "as the workbook" mode and notice.
5. **Visual polish.** Pills, meters, risk bars, chips, initials, key, tooltips, phone layout, print styles.
6. **Footer.** Data checks and warnings.
7. **Packaging.** `Build risk page.bat` (with CRLF line endings), `requirements.txt`, README, `.gitignore`.

## 11. Acceptance checks

- [ ] Opens from a local file and inside a sandboxed iframe (`<iframe sandbox="allow-scripts" srcdoc=…>`) with **no console errors**. Copy link is hidden in the iframe.
- [ ] No external requests at all (check the browser Network tab).
- [ ] For the latest week, all regions: Total revenue at risk = sum of `Risk $` in the dump; renewing = sum of `Baseline`; account count = row count.
- [ ] Each region and entity total matches a pivot of the dump.
- [ ] The category counts across all six tabs add up to the account total in "one slide" mode.
- [ ] A file with consumption on a 0–100 scale gives the same percentages as one on 0–1, and the warning appears in Data checks.
- [ ] A value of 1.67 shows as 167% and is not divided by 100 when the rest of the file is 0–1.
- [ ] Lock files and undated files in Dumps are ignored, and two files with the same date stop the build with a clear message.
- [ ] The Week dropdown lists every dated dump (newest 13); "vs Week n" deltas and New tags use the previous one.
- [ ] Usable at 390px wide; readable in dark mode; printable.
- [ ] No customer data committed to source control.
