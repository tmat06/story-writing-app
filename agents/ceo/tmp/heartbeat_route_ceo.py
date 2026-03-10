import json
import os
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import urlencode
from datetime import datetime

API_URL = os.environ["PAPERCLIP_API_URL"].rstrip("/")
API_KEY = os.environ["PAPERCLIP_API_KEY"]
COMPANY_ID = os.environ["PAPERCLIP_COMPANY_ID"]
RUN_ID = os.environ.get("PAPERCLIP_RUN_ID", "")

run_stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
TMP_DIR = Path("agents/ceo/tmp") / f"heartbeat_{run_stamp}"
TMP_DIR.mkdir(parents=True, exist_ok=True)

ASSIGN_RE = re.compile(r"^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$", re.MULTILINE)


def normalize_agent_name(name: str) -> str:
    n = (name or "").strip()
    if n.startswith("[") and n.endswith("]"):
        n = n[1:-1].strip()
    return n


def run_curl(method: str, path: str, out_path: Path, payload=None, include_run=False, strict=False):
    headers = [
        "-H",
        f"Authorization: Bearer {API_KEY}",
        "-H",
        "Content-Type: application/json",
    ]
    if include_run:
        headers += ["-H", f"X-Paperclip-Run-Id: {RUN_ID}"]

    cmd = [
        "curl",
        "-sS",
        "-X",
        method,
        f"{API_URL}{path}",
        *headers,
    ]
    if strict:
        cmd.append("-f")
    if payload is not None:
        cmd += ["--data", json.dumps(payload)]

    with out_path.open("wb") as f:
        proc = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE)
    stderr_txt = proc.stderr.decode("utf-8", errors="replace")
    return proc.returncode, stderr_txt


def fetch_json(method: str, path: str, out_name: str, payload=None, include_run=False, request_class="default"):
    """
    Contract:
    - Save response to file first; verify non-empty; then parse.
    - On parse/read failure, one sequential refetch with strict curl -sS -f.
    - Retry once for transient transport/429-ish failure class.
    """
    out_path = TMP_DIR / out_name

    # First attempt (non-strict so we capture body for API errors)
    rc, err = run_curl(method, path, out_path, payload=payload, include_run=include_run, strict=False)

    # One retry for transient transport failures
    if rc != 0:
        time.sleep(0.8)
        rc, err = run_curl(method, path, out_path, payload=payload, include_run=include_run, strict=False)
        if rc != 0:
            return False, None, out_path, f"{request_class}: transport rc={rc} err={err.strip()}"

    # verify non-empty before parse
    if not out_path.exists() or out_path.stat().st_size == 0:
        retry_path = TMP_DIR / f"{out_name}.retry"
        rc2, err2 = run_curl(method, path, retry_path, payload=payload, include_run=include_run, strict=True)
        if rc2 != 0 or not retry_path.exists() or retry_path.stat().st_size == 0:
            return False, None, retry_path, f"{request_class}: empty response after strict retry err={err2.strip()}"
        out_path = retry_path

    text = out_path.read_text(encoding="utf-8").strip()
    if not text:
        retry_path = TMP_DIR / f"{out_name}.retry"
        rc2, err2 = run_curl(method, path, retry_path, payload=payload, include_run=include_run, strict=True)
        if rc2 != 0:
            return False, None, retry_path, f"{request_class}: blank text strict retry failed err={err2.strip()}"
        text = retry_path.read_text(encoding="utf-8").strip()
        out_path = retry_path
        if not text:
            return False, None, out_path, f"{request_class}: blank text after strict retry"

    try:
        data = json.loads(text)
        return True, data, out_path, None
    except Exception:
        # one strict refetch and one parse retry
        retry_path = TMP_DIR / f"{out_name}.retry"
        rc2, err2 = run_curl(method, path, retry_path, payload=payload, include_run=include_run, strict=True)
        if rc2 != 0:
            return False, None, retry_path, f"{request_class}: parse fail + strict retry failed err={err2.strip()}"
        if not retry_path.exists() or retry_path.stat().st_size == 0:
            return False, None, retry_path, f"{request_class}: parse fail + strict retry empty"
        text2 = retry_path.read_text(encoding="utf-8").strip()
        if not text2:
            return False, None, retry_path, f"{request_class}: parse fail + strict retry blank"
        try:
            data = json.loads(text2)
            return True, data, retry_path, None
        except Exception as e:
            return False, None, retry_path, f"{request_class}: parse fail after strict retry: {e}"


def extract_items_and_next(payload):
    if isinstance(payload, list):
        return payload, None
    if not isinstance(payload, dict):
        return [], None

    items = None
    for key in ("items", "results", "data", "issues", "projects", "agents", "comments"):
        val = payload.get(key)
        if isinstance(val, list):
            items = val
            break
    if items is None:
        items = []

    next_cursor = payload.get("nextCursor")
    if not next_cursor and isinstance(payload.get("pagination"), dict):
        next_cursor = payload["pagination"].get("nextCursor")
    if not next_cursor and isinstance(payload.get("meta"), dict):
        next_cursor = payload["meta"].get("nextCursor")
    if not next_cursor:
        has_more = payload.get("hasMore")
        page = payload.get("page")
        total_pages = payload.get("totalPages")
        if has_more and isinstance(page, int):
            next_cursor = str(page + 1)
        elif isinstance(page, int) and isinstance(total_pages, int) and page < total_pages:
            next_cursor = str(page + 1)

    return items, next_cursor


def fetch_paginated(path_base: str, params: dict, out_prefix: str, request_class: str):
    all_items = []
    page = 1
    cursor = None

    while True:
        merged = dict(params)
        if cursor:
            merged["cursor"] = cursor
        qs = urlencode(merged)
        path = f"{path_base}?{qs}" if qs else path_base

        ok, data, _, err = fetch_json("GET", path, f"{out_prefix}_page{page}.json", request_class=request_class)
        if not ok:
            return False, all_items, f"{request_class}: failed page {page}: {err}"

        items, next_cursor = extract_items_and_next(data)
        all_items.extend(items)

        if not next_cursor:
            return True, all_items, None

        cursor = next_cursor
        page += 1


def latest_directive(issue, comments):
    directives = []

    desc = issue.get("description") or ""
    for m in ASSIGN_RE.finditer(desc):
        directives.append(
            {
                "createdAt": issue.get("createdAt") or "",
                "id": str(issue.get("id") or ""),
                "targetRaw": m.group(1),
                "source": "description",
            }
        )

    for c in comments:
        body = c.get("body") or ""
        for m in ASSIGN_RE.finditer(body):
            directives.append(
                {
                    "createdAt": c.get("createdAt") or "",
                    "id": str(c.get("id") or ""),
                    "targetRaw": m.group(1),
                    "source": "comment",
                }
            )

    if not directives:
        return None

    directives.sort(key=lambda d: (d["createdAt"], d["id"]))
    return directives[-1]


def detect_ping_pong(issue, comments):
    # Simple loop signal: >=2 assignee changes in last 8 comments via assignment comments.
    recent = comments[-8:]
    assignment_markers = []
    for c in recent:
        body = (c.get("body") or "").strip()
        if body.startswith("Assigned to "):
            assignment_markers.append(c)
    return len(assignment_markers) >= 2


summary = {
    "ok": False,
    "phase": "start",
    "tmpDir": str(TMP_DIR),
}

# Step 1: identity
ok, me, _, err = fetch_json("GET", "/api/agents/me", "agents_me.json", request_class="identity")
if not ok:
    summary.update({"phase": "identity", "error": err})
    print(json.dumps(summary))
    raise SystemExit(0)

agent_id = me.get("id")
summary.update({"agentId": agent_id, "phase": "identity_ok"})

# Step 2: projects (paginated)
ok, projects, err = fetch_paginated(
    f"/api/companies/{COMPANY_ID}/projects",
    {},
    "projects",
    "projects",
)
if not ok:
    summary.update({"phase": "projects", "error": err})
    print(json.dumps(summary))
    raise SystemExit(0)

repo_name = "story-writing-app"
project = None
for p in projects:
    name = (p.get("name") or "").lower()
    ws = p.get("workspace") or {}
    cwd = (ws.get("cwd") or "").lower()
    if repo_name in name or repo_name in cwd:
        project = p
        break
if project is None and projects:
    project = projects[0]
if project is None:
    summary.update({"phase": "project_match", "error": "no projects returned"})
    print(json.dumps(summary))
    raise SystemExit(0)

project_id = project.get("id")
summary.update({"projectId": project_id, "projectName": project.get("name")})

# Step 3: agents (paginated)
ok, agents, err = fetch_paginated(
    f"/api/companies/{COMPANY_ID}/agents",
    {},
    "agents",
    "agents",
)
if not ok:
    summary.update({"phase": "agents", "error": err})
    print(json.dumps(summary))
    raise SystemExit(0)

active_name_to_agent = {}
for a in agents:
    # consider active unless explicitly false
    if a.get("isActive") is False:
        continue
    nm = normalize_agent_name(a.get("name") or "")
    if nm:
        active_name_to_agent[nm] = a

# Step 4: issues (paginated)
statuses = "backlog,todo,in_progress,in_review,blocked"
ok, issues, err = fetch_paginated(
    f"/api/companies/{COMPANY_ID}/issues",
    {"projectId": project_id, "status": statuses},
    "issues",
    "issues",
)
if not ok:
    summary.update({"phase": "issues", "error": err})
    print(json.dumps(summary))
    raise SystemExit(0)

# Step 5: process each issue comments and routing
reassigned = 0
already_correct = 0
no_directive = 0
invalid_target = 0
skipped_error = 0
ping_pong_comments = 0
issue_details = []

for idx, issue in enumerate(issues, start=1):
    issue_id = issue.get("id")
    identifier = issue.get("identifier")
    if not issue_id:
        continue

    ok, comments_data, _, err = fetch_json(
        "GET",
        f"/api/issues/{issue_id}/comments",
        f"issue_{idx}_{issue_id}_comments.json",
        request_class="comments",
    )
    if not ok:
        skipped_error += 1
        issue_details.append(
            {
                "issueId": issue_id,
                "identifier": identifier,
                "result": "skip_comments_fetch",
                "error": err,
            }
        )
        continue

    comments, _ = extract_items_and_next(comments_data)
    if not isinstance(comments, list):
        comments = []

    directive = latest_directive(issue, comments)
    if not directive:
        no_directive += 1
        issue_details.append(
            {
                "issueId": issue_id,
                "identifier": identifier,
                "result": "no_directive",
            }
        )
        continue

    target_name = normalize_agent_name(directive["targetRaw"])
    target_agent = active_name_to_agent.get(target_name)
    if not target_agent:
        invalid_target += 1
        issue_details.append(
            {
                "issueId": issue_id,
                "identifier": identifier,
                "result": "invalid_target",
                "target": target_name,
            }
        )
        continue

    target_id = target_agent.get("id")
    if issue.get("assigneeAgentId") == target_id:
        already_correct += 1
        issue_details.append(
            {
                "issueId": issue_id,
                "identifier": identifier,
                "result": "already_correct",
                "target": target_name,
            }
        )
        continue

    if detect_ping_pong(issue, comments):
        ping_pong_comments += 1
        clarifier = {
            "body": "Routing note: repeated assignment changes detected. Please include the exact missing artifact before next handoff (plan revision, test evidence, review finding, or design brief)."
        }
        fetch_json(
            "POST",
            f"/api/issues/{issue_id}/comments",
            f"issue_{idx}_{issue_id}_pingpong_comment.json",
            payload=clarifier,
            include_run=True,
            request_class="comment",
        )

    patch_payload = {
        "assigneeAgentId": target_id,
        "comment": f"Assigned to {target_name}.",
    }
    ok_patch, _, _, err_patch = fetch_json(
        "PATCH",
        f"/api/issues/{issue_id}",
        f"issue_{idx}_{issue_id}_patch.json",
        payload=patch_payload,
        include_run=True,
        request_class="patch",
    )

    if ok_patch:
        reassigned += 1
        issue_details.append(
            {
                "issueId": issue_id,
                "identifier": identifier,
                "result": "reassigned",
                "target": target_name,
                "source": directive["source"],
                "directiveAt": directive["createdAt"],
                "directiveId": directive["id"],
            }
        )
    else:
        skipped_error += 1
        issue_details.append(
            {
                "issueId": issue_id,
                "identifier": identifier,
                "result": "patch_failed",
                "target": target_name,
                "error": err_patch,
            }
        )

# Step 6: own inbox summary
ok, inbox_issues, err = fetch_paginated(
    f"/api/companies/{COMPANY_ID}/issues",
    {"assigneeAgentId": agent_id, "status": "todo,in_progress,blocked"},
    "inbox",
    "inbox",
)
if not ok:
    inbox_issues = []

summary.update(
    {
        "ok": True,
        "phase": "complete",
        "companyId": COMPANY_ID,
        "issuesScanned": len(issues),
        "reassigned": reassigned,
        "alreadyCorrect": already_correct,
        "noDirective": no_directive,
        "invalidTarget": invalid_target,
        "skippedError": skipped_error,
        "pingPongClarifications": ping_pong_comments,
        "inboxCount": len(inbox_issues),
        "inbox": [
            {
                "id": i.get("id"),
                "identifier": i.get("identifier"),
                "status": i.get("status"),
                "priority": i.get("priority"),
                "title": i.get("title"),
            }
            for i in inbox_issues
        ],
        "details": issue_details,
    }
)

(TMP_DIR / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
print(json.dumps(summary))
