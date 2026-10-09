# CRS risk dashboard (concept)

A single web page that replaces the per-region risk decks with filters for region,
snapshot, renewal quarter, type, CS owner, ESP and the $100K threshold.
It's built from the same Matik pull that feeds the deck today.

```
Gainsight ──Matik──▶ CRS workbook (SourceData sheet)
                         │  tools/build.py add   (one run per region per snapshot)
                         ▼
                   data/history.json             (every snapshot kept, so the page can go back in time)
                         │  tools/build.py html
                         ▼
                   risk-dashboard.html           (one file: data, charts and code inside it)
                         │  upload
                         ▼
                   SharePoint › Site Pages › HTML page
```

`risk-dashboard.html` in this folder is built from **fictional sample data**.
It has the same columns as `SourceData`. Use it to test SharePoint before any real data goes near it.

## 1. Test it in SharePoint

1. Site owner: in **Site Pages › Library settings**, allow HTML files.
   (This is the HTML pages feature: preview Oct 2026, generally available Dec 2026.)
2. **+ New › HTML page › Upload** `risk-dashboard.html`, then publish.
3. Check these:
   - [ ] The page shows numbers rather than a yellow "Scripts are blocked" box.
   - [ ] Changing **Region** updates the tiles, charts and tables.
   - [ ] **Snapshot** goes back in time, and the trend chart point is clickable.
   - [ ] The **Risk categories** tabs switch, and **Show all** expands the table.
   - [ ] **Slide rules → As the current workbook** shows the overlap warning.
   - [ ] **Copy link** gives a URL that reopens the same view. If SharePoint blocks
     clipboard access, a pop-up shows the link to copy instead.
   - [ ] **Print / PDF** gives a usable handout.
   - [ ] Hover tooltips appear on the charts.

If scripts are blocked, the fallback is the **Embed** web part pointing at the same file in a
document library. The page has no external dependencies (no CDNs, no fonts), so it works offline too.

## 2. Use real data (on your machine, not in this repo)

```bash
pip install pandas openpyxl
python tools/build.py add "CRS_Sheet.xlsx" --region EMEA --snapshot 2026-10-09
python tools/build.py add "CRS_Sheet ANZ.xlsx" --region ANZ --snapshot 2026-10-09
python tools/build.py html          # -> risk-dashboard.html, upload this
```

- It reads the **raw `SourceData` sheet only**. The slide logic (Consumption, Technical,
  and so on) is done in the page, so none of the formula sheets need to recalculate
  before a build.
- Re-running the same region and snapshot replaces it, so mistakes are easy to fix.
- `*.xlsx` and `data/*.json` are git-ignored, so customer data can't be committed by accident.

### Data contract (SourceData headers → page)

| SourceData column | Used for |
|---|---|
| Region *(new: add to the Matik pull, or pass `--region`)* | Region switch |
| Account | Rows, and matching accounts between snapshots |
| SFDC Account Id *(recommended addition)* | Safer matching than the account name |
| ESP, Type, Quarter, CS Owner Name | Filters |
| Baseline, Risk $ | All totals |
| Risk Reason, Risk Sub Reason, Risk Status, Risk | Categories, badges, Churn callout |
| Consumption % | Consumption slide (0–1 or 0–100 both accepted) |
| SaaS / SW Journey Phase | Journey phase column |
| Actions *(optional)* | Free text shown on each slide |

## 3. What the build found in the current workbook

These are worth fixing whether or not the web page goes ahead.

1. **The slides overlap and leave gaps.** `Consumption` filters on consumption under 50% and
   ignores the reason. `ValueRealisation`, `Technical` and `Competitiv` filter on reason only.
   So an account can be on two slides, and others land on none. `Logic_Documentation`
   records this and recommends priority order, but the sheets don't implement it yet.
   The page does it both ways (see the **Slide rules** switch).
2. **Two different "consumption" columns.** The `Consumption` slide sheet reads the
   SaaS / SW Journey Phase columns (K/L) divided by 100. The MATIK rollup reads
   `Consumption %` (J). In `TESTDATA`, K/L hold phase names ("Adopt"), which `IFERROR`
   turns into 0, so every account would count as low consumption.
3. **Consumption % scale isn't consistent.** `TESTDATA` uses 0–1 and `EMEA test Data` uses
   0–100. A threshold of `< 0.5` silently fails on the 0–100 data.
4. **`MATIK!B84:D84` "Total Accts At Risk" sums the wrong rows.** It uses
   `SUM(B62,B65,B68)` (inside the Top-15 table); columns F–H use rows 73/76/79.
   `Rollup!A6/D6/G6` feeds from it.
5. **The $100K threshold is inconsistent.** It applies to Total Risk $ and Technical
   in the rollup, but not to Consumption or Other, so the rows don't add up to the total.
6. **Quarters are hard-coded** (`"FY27-"&Q`, `FY28-Q1`, `FY28-Q2`, and `'CRS Pull'!U1:U3`).
   `MATIK!C97` is already `#REF!`, and `MATIK!A14:A15` show `#VALUE!`.
7. **Ranges stop at row 600.** Bigger regions would be cut off without warning.
8. **No Region column**, so each region needs its own workbook. One pull with a Region
   column would feed every region at once.
9. **Currency:** headers say `$`, but `Logic_Documentation` shows `£`. Confirm which one
   Gainsight returns. The page reads `meta.currency`.

The page's **Data checks** panel flags the row-level problems (risk $ with no reason,
blank consumption, no risk level, no owner, duplicates) for whatever is selected.

## Files

```
risk-dashboard/
├── risk-dashboard.html     built page (sample data): upload this to test
├── src/template.html       page source; __RISK_DATA__ is replaced at build time
├── tools/build.py          add / html / sample commands
└── data/                   history.json lives here (git-ignored)
```

Rules such as the consumption threshold, blank-as-zero and the $100K cut-off are in `META["rules"]`
in `tools/build.py`. Category order and definitions are the `CATS` list in `src/template.html`.
