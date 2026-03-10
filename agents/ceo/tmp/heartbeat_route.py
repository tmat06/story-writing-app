import json
import os
import re
import time
from pathlib import Path
from urllib import request, parse, error

API_URL = os.environ['PAPERCLIP_API_URL'].rstrip('/')
API_KEY = os.environ['PAPERCLIP_API_KEY']
COMPANY_ID = os.environ['PAPERCLIP_COMPANY_ID']
RUN_ID = os.environ.get('PAPERCLIP_RUN_ID', '')
TMP_DIR = Path('agents/ceo/tmp/heartbeat_20260309')
TMP_DIR.mkdir(parents=True, exist_ok=True)

ASSIGN_RE = re.compile(r'^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$', re.MULTILINE)


def _request(method, path, payload=None, include_run=False):
    url = f"{API_URL}{path}"
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
    }
    if include_run:
        headers['X-Paperclip-Run-Id'] = RUN_ID
    data = None
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')

    req = request.Request(url, method=method, headers=headers, data=data)
    try:
        with request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode('utf-8')
            return resp.status, body
    except error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace') if e.fp else ''
        return e.code, body
    except Exception as e:
        return None, str(e)


def fetch_to_file(method, path, out_file, payload=None, include_run=False, req_class='default'):
    out_path = TMP_DIR / out_file
    attempts = 0
    while attempts < 2:
        attempts += 1
        status, body = _request(method, path, payload=payload, include_run=include_run)
        retryable = (status is None) or (status == 429)
        if status is not None and 200 <= status < 300:
            out_path.write_text(body, encoding='utf-8')
            if out_path.stat().st_size == 0:
                if attempts == 1:
                    time.sleep(0.8)
                    continue
            return True, status, out_path
        if retryable and attempts == 1:
            time.sleep(0.8)
            continue
        out_path.write_text(body or '', encoding='utf-8')
        return False, status, out_path
    return False, status, out_path


def load_json_with_refetch(method, path, out_file, payload=None, include_run=False, req_class='default'):
    ok, status, p = fetch_to_file(method, path, out_file, payload=payload, include_run=include_run, req_class=req_class)
    if not ok:
        return False, status, None, p
    txt = p.read_text(encoding='utf-8').strip()
    if not txt:
        # strict one refetch
        ok2, status2, p2 = fetch_to_file(method, path, out_file + '.retry', payload=payload, include_run=include_run, req_class=req_class)
        if not ok2:
            return False, status2, None, p2
        txt = p2.read_text(encoding='utf-8').strip()
        if not txt:
            return False, status2, None, p2
        p = p2
    try:
        return True, status, json.loads(txt), p
    except Exception:
        ok2, status2, p2 = fetch_to_file(method, path, out_file + '.retry', payload=payload, include_run=include_run, req_class=req_class)
        if not ok2:
            return False, status2, None, p2
        txt2 = p2.read_text(encoding='utf-8').strip()
        if not txt2:
            return False, status2, None, p2
        try:
            return True, status2, json.loads(txt2), p2
        except Exception:
            return False, status2, None, p2


def as_list_and_next(obj):
    if isinstance(obj, list):
        return obj, None
    if not isinstance(obj, dict):
        return [], None
    for key in ('items', 'results', 'data', 'issues', 'projects', 'agents', 'comments'):
        if isinstance(obj.get(key), list):
            items = obj[key]
            break
    else:
        items = []

    next_cursor = obj.get('nextCursor')
    if not next_cursor and isinstance(obj.get('pagination'), dict):
        next_cursor = obj['pagination'].get('nextCursor')
    if not next_cursor and isinstance(obj.get('meta'), dict):
        next_cursor = obj['meta'].get('nextCursor')
    if not next_cursor:
        has_more = obj.get('hasMore')
        page = obj.get('page')
        total_pages = obj.get('totalPages')
        if has_more and isinstance(page, int):
            next_cursor = str(page + 1)
        elif isinstance(page, int) and isinstance(total_pages, int) and page < total_pages:
            next_cursor = str(page + 1)
    return items, next_cursor


# identity
ok, _, me, _ = load_json_with_refetch('GET', '/api/agents/me', 'agents_me.json', req_class='identity')
if not ok:
    print(json.dumps({'ok': False, 'phase': 'identity'}))
    raise SystemExit(0)

# projects
ok, _, projects_obj, _ = load_json_with_refetch('GET', f'/api/companies/{COMPANY_ID}/projects', 'projects_page1.json', req_class='projects')
if not ok:
    print(json.dumps({'ok': False, 'phase': 'projects'}))
    raise SystemExit(0)
projects, _ = as_list_and_next(projects_obj)

repo_name = 'story-writing-app'
project = None
for p in projects:
    name = (p.get('name') or '').lower()
    ws = p.get('workspace') or {}
    cwd = (ws.get('cwd') or '').lower()
    if repo_name in name or repo_name in cwd:
        project = p
        break
if project is None and projects:
    project = projects[0]
if project is None:
    print(json.dumps({'ok': False, 'phase': 'project_match'}))
    raise SystemExit(0)
project_id = project.get('id')

# agents
ok, _, agents_obj, _ = load_json_with_refetch('GET', f'/api/companies/{COMPANY_ID}/agents', 'agents_page1.json', req_class='agents')
if not ok:
    print(json.dumps({'ok': False, 'phase': 'agents'}))
    raise SystemExit(0)
all_agents, next_cursor = as_list_and_next(agents_obj)
page = 1
while next_cursor:
    page += 1
    q = parse.urlencode({'cursor': next_cursor})
    ok, _, obj, _ = load_json_with_refetch('GET', f'/api/companies/{COMPANY_ID}/agents?{q}', f'agents_page{page}.json', req_class='agents')
    if not ok:
        break
    items, next_cursor = as_list_and_next(obj)
    all_agents.extend(items)

name_to_agent = {}
for a in all_agents:
    nm = (a.get('name') or '').strip()
    if nm.startswith('[') and nm.endswith(']'):
        nm = nm[1:-1].strip()
    if nm:
        name_to_agent[nm] = a

# issues pagination
statuses = 'backlog,todo,in_progress,in_review,blocked'
page = 1
issues = []
query = parse.urlencode({'projectId': project_id, 'status': statuses})
ok, _, issues_obj, _ = load_json_with_refetch('GET', f'/api/companies/{COMPANY_ID}/issues?{query}', f'issues_page{page}.json', req_class='issues')
if not ok:
    print(json.dumps({'ok': False, 'phase': 'issues'}))
    raise SystemExit(0)
items, next_cursor = as_list_and_next(issues_obj)
issues.extend(items)
while next_cursor:
    page += 1
    q = parse.urlencode({'projectId': project_id, 'status': statuses, 'cursor': next_cursor})
    ok, _, obj, _ = load_json_with_refetch('GET', f'/api/companies/{COMPANY_ID}/issues?{q}', f'issues_page{page}.json', req_class='issues')
    if not ok:
        break
    items, next_cursor = as_list_and_next(obj)
    issues.extend(items)

reassigned = 0
already_correct = 0
no_directive = 0
invalid_target = 0
skipped_error = 0
per_issue = []

for idx, issue in enumerate(issues, start=1):
    issue_id = issue.get('id')
    if not issue_id:
        continue

    ok, _, comments_obj, _ = load_json_with_refetch('GET', f'/api/issues/{issue_id}/comments', f'issue_{idx}_{issue_id}_comments.json', req_class='comments')
    if not ok:
        skipped_error += 1
        per_issue.append({'id': issue_id, 'result': 'skip_comments_fetch'})
        continue
    comments, _ = as_list_and_next(comments_obj)
    if not isinstance(comments, list):
        comments = []

    directives = []

    desc = issue.get('description') or ''
    for m in ASSIGN_RE.finditer(desc):
        target = m.group(1).strip()
        ts = issue.get('createdAt') or ''
        directives.append((ts, str(issue.get('id') or ''), 0, target, 'description'))

    for c in comments:
        body = c.get('body') or ''
        for m in ASSIGN_RE.finditer(body):
            target = m.group(1).strip()
            ts = c.get('createdAt') or ''
            cid = c.get('id')
            directives.append((ts, str(cid) if cid is not None else '', 1, target, 'comment'))

    if not directives:
        no_directive += 1
        per_issue.append({'id': issue_id, 'result': 'no_directive'})
        continue

    directives.sort(key=lambda x: (x[0], x[1], x[2]))
    ts, did, src_order, raw_target, src = directives[-1]
    target_name = raw_target.strip()
    if target_name.startswith('[') and target_name.endswith(']'):
        target_name = target_name[1:-1].strip()

    agent = name_to_agent.get(target_name)
    if not agent:
        invalid_target += 1
        per_issue.append({'id': issue_id, 'result': 'invalid_target', 'target': target_name})
        continue

    target_id = agent.get('id')
    if issue.get('assigneeAgentId') == target_id:
        already_correct += 1
        per_issue.append({'id': issue_id, 'result': 'already_correct', 'target': target_name})
        continue

    payload = {
        'assigneeAgentId': target_id,
        'comment': f'Assigned to {target_name}.',
    }
    ok2, status2, _, out_path = load_json_with_refetch('PATCH', f'/api/issues/{issue_id}', f'issue_{idx}_{issue_id}_patch.json', payload=payload, include_run=True, req_class='patch')
    if ok2:
        reassigned += 1
        per_issue.append({'id': issue_id, 'result': 'reassigned', 'target': target_name})
    else:
        skipped_error += 1
        per_issue.append({'id': issue_id, 'result': f'patch_failed_{status2}', 'target': target_name})

# own inbox summary
my_id = me.get('id')
inbox_query = parse.urlencode({'assigneeAgentId': my_id, 'status': 'todo,in_progress,blocked'})
ok, _, inbox_obj, _ = load_json_with_refetch('GET', f'/api/companies/{COMPANY_ID}/issues?{inbox_query}', 'my_inbox.json', req_class='inbox')
inbox_items = []
if ok:
    inbox_items, _ = as_list_and_next(inbox_obj)

summary = {
    'ok': True,
    'agentId': my_id,
    'companyId': COMPANY_ID,
    'projectId': project_id,
    'projectName': project.get('name'),
    'issuesScanned': len(issues),
    'reassigned': reassigned,
    'alreadyCorrect': already_correct,
    'noDirective': no_directive,
    'invalidTarget': invalid_target,
    'skippedError': skipped_error,
    'inboxCount': len(inbox_items),
    'inbox': [
        {
            'id': i.get('id'),
            'identifier': i.get('identifier'),
            'status': i.get('status'),
            'title': i.get('title'),
            'priority': i.get('priority'),
        }
        for i in inbox_items
    ],
    'details': per_issue,
}
(TMP_DIR / 'summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps(summary))
