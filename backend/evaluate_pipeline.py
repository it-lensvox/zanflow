"""
Dyuksa AI Agent — Pipeline Evaluation Script

Usage:
    python evaluate_pipeline.py
    python evaluate_pipeline.py --model claude-haiku
    python evaluate_pipeline.py --model nova-lite --category task_action
    python evaluate_pipeline.py --ids Q001 Q005 Q010
    python evaluate_pipeline.py --compare results/run_A.json results/run_B.json

Setup:
    export DYUKSA_JWT="your_jwt_token"
    export DYUKSA_WORKSPACE="1"
"""

import json
import os
import sys
import time
import argparse
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL     = "http://192.168.1.17:8000"
ENDPOINT     = f"{BASE_URL}/api/v1/agent/query/"
JWT_TOKEN    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzgyOTkxNzc5LCJpYXQiOjE3ODI5ODgxNzksImp0aSI6IjdjNWRkM2M0MmE0YjRiNDJiNGI1M2FmZjVjN2I2OWE1IiwidXNlcl9pZCI6IjEifQ.Ft3AAQdlYOvMaE2Df0qCVUDYGHkqTye7a-VVDZQswGc"
WORKSPACE_ID = "1"
QUERIES_FILE = "/Users/Harshitshukla/Desktop/ZanFlow/ZanFlow/backend/dyuksa_queries_v2.json"
RESULTS_DIR  = "results"
DELAY        = 1.0   # seconds between queries — set to 0.3 for faster runs

# ── Args ──────────────────────────────────────────────────────────────────────
def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--model",    default="unknown")
    p.add_argument("--queries",  default=QUERIES_FILE)
    p.add_argument("--category", default=None)
    p.add_argument("--ids",      nargs="*", default=None)
    p.add_argument("--dry-run",  action="store_true")
    p.add_argument("--compare",  nargs=2, default=None, metavar=("A", "B"))
    return p.parse_args()

# ── Load queries ──────────────────────────────────────────────────────────────
def load_queries(path, category=None, ids=None):
    if not os.path.exists(path):
        print(f"\n  ERROR: File not found: {path}")
        print(f"  Make sure '{path}' is in the same folder as this script.\n")
        sys.exit(1)
    with open(path) as f:
        data = json.load(f)
    qs = data.get("dataset", [])
    if category:
        qs = [q for q in qs if q.get("category") == category]
    if ids:
        qs = [q for q in qs if q.get("id") in ids]
    return qs

# ── API call ──────────────────────────────────────────────────────────────────
def call_agent(query_text):
    import urllib.request, urllib.error
    payload = json.dumps({"query": query_text, "session_id": None}).encode()
    req = urllib.request.Request(
        ENDPOINT, data=payload,
        headers={
            "Content-Type":   "application/json",
            "Authorization":  f"Bearer {JWT_TOKEN}",
            "X-Workspace-Id": str(WORKSPACE_ID),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode()), None
    except urllib.error.HTTPError as e:
        body = ""
        try: body = e.read().decode()[:200]
        except: pass
        return None, f"HTTP {e.code}: {body}"
    except Exception as e:
        return None, str(e)

# ── Scoring ───────────────────────────────────────────────────────────────────
def score(query, resp):
    expected_tool    = query["expected_tool_call"]["tool"]
    must_contain     = query["expected_answer"].get("response_must_contain", [])
    must_not_contain = query["expected_answer"].get("response_must_not_contain", [])
    expected_shape   = query["expected_answer"].get("tool_result_shape") or {}

    actual_tool = resp.get("tool_called") or ""
    actual_resp = (resp.get("response") or "").lower()
    tool_result = resp.get("tool_result") or {}

    failures = []

    # Tool check
    if expected_tool is None:
        if actual_tool:
            failures.append(f"expected no tool but got '{actual_tool}'")
    else:
        if actual_tool != expected_tool:
            failures.append(f"expected '{expected_tool}' got '{actual_tool}'")
    tool_ok = not failures

    # Keywords
    missing = [kw for kw in must_contain if kw.lower() not in actual_resp]
    if missing:
        failures.append(f"missing: {missing}")

    # Forbidden words
    found_bad = [kw for kw in must_not_contain if kw.lower() in actual_resp]
    if found_bad:
        failures.append(f"forbidden: {found_bad}")

    # Tool result success
    if "success" in expected_shape and tool_result:
        if tool_result.get("success") != expected_shape["success"]:
            failures.append(f"tool_result.success expected {expected_shape['success']}")

    if not failures:
        return "pass", None
    if tool_ok:
        return "partial", " | ".join(failures)
    return "fail", " | ".join(failures)

# ── Run ───────────────────────────────────────────────────────────────────────
def run_evaluation(queries, model_name, dry_run=False):
    os.makedirs(RESULTS_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    run_id    = f"run_{timestamp}_{model_name}"
    out_path  = os.path.join(RESULTS_DIR, f"{run_id}.json")

    results = []
    passed = failed = partial = total_latency = 0

    print(f"\n{'='*65}")
    print(f"  Dyuksa Pipeline Evaluation")
    print(f"  Run     : {run_id}")
    print(f"  Queries : {len(queries)}")
    print(f"  Endpoint: {ENDPOINT}")
    print(f"{'='*65}\n")

    for i, q in enumerate(queries, 1):
        qid  = q["id"]
        cat  = q.get("category", "?")
        diff = q.get("difficulty", "?")
        text = q.get("query", "")

        print(f"[{i:3}/{len(queries)}] {qid} | {cat:20s} | {diff:6s} | {text[:52]}")

        if dry_run:
            results.append({"id":qid,"category":cat,"difficulty":diff,"query":text,
                            "status":"dry-run","expected_tool":q["expected_tool_call"]["tool"],
                            "actual_tool_called":None,"actual_response":None,
                            "actual_tool_result":None,"latency_ms":0,"failure_reason":None})
            print(f"         → DRY RUN")
            continue

        start = time.time()
        resp, error = call_agent(text)
        latency = int((time.time() - start) * 1000)
        total_latency += latency

        if error or resp is None:
            status = "fail"
            reason = f"API error: {error}"
            failed += 1
            print(f"         ✗ FAIL    | {latency}ms | {reason}")
            results.append({"id":qid,"category":cat,"difficulty":diff,"query":text,
                            "expected_tool":q["expected_tool_call"]["tool"],
                            "actual_tool_called":None,"actual_response":None,
                            "actual_tool_result":None,"latency_ms":latency,
                            "status":status,"failure_reason":reason})
        else:
            status, reason = score(q, resp)
            if status == "pass":
                passed += 1
                print(f"         ✓ PASS    | {latency}ms")
            elif status == "partial":
                partial += 1
                print(f"         ~ PARTIAL | {latency}ms | {reason}")
            else:
                failed += 1
                print(f"         ✗ FAIL    | {latency}ms | {reason}")

            results.append({"id":qid,"category":cat,"difficulty":diff,"query":text,
                            "expected_tool":q["expected_tool_call"]["tool"],
                            "actual_tool_called":resp.get("tool_called"),
                            "actual_response":resp.get("response"),
                            "actual_tool_result":resp.get("tool_result"),
                            "latency_ms":latency,"status":status,"failure_reason":reason})

        time.sleep(DELAY)

    # ── Category breakdown ────────────────────────────────────────────────────
    total = len(queries)
    avg   = int(total_latency / max(total, 1))

    cat_stats = {}
    for r in results:
        c = r["category"]
        if c not in cat_stats:
            cat_stats[c] = {"pass":0,"partial":0,"fail":0,"dry-run":0,"total":0}
        cat_stats[c][r["status"]] += 1
        cat_stats[c]["total"] += 1

    # ── Save ──────────────────────────────────────────────────────────────────
    output = {
        "run_id": run_id, "model": model_name,
        "run_at": datetime.now().isoformat(),
        "endpoint": ENDPOINT, "workspace_id": WORKSPACE_ID,
        "total": total, "passed": passed, "failed": failed, "partial": partial,
        "pass_rate": round(passed / max(total,1) * 100, 1),
        "avg_latency_ms": avg,
        "category_breakdown": cat_stats,
        "results": results,
    }

    if not dry_run:
        with open(out_path, "w") as f:
            json.dump(output, f, indent=2)

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'='*65}")
    print(f"  RESULTS SUMMARY")
    print(f"{'='*65}")
    print(f"  Total   : {total}")
    print(f"  Pass    : {passed}  ({round(passed/max(total,1)*100,1)}%)")
    print(f"  Partial : {partial}  ({round(partial/max(total,1)*100,1)}%)")
    print(f"  Fail    : {failed}  ({round(failed/max(total,1)*100,1)}%)")
    print(f"  Avg     : {avg}ms per query")
    print(f"\n  Category breakdown:")
    for cat, st in sorted(cat_stats.items()):
        pct = round(st["pass"] / max(st["total"],1) * 100, 0)
        bar = "█" * int(pct/10) + "░" * (10-int(pct/10))
        print(f"    {cat:25s}: {bar}  {st['pass']:2}/{st['total']:2}  ({pct:.0f}%)")
    if not dry_run:
        print(f"\n  Saved → {out_path}")
    print(f"{'='*65}\n")
    return output

# ── Compare ───────────────────────────────────────────────────────────────────
def compare_runs(a, b):
    for f in [a, b]:
        if not os.path.exists(f):
            print(f"File not found: {f}"); sys.exit(1)
    with open(a) as f: r1 = json.load(f)
    with open(b) as f: r2 = json.load(f)
    m1 = {r["id"]: r for r in r1["results"]}
    m2 = {r["id"]: r for r in r2["results"]}
    impr, regr = [], []
    for qid in m1:
        if qid not in m2: continue
        s1, s2 = m1[qid]["status"], m2[qid]["status"]
        if s1 != "pass" and s2 == "pass":
            impr.append((qid, m1[qid]["query"][:55], s1, s2))
        elif s1 == "pass" and s2 != "pass":
            regr.append((qid, m1[qid]["query"][:55], s1, s2))
    print(f"\n{'='*65}")
    print(f"  COMPARISON")
    print(f"  A: {r1['run_id']}  pass={r1['pass_rate']}%")
    print(f"  B: {r2['run_id']}  pass={r2['pass_rate']}%")
    print(f"{'='*65}")
    if impr:
        print(f"\n  ✓ IMPROVEMENTS ({len(impr)})")
        for qid,q,s1,s2 in impr: print(f"    {qid} {s1}→{s2}  {q}")
    if regr:
        print(f"\n  ✗ REGRESSIONS ({len(regr)})")
        for qid,q,s1,s2 in regr: print(f"    {qid} {s1}→{s2}  {q}")
    net = len(impr)-len(regr)
    print(f"\n  Net: {'+' if net>=0 else ''}{net}")
    print(f"{'='*65}\n")

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    args = parse_args()

    if args.compare:
        compare_runs(args.compare[0], args.compare[1])
        sys.exit(0)

    if JWT_TOKEN == "your_jwt_token_here":
        print("\n  ERROR: JWT token not set.")
        print("  Run: export DYUKSA_JWT='your_access_token'")
        print("  Then: python evaluate_pipeline.py --model claude-haiku\n")
        sys.exit(1)

    queries = load_queries(args.queries, category=args.category, ids=args.ids)

    if not queries:
        print("  No queries matched. Check --category or --ids.\n")
        sys.exit(1)

    run_evaluation(queries, model_name=args.model, dry_run=args.dry_run)
