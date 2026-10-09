# Risk review: end-to-end process

How the regional risk page gets from Gainsight to SharePoint every cycle, who does
what, and what has to be set up once. Two stages: a **pilot** run by hand to prove
the numbers, then an **automated** run so no one builds anything by hand.

```
 Gainsight ──▶ Matik ──▶ Excel dump ──▶ build step ──▶ risk-dashboard page ──▶ click an account
 (source)     (scheduled  (SharePoint    (pilot: Python;    (SharePoint            ──▶ Gainsight C360
              pull)        library)       later: Power      Site Pages)             (plan + analysis
                                          Automate)                                 stay in Gainsight)
```

## What's already proven

| Step | Status |
|---|---|
| Page runs inside a SharePoint HTML page, switches work | ✅ Tested in your tenant |
| Build step turns a Gainsight-shaped extract into the page | ✅ Tested on TESTDATA + EMEA test Data (143 accounts, totals match the source) |
| Account analysis | Stays in Gainsight; the page links to each account (no separate notes) |
| Links open from inside SharePoint's sandbox | ⏳ To test: click an account name |
| Matik produces one dump for all regions | ⬜ Needs the Matik change below |
| Build runs without a person | ⬜ Stage 2 |

## One-time setup

### 1. Matik: one dump for all regions
Change the Matik pull so it writes **one workbook, one row per account, all regions**,
into a SharePoint (or OneDrive) folder, e.g. `Risk Review/Dumps/`.

Required columns, in any order (header names must match exactly):

| Column | Notes |
|---|---|
| Sales Entity | **New** (e.g. EMEA, APJ, Partners) |
| Sales Region | **New** (e.g. Europe North, Channel, Service Provider) |
| SFDC Account Id | **New**: Salesforce link, and matching accounts between weeks |
| Company GSID (or Gainsight URL) | **New**: Gainsight link on each account |
| Account, ESP, Type, Quarter, Baseline, Risk $ | As today |
| Risk Reason, Risk Status, Risk Sub Reason, Risk | As today |
| Consumption % | As today. **One scale for every region** (0–1 or 0–100, not both) |
| SaaS Journey Phase, SW Journey Phase | As today. Phases, not utilisation numbers |
| CS Owner Name | The name, not just the Gainsight ID |

`CRS_Test_Dump.xlsx` (shared separately, not in this repo) is a worked example of this layout.

### 2. SharePoint site
- A site (or an existing one) that the right audience can open.
- **Site Pages › Library settings › allow HTML files** (done).
- A document library folder for the dumps (and, in stage 2, the page template and history).

### 3. Account links
Copy the address of any Gainsight C360 page to confirm the link format, and note your
Salesforce domain. They go into the build as `--gainsight-url` / `--salesforce-url`.

### 4. Decisions to make before go-live
- **Slide rules:** each account on one slide (the page default), or today's overlapping sheets.
- **Risk $ with no reason:** see "Findings from the test run" below.
- **Who sees what:** one page for everyone, or one page per entity if regions must not see each other.
- **Currency** shown on the page (USD or GBP).
- **Owner:** who runs the cycle and who looks after the template.

## Every cycle (two-weekly or monthly)

| When | Who | Step | Stage 1 (pilot) | Stage 2 (automated) |
|---|---|---|---|---|
| Day 1 | Matik (scheduled) | Pull Gainsight → Excel dump in the SharePoint folder | Same | Same |
| Day 1 | Build step | Read the dump, add it as this week's snapshot, rebuild the page | Owner runs two commands (~5 min) | Power Automate flow triggers when the dump lands |
| Day 1 | Build step | Publish the page | Owner uploads the HTML to Site Pages | Flow writes the page into Site Pages |
| Day 1 | Owner | Sanity check: open the page and compare the headline numbers with the dump; read **Data checks** | Same | Same (flow can email a summary) |
| Days 1–5 | Leaders | Review their region on the page, open at-risk accounts in Gainsight, make sure plans there are current, prepare their own analysis | Same | Same |
| Review call | Everyone | Walk through Overview → each slide, per region | Same | Same |

### Stage 1 commands (pilot, on the owner's laptop)
```bash
python tools/build.py add "CRS_Dump_2026-10-09.xlsx" --snapshot 2026-10-09
python tools/build.py html --gainsight-url "https://<tenant>.gainsightcloud.com/...{gsid}" \
    --salesforce-url "https://<domain>.lightning.force.com/lightning/r/Account/{accountId}/view"
# then upload risk-dashboard.html to Site Pages
```
Needs Python with `pandas` and `openpyxl`. `data/history.json` holds every past
snapshot (that's what the Week switch uses); keep a copy in the SharePoint folder.

### Stage 2: Power Automate (no laptop)
1. **Trigger:** "When a file is created" in `Risk Review/Dumps/`.
2. **Office Script** (runs inside Excel online): reads the `SourceData` table,
   applies the same clean-up as `build.py` (column mapping, consumption scale),
   and returns the rows as JSON.
3. **Get file content:** `history.json` from the library; append this snapshot; save it back.
4. **Get file content:** `template.html`; replace `__RISK_DATA__` with the history JSON.
5. **Create/replace file:** `Site Pages/risk-dashboard.html`.
6. **Send email** to the owner with headline numbers and data-check counts.

Needs Power Automate with the standard Excel Online and SharePoint connectors, and
Office Scripts enabled; your IT team needs to confirm both. Steps 2–5 replace
`build.py`; the page itself doesn't change.

## Findings from the test run (TESTDATA + EMEA test Data)

1. **Risk $ with no risk reason or risk level: 43 of 143 accounts, ~42% of all risk $.**
   Almost all are EMEA, and in 40 of them Risk $ is exactly 25% of baseline. That looks like a
   default applied when nothing has been assessed. Today they land in "Other risk"
   and make it the biggest category. **Decide:** count them, show them separately as
   "Not yet assessed", or fix at source in Gainsight.
2. **Consumption % scale differs** between the two extracts (0–1 vs 0–100). The test
   dump converted EMEA; the real dump should use one scale.
3. **The EMEA extract has utilisation numbers where the journey phases should be**,
   and no header row.
4. **6 accounts have no CS owner**; 13 have no consumption value.
5. CS owner names resolve from `CSOwnerLookup`, and 142 of 143 accounts match a
   Salesforce Account Id in `NewUtil`. So both can come straight from the Matik pull.
