#!/usr/bin/env python3
"""Build the CRS risk dashboard: Matik workbook -> JSON history -> one HTML file.

  # 1. Add a snapshot from the Matik dump (reads the raw SourceData sheet, which
  #    should carry Sales Entity and Sales Region columns for every row)
  python tools/build.py add CRS_Dump.xlsx --snapshot 2026-10-09

  #    Older single-region workbooks without those columns:
  python tools/build.py add CRS_Sheet.xlsx --region "Europe North" --entity EMEA

  # 2. Rebuild the page from everything collected so far
  python tools/build.py html

  # Sample data (fictional) for testing the page
  python tools/build.py sample && python tools/build.py html --data data/sample-data.json

Snapshots accumulate in data/history.json (re-adding a snapshot replaces it), which
is what powers the Snapshot switch on the page. The page applies all the slide
logic itself, so the formula sheets in the workbook (CRS Pull, MATIK, Rollup,
Consumption, ...) are not read.
"""
import argparse
import json
import math
import random
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "src" / "template.html"
HISTORY = ROOT / "data" / "history.json"
SAMPLE = ROOT / "data" / "sample-data.json"
OUT = ROOT / "risk-dashboard.html"
PLACEHOLDER = "__RISK_DATA__"

# SourceData header -> JSON key. This is the contract between Matik and the page.
# Sales Entity / Sales Region are new columns in the Matik dump; --entity/--region
# fill them in for older single-region workbooks.
COLUMNS = {
    "Sales Entity": "entity",
    "Sales Region": "region",
    "Account": "account",
    "SFDC Account Id": "accountId",
    "Company GSID": "gsid",
    "Gainsight URL": "gainsightUrl",
    "ESP": "esp",
    "Type": "type",
    "Quarter": "quarter",
    "Baseline": "baseline",
    "Risk $": "riskAmt",
    "Risk Reason": "riskReason",
    "Risk Status": "riskStatus",
    "Risk Sub Reason": "riskSubReason",
    "Consumption %": "consumption",
    "SaaS Journey Phase": "saasPhase",
    "SW Journey Phase": "swPhase",
    "Risk": "risk",
    "CS Owner Name": "owner",
    "Actions": "actions",
}
REQUIRED = ["Account", "Type", "Quarter", "Baseline", "Risk $", "Risk Reason", "Consumption %", "Risk"]

META = {
    "title": "Area Risk Review",
    "currency": "USD",
    "sources": ["Gainsight", "Salesforce", "Matik"],
    # Account links. {field} is filled from each row (gsid = Gainsight Company GSID,
    # accountId = SFDC Account Id). Set with html --gainsight-url / --salesforce-url.
    # A "Gainsight URL" column in the dump overrides the template per row.
    "links": {},
    "rules": {
        "consumptionThreshold": 0.5,
        "blankConsumptionIsZero": True,
        "minBaselineForRollup": 100000,
    },
}


# ---------------------------------------------------------------- excel -> rows
def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def read_source_data(path: Path, sheet: str, region: str | None, entity: str | None):
    import pandas as pd  # only needed for real workbooks

    df = pd.read_excel(path, sheet_name=sheet)
    df.columns = [str(c).strip() for c in df.columns]
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise SystemExit(f"{sheet}: missing columns {missing}. Found: {list(df.columns)}")
    if "CS Owner Name" not in df.columns and "CS Owner" in df.columns:
        df["CS Owner Name"] = df["CS Owner"]
    if "Sales Region" not in df.columns and "Region" in df.columns:
        df["Sales Region"] = df["Region"]
    for col, value, flag in (("Sales Region", region, "--region"), ("Sales Entity", entity, "--entity")):
        if col not in df.columns:
            if not value and col == "Sales Region":
                raise SystemExit(f"No '{col}' column in the sheet: add it to the Matik pull, or pass {flag}")
            df[col] = value
        elif value:
            df[col] = df[col].fillna(value)

    warnings, rows = [], []
    df = df.dropna(subset=["Account"])
    if df.empty:
        raise SystemExit(f"{sheet} has no data rows. Was the workbook saved after Matik filled it?")
    for rec in df.to_dict("records"):
        row = {key: clean(rec.get(col)) for col, key in COLUMNS.items() if col in df.columns}
        row["esp"] = str(row.get("esp")).strip().lower() in ("true", "y", "yes", "1")
        for k in ("baseline", "riskAmt"):
            row[k] = float(row.get(k) or 0)
        rows.append(row)

    # Consumption % arrives as 0-1 in some regions and 0-100 in others. Values over
    # 1 are legitimate (over-consumption, e.g. 1.67), so judge the scale by the median.
    vals = sorted(r["consumption"] for r in rows if isinstance(r.get("consumption"), (int, float)))
    if vals and vals[len(vals) // 2] > 1.5:
        for r in rows:
            if isinstance(r.get("consumption"), (int, float)):
                r["consumption"] = r["consumption"] / 100
        warnings.append("Consumption % looked like 0–100 rather than 0–1, so it was divided by 100.")
    for r in rows:
        if r.get("consumption") is not None and not isinstance(r["consumption"], (int, float)):
            warnings.append(f"Non-numeric Consumption % for {r['account']!r}: {r['consumption']!r}")
            r["consumption"] = None
    return rows, warnings


def day_label(d):
    return f"{d.day} {d.strftime('%b %Y')}"  # %-d is not portable to Windows


def snapshot_entry(d: date):
    """Snapshot id plus the fiscal week label used in the deck header ("FY27-Q3 · Week 2")."""
    fy, q = fy_quarter(d)
    q_start = date(d.year, {1: 1, 2: 4, 3: 7, 4: 10}[(d.month - 1) // 3 + 1], 1)
    week = (d - q_start).days // 7 + 1
    return {"id": d.isoformat(), "week": f"{quarter_label(fy, q)} · Week {week}", "label": f"Week {week} · {d.day} {d.strftime('%b')}", "date": day_label(d)}


# ---------------------------------------------------------------- history store
def load(path: Path):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"meta": {}, "snapshots": [], "rows": []}


def save(data, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


def add_snapshot(args):
    rows, warnings = read_source_data(args.workbook, args.sheet, args.region, args.entity)
    snap = args.snapshot or date.today().isoformat()
    data = load(args.data)
    regions = {r["region"] for r in rows}
    # Re-running the same snapshot for a region replaces it.
    data["rows"] = [r for r in data["rows"] if not (r["snapshot"] == snap and r["region"] in regions)]
    for r in rows:
        r["snapshot"] = snap
    data["rows"].extend(rows)
    if not any(s["id"] == snap for s in data["snapshots"]):
        data["snapshots"].append(snapshot_entry(date.fromisoformat(snap)))
    data["snapshots"].sort(key=lambda s: s["id"])
    data.setdefault("warnings", {})[f"{snap} {', '.join(sorted(regions))}"] = warnings
    save(data, args.data)
    print(f"Added {len(rows)} rows for {', '.join(sorted(regions))} @ {snap} -> {args.data}")
    for w in warnings:
        print(f"  ! {w}")


def build_html(args):
    data = load(args.data)
    if not data["rows"]:
        raise SystemExit(f"{args.data} has no rows yet: run 'add' first (or 'sample')")
    # Settings come from META in this file; a data file only adds extras (e.g. the sample's note and links).
    data["meta"] = {**META, **data.get("meta", {}), "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}
    links = dict(data["meta"].get("links") or {})
    if args.gainsight_url:
        links["gainsight"] = args.gainsight_url
    if args.salesforce_url:
        links["salesforce"] = args.salesforce_url
    data["meta"]["links"] = links
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8")
    if PLACEHOLDER not in html:
        raise SystemExit(f"{TEMPLATE}: placeholder {PLACEHOLDER} not found")
    args.out.write_text(html.replace(PLACEHOLDER, payload), encoding="utf-8")
    print(f"Wrote {args.out} ({args.out.stat().st_size / 1024:.0f} KB, {len(data['rows'])} rows, {len(data['snapshots'])} snapshots)")


# ---------------------------------------------------------------- sample data
REGION_OWNERS = {  # sales region -> (sales entity, CS owners); all fictional
    "Europe North": ("EMEA", ["Sophie Laurent", "Jonas Becker", "Aoife Byrne"]),
    "Europe East": ("EMEA", ["Marco Bianchi", "Elif Kaya"]),
    "Europe South": ("EMEA", ["Lucía Ortega", "Paolo Greco"]),
    "Service Provider": ("Partners", ["Jordan Ellis", "Nadia Petrova"]),
    "Channel": ("Partners", ["Dana Brooks", "Sam Ortiz"]),
    "North America": ("Americas", ["Riley Hart", "Casey Morgan", "Alex Kim"]),
    "ANZ": ("APJ", ["Priya Raman", "Tom Whitfield", "Mia Chen"]),
    "Asia": ("APJ", ["Kenji Watanabe", "Wei Ling Tan"]),
}
REASONS = [  # (reason, weight, sub-reasons)
    ("Low/No Risk", 52, ["Low/No Risk"]),
    (None, 7, [None]),
    ("Value Realization Risk", 9, ["Low Product Adoption", "Low Engagement from Stakeholders"]),
    ("Relationship Risk", 8, ["Lack of Champion/Sponsor", "Low Engagement from Stakeholders"]),
    ("Product & Technical Risk", 7, ["Performance or Reliability Issues", "Integration Failures", "Poor Support Experience"]),
    ("Competitive Risk", 5, ["Cloud Native", "Competitor Displacement", "Others"]),
    ("Financial Risk", 4, ["Budget Issue", "Delayed Procurement Processes"]),
    ("Organizational Risk", 4, ["Mergers & Acquisitions", "Strategic Direction Shift"]),
    ("Early Renewal", 4, ["Early Renewal"]),
]
WORD_A = ["Northgate", "Bluewater", "Crestline", "Harborview", "Ironbark", "Kestrel", "Lakeshore", "Meridian",
          "Oakridge", "Pinecrest", "Redwood", "Silverline", "Stonebridge", "Thornbury", "Westfield", "Brightwater",
          "Clearpoint", "Fairhaven", "Granite", "Highland", "Ashford", "Coastal", "Evergreen", "Summit"]
WORD_B = ["Health Services", "University", "Logistics", "Insurance Group", "City Council", "Energy", "Bank",
          "Manufacturing", "Retail Group", "Telecom", "Foods", "Transport", "Media", "Pharma", "Holdings", "Water"]
PHASES_SAAS = ["Onboard", "Adopt", "Expand"]
PHASES_SW = ["Onboard", "Activate", "Adopt"]


def fy_quarter(d: date):
    q = {4: 1, 5: 1, 6: 1, 7: 2, 8: 2, 9: 2, 10: 3, 11: 3, 12: 3, 1: 4, 2: 4, 3: 4}[d.month]
    fy = d.year + 1 if d.month >= 4 else d.year
    return fy, q


def quarter_label(fy, q):
    return f"FY{fy % 100:02d}-Q{q}"


def next_quarters(d: date, n=3):
    fy, q = fy_quarter(d)
    out = []
    for _ in range(n):
        out.append(quarter_label(fy, q))
        fy, q = (fy + 1, 1) if q == 4 else (fy, q + 1)
    return out


def make_sample(seed=11):
    rnd = random.Random(seed)
    snaps = [date(2026, 7, 31) + timedelta(days=14 * i) for i in range(6)]
    all_quarters = ["FY27-Q2", "FY27-Q3", "FY27-Q4", "FY28-Q1", "FY28-Q2"]
    used, accounts = set(), []
    for region, (entity, owners) in REGION_OWNERS.items():
        for _ in range(rnd.randint(45, 75)):
            name = f"{rnd.choice(WORD_A)} {rnd.choice(WORD_B)}"
            if name in used:
                name = f"{name} ({region})"
            if name in used:
                continue
            used.add(name)
            typ = rnd.choice(["SaaS", "Software"])
            accounts.append({
                "accountId": f"001SAMPLE{len(accounts) + 1:05d}", "gsid": f"1P01SAMPLE{len(accounts) + 1:06d}", "entity": entity, "region": region, "account": name, "type": typ, "esp": rnd.random() < 0.13,
                "quarter": rnd.choice(all_quarters), "owner": rnd.choice(owners) if rnd.random() > 0.05 else None,
                "baseline": round(rnd.lognormvariate(12.4, 0.75), 2),
                "consumption": min(1.0, max(0.0, rnd.betavariate(4, 1.6))) if rnd.random() > 0.06 else None,
                "reason": rnd.choices(REASONS, weights=[r[1] for r in REASONS])[0],
                "saasPhase": rnd.choice(PHASES_SAAS) if typ == "SaaS" else None,
                "swPhase": rnd.choice(PHASES_SW),
                "status": "In-Play",
            })

    rows = []
    for s in snaps:
        window = set(next_quarters(s))
        for a in accounts:
            # drift between snapshots
            if a["consumption"] is not None:
                a["consumption"] = min(1.0, max(0.0, a["consumption"] + rnd.gauss(-0.005, 0.04)))
            if rnd.random() < 0.06:
                a["reason"] = rnd.choices(REASONS, weights=[r[1] for r in REASONS])[0]
            if a["reason"][0] not in ("Low/No Risk", None) and rnd.random() < 0.05:
                a["status"] = "Saved"
                a["reason"] = REASONS[0]
            if a["quarter"] not in window:
                continue
            reason, _, subs = a["reason"]
            risk = "Low" if reason == "Low/No Risk" else None if reason is None else ("High" if rnd.random() < 0.22 else "Medium")
            pct = {"High": 0.5, "Medium": 0.25}.get(risk, 0)
            if reason is None and rnd.random() < 0.4:
                pct = 0.25  # risk $ recorded but no reason: a data-quality case worth surfacing
            rows.append({
                "snapshot": s.isoformat(), "accountId": a["accountId"], "gsid": a["gsid"], "entity": a["entity"], "region": a["region"], "account": a["account"], "esp": a["esp"],
                "type": a["type"], "quarter": a["quarter"], "baseline": a["baseline"],
                "riskAmt": round(a["baseline"] * pct, 2), "riskReason": reason,
                "riskStatus": None if reason is None else ("Churn" if risk == "High" and rnd.random() < 0.08 else a["status"]),
                "riskSubReason": rnd.choice(subs), "consumption": None if a["consumption"] is None else round(a["consumption"], 3),
                "saasPhase": a["saasPhase"], "swPhase": a["swPhase"], "risk": risk, "owner": a["owner"], "actions": None,
            })

    meta = dict(note="SAMPLE DATA: fictional accounts.", links={
        "gainsight": "https://example.gainsightcloud.com/v1/ui/customersuccess360?cid={gsid}",
        "salesforce": "https://example.lightning.force.com/lightning/r/Account/{accountId}/view",
    })
    return {"meta": meta, "snapshots": [snapshot_entry(s) for s in snaps], "rows": rows}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("add", help="add a snapshot from a Matik workbook")
    a.add_argument("workbook", type=Path)
    a.add_argument("--sheet", default="SourceData")
    a.add_argument("--region", help="sales region for every row (if the sheet has no Sales Region column)")
    a.add_argument("--entity", help="sales entity for every row (if the sheet has no Sales Entity column)")
    a.add_argument("--snapshot", help="snapshot date YYYY-MM-DD (default: today)")
    a.add_argument("--data", type=Path, default=HISTORY)
    h = sub.add_parser("html", help="build risk-dashboard.html")
    h.add_argument("--data", type=Path, default=HISTORY)
    h.add_argument("-o", "--out", type=Path, default=OUT)
    h.add_argument("--gainsight-url", help="Gainsight account link with a {gsid} placeholder, e.g. https://<tenant>.gainsightcloud.com/v1/ui/customersuccess360?cid={gsid}")
    h.add_argument("--salesforce-url", help="Salesforce account link, e.g. https://<domain>.lightning.force.com/lightning/r/Account/{accountId}/view")
    s = sub.add_parser("sample", help="write fictional sample data")
    s.add_argument("-o", "--out", type=Path, default=SAMPLE)
    args = ap.parse_args()

    if args.cmd == "add":
        add_snapshot(args)
    elif args.cmd == "html":
        build_html(args)
    else:
        save(make_sample(), args.out)
        print(f"Wrote {args.out}")


if __name__ == "__main__":
    sys.exit(main())
