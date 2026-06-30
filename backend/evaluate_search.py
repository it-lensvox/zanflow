"""
Dyuksa AI Search — Pipeline Evaluation Script

Usage:
    python evaluate_search.py
    python evaluate_search.py --model gpt4o
    python evaluate_search.py --category filter_priority
    python evaluate_search.py --ids S001 S013 S031
    python evaluate_search.py --compare results/search_run_A.json results/search_run_B.json

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

# ── Config ─────────────────────────────────────────────────────────────────────
BASE_URL      = "http://192.168.1.26:8000"
ENDPOINT      = f"{BASE_URL}/api/v1/agent/search/"
JWT_TOKEN     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzgyODAzODgyLCJpYXQiOjE3ODI4MDAyODIsImp0aSI6Ijk1YTA5NDQxNDBjZjQ4ZjdhODdkNGE4ZWFkYzYxM2IxIiwidXNlcl9pZCI6IjEifQ.2mFbPvZSIDOd6HWpviVhFwNE-B6a2IlgoqH6i8gwQsU"
WORKSPACE_ID  = "1"
QUERIES_FILE  = "search_queries.json"
RESULTS_DIR   = "results"
DELAY         = 0.5   # seconds between queries


# ── Args ───────────────────────────────────────────────────────────────────────
def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--model",    default="gpt4o-mini")
    p.add_argument("--queries",  default=QUERIES_FILE)
    p.add_argument("--category", default=None)
    p.add_argument("--ids",      nargs="*", default=None)
    p.add_argument("--dry-run",  action="store_true")
    p.add_argument("--compare",  nargs=2, default=None, metavar=("A", "B"))
    return p.parse_args()
 
 
# ── Load queries ───────────────────────────────────────────────────────────────
def load_queries(path, category=None, ids=None):
    if not os.path.exists(path):
        print(f"\n  ERROR: File not found: {path}\n")
        sys.exit(1)
    with open(path) as f:
        data = json.load(f)
    qs = data.get("dataset", [])
    if category:
        qs = [q for q in qs if q.get("category") == category]
    if ids:
        qs = [q for q in qs if q.get("id") in ids]
    return qs
 
 
# ── API call ───────────────────────────────────────────────────────────────────
def call_search(query_text):
    import urllib.request, urllib.error
    payload = json.dumps({"query": query_text}).encode()
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
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode()), None
    except urllib.error.HTTPError as e:
        body = ""
        try: body = e.read().decode()[:200]
        except: pass
        return e.code, None, f"HTTP {e.code}: {body}"
    except Exception as e:
        return 0, None, str(e)
 
 
# ── Scoring ────────────────────────────────────────────────────────────────────
def score(query, http_status, resp):
    """
    Returns (status, failure_reason, details_dict)
    status = "pass" | "partial" | "fail"
    """
    expected_intent  = query.get("expected_intent")
    expected_type    = query["expected_answer"]["response_type"]
    results_must_have = query["expected_answer"].get("results_must_have", [])
 
    failures = []
    details  = {}
 
    # ── Empty query → expect 400 ───────────────────────────────────────────────
    if expected_type == "error":
        if http_status == 400:
            return "pass", None, {"http_status": http_status}
        failures.append(f"expected HTTP 400 got {http_status}")
        return "fail", " | ".join(failures), {}
 
    # ── Normal response checks ─────────────────────────────────────────────────
    if http_status != 200 or resp is None:
        return "fail", f"HTTP {http_status}", {}
 
    actual_type   = resp.get("type")
    actual_results = resp.get("results", {})
    fallback      = resp.get("fallback", False)
 
    details = {
        "type":     actual_type,
        "total":    resp.get("total", 0),
        "fallback": fallback,
        "tasks":    len(actual_results.get("tasks", [])),
        "notes":    len(actual_results.get("notes", [])),
        "projects": len(actual_results.get("projects", [])),
    }
 
    # Intent type check
    if actual_type != expected_type:
        failures.append(f"expected type='{expected_type}' got '{actual_type}'")
 
    # Results model check (only for search type)
    if expected_type == "search" and actual_type == "search":
        for model in results_must_have:
            if model not in actual_results:
                failures.append(f"missing model '{model}' in results")
 
    # Intent match check
    if expected_intent and expected_intent not in ("error",):
        if expected_intent == "search" and actual_type == "action":
            failures.append("intent mismatch: expected search, got action")
        elif expected_intent == "action" and actual_type == "search":
            failures.append("intent mismatch: expected action, got search")
 
    if not failures:
        return "pass", None, details
 
    # Partial: right type but something else wrong (e.g. missing model)
    if actual_type == expected_type:
        return "partial", " | ".join(failures), details
 
    return "fail", " | ".join(failures), details
 
 
# ── Run ────────────────────────────────────────────────────────────────────────
def run_evaluation(queries, model_name, dry_run=False):
    os.makedirs(RESULTS_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    run_id    = f"search_run_{timestamp}_{model_name}"
    out_path  = os.path.join(RESULTS_DIR, f"{run_id}.json")
 
    results      = []
    passed = failed = partial = total_latency = 0
 
    print(f"\n{'='*65}")
    print(f"  Dyuksa AI Search Evaluation")
    print(f"  Run     : {run_id}")
    print(f"  Queries : {len(queries)}")
    print(f"  Endpoint: {ENDPOINT}")
    print(f"{'='*65}\n")
 
    for i, q in enumerate(queries, 1):
        qid  = q["id"]
        cat  = q.get("category", "?")
        diff = q.get("difficulty", "?")
        text = q.get("query", "")
 
        print(f"[{i:3}/{len(queries)}] {qid} | {cat:20s} | {diff:6s} | {repr(text[:45])}")
 
        if dry_run:
            print(f"         → DRY RUN")
            results.append({
                "id": qid, "category": cat, "difficulty": diff, "query": text,
                "status": "dry-run", "expected_intent": q.get("expected_intent"),
                "actual_type": None, "latency_ms": 0, "failure_reason": None,
            })
            continue
 
        start = time.time()
        http_status, resp, error = call_search(text)
        latency = int((time.time() - start) * 1000)
        total_latency += latency
 
        if error and resp is None:
            # Special case: empty query expects HTTP 400 — treat as pass
            expected_type_check = q["expected_answer"]["response_type"]
            if expected_type_check == "error" and "400" in str(error):
                status = "pass"
                reason = None
                details = {"http_status": 400}
                passed += 1
                print(f"         ✓ PASS    | {latency}ms | HTTP 400 (expected)")
            else:
                status = "fail"
                reason = f"API error: {error}"
                details = {}
                failed += 1
                print(f"         ✗ FAIL    | {latency}ms | {reason}")
        else:
            status, reason, details = score(q, http_status, resp)
            if status == "pass":
                passed += 1
                info = f"type={details.get('type')} tasks={details.get('tasks',0)} notes={details.get('notes',0)} projects={details.get('projects',0)}"
                if details.get("fallback"):
                    info += " [FALLBACK]"
                print(f"         ✓ PASS    | {latency}ms | {info}")
            elif status == "partial":
                partial += 1
                print(f"         ~ PARTIAL | {latency}ms | {reason}")
            else:
                failed += 1
                print(f"         ✗ FAIL    | {latency}ms | {reason}")
 
        results.append({
            "id":              qid,
            "category":        cat,
            "difficulty":      diff,
            "query":           text,
            "expected_intent": q.get("expected_intent"),
            "expected_type":   q["expected_answer"]["response_type"],
            "actual_type":     details.get("type"),
            "total_results":   details.get("total", 0),
            "fallback":        details.get("fallback", False),
            "latency_ms":      latency,
            "status":          status,
            "failure_reason":  reason,
        })
 
        time.sleep(DELAY)
 
    # ── Summary ────────────────────────────────────────────────────────────────
    total = len(queries)
    avg   = int(total_latency / max(total, 1))
 
    cat_stats = {}
    for r in results:
        c = r["category"]
        if c not in cat_stats:
            cat_stats[c] = {"pass": 0, "partial": 0, "fail": 0, "dry-run": 0, "total": 0}
        cat_stats[c][r["status"]] += 1
        cat_stats[c]["total"]     += 1
 
    # Fallback rate
    fallback_count = sum(1 for r in results if r.get("fallback"))
 
    # Save
    output = {
        "run_id": run_id, "model": model_name,
        "run_at": datetime.now().isoformat(),
        "endpoint": ENDPOINT, "workspace_id": WORKSPACE_ID,
        "total": total, "passed": passed, "failed": failed, "partial": partial,
        "pass_rate": round(passed / max(total, 1) * 100, 1),
        "fallback_rate": round(fallback_count / max(total, 1) * 100, 1),
        "avg_latency_ms": avg,
        "category_breakdown": cat_stats,
        "results": results,
    }
 
    if not dry_run:
        with open(out_path, "w") as f:
            json.dump(output, f, indent=2)
 
    print(f"\n{'='*65}")
    print(f"  RESULTS SUMMARY")
    print(f"{'='*65}")
    print(f"  Total        : {total}")
    print(f"  Pass         : {passed}  ({round(passed/max(total,1)*100,1)}%)")
    print(f"  Partial      : {partial}  ({round(partial/max(total,1)*100,1)}%)")
    print(f"  Fail         : {failed}  ({round(failed/max(total,1)*100,1)}%)")
    print(f"  Fallback     : {fallback_count}  ({round(fallback_count/max(total,1)*100,1)}% used basic search)")
    print(f"  Avg latency  : {avg}ms per query")
    print(f"\n  Category breakdown:")
    for cat, st in sorted(cat_stats.items()):
        pct = round(st["pass"] / max(st["total"], 1) * 100, 0)
        bar = "█" * int(pct / 10) + "░" * (10 - int(pct / 10))
        print(f"    {cat:22s}: {bar}  {st['pass']:2}/{st['total']:2}  ({pct:.0f}%)")
    if not dry_run:
        print(f"\n  Saved → {out_path}")
    print(f"{'='*65}\n")
    return output
 
 
# ── Compare ────────────────────────────────────────────────────────────────────
def compare_runs(a, b):
    for f in [a, b]:
        if not os.path.exists(f):
            print(f"File not found: {f}")
            sys.exit(1)
    with open(a) as f: r1 = json.load(f)
    with open(b) as f: r2 = json.load(f)
    m1 = {r["id"]: r for r in r1["results"]}
    m2 = {r["id"]: r for r in r2["results"]}
    impr, regr = [], []
    for qid in m1:
        if qid not in m2: continue
        s1, s2 = m1[qid]["status"], m2[qid]["status"]
        if s1 != "pass" and s2 == "pass":
            impr.append((qid, m1[qid]["query"][:50], s1, s2))
        elif s1 == "pass" and s2 != "pass":
            regr.append((qid, m1[qid]["query"][:50], s1, s2))
    print(f"\n{'='*65}")
    print(f"  COMPARISON")
    print(f"  A: {r1['run_id']}  pass={r1['pass_rate']}%")
    print(f"  B: {r2['run_id']}  pass={r2['pass_rate']}%")
    print(f"{'='*65}")
    if impr:
        print(f"\n  ✓ IMPROVEMENTS ({len(impr)})")
        for qid, q, s1, s2 in impr:
            print(f"    {qid} {s1}→{s2}  {q}")
    if regr:
        print(f"\n  ✗ REGRESSIONS ({len(regr)})")
        for qid, q, s1, s2 in regr:
            print(f"    {qid} {s1}→{s2}  {q}")
    net = len(impr) - len(regr)
    print(f"\n  Net: {'+' if net >= 0 else ''}{net}")
    print(f"{'='*65}\n")
 
 
# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    args = parse_args()
 
    if args.compare:
        compare_runs(args.compare[0], args.compare[1])
        sys.exit(0)
 
    if JWT_TOKEN == "your_jwt_token_here":
        print("\n  ERROR: JWT token not set.")
        print("  Set it directly in the script or run:")
        print("  export DYUKSA_JWT='your_access_token'")
        print("  Then: python evaluate_search.py\n")
        sys.exit(1)
 
    queries = load_queries(args.queries, category=args.category, ids=args.ids)
 
    if not queries:
        print("  No queries matched. Check --category or --ids.\n")
        sys.exit(1)
 
    run_evaluation(queries, model_name=args.model, dry_run=args.dry_run)
