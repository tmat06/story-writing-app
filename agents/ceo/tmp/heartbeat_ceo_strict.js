const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const apiUrl = process.env.PAPERCLIP_API_URL;
const apiKey = process.env.PAPERCLIP_API_KEY;
const companyId = process.env.PAPERCLIP_COMPANY_ID;
const runId = process.env.PAPERCLIP_RUN_ID;

if (!apiUrl || !apiKey || !companyId || !runId) {
  console.error('Missing required PAPERCLIP_* env vars.');
  process.exit(1);
}

const outDir = path.join('agents', 'ceo', 'tmp', `heartbeat_${new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15)}`);
fs.mkdirSync(outDir, { recursive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function sanitize(s) { return String(s).replace(/[^a-zA-Z0-9._-]+/g, '_'); }
function stripBracketsAndTrim(s) {
  const t = String(s || '').trim();
  const m = t.match(/^\[(.*)\]$/);
  return (m ? m[1] : t).trim();
}
function asItems(d) {
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.items)) return d.items;
  if (d && Array.isArray(d.data)) return d.data;
  if (d && Array.isArray(d.results)) return d.results;
  return [];
}
function nextToken(d) {
  if (!d || Array.isArray(d)) return null;
  if (typeof d.nextCursor === 'string' && d.nextCursor) return {type:'cursor', value:d.nextCursor};
  if (d.pageInfo && typeof d.pageInfo.nextCursor === 'string' && d.pageInfo.nextCursor) return {type:'cursor', value:d.pageInfo.nextCursor};
  if (d.pagination && typeof d.pagination.nextCursor === 'string' && d.pagination.nextCursor) return {type:'cursor', value:d.pagination.nextCursor};
  if (typeof d.nextPage === 'number') return {type:'page', value:d.nextPage};
  if (typeof d.page === 'number' && typeof d.totalPages === 'number' && d.page < d.totalPages) return {type:'page', value:d.page + 1};
  return null;
}
function extractDirectives(text) {
  const out = [];
  const re = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
  let m;
  const src = String(text || '');
  while ((m = re.exec(src)) !== null) out.push(stripBracketsAndTrim(m[1]));
  return out;
}

function runCurl(url, outFile, method='GET', body=null, mutate=false, strict=false) {
  const args = ['-sS'];
  if (strict) args.push('-f');
  args.push('-X', method, '-H', `Authorization: Bearer ${apiKey}`, '-H', 'Accept: application/json');
  if (mutate) args.push('-H', `X-Paperclip-Run-Id: ${runId}`);
  if (body !== null) {
    args.push('-H', 'Content-Type: application/json', '--data-binary', JSON.stringify(body));
  }
  args.push('-o', outFile, '-w', '%{http_code}', url);
  const code = cp.execFileSync('curl', args, { encoding: 'utf8' }).trim();
  return Number(code);
}

async function requestJson({name, url, method='GET', body=null, mutate=false}) {
  const file = path.join(outDir, `${sanitize(name)}.json`);

  const attemptRequest = async (attemptName, strict=false) => {
    try {
      const status = runCurl(url, file, method, body, mutate, strict);
      const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!text || text.trim().length === 0) {
        return { ok:false, retryable:true, parseRetryable:true, reason:`empty body (${attemptName})`, status };
      }
      if (Number.isNaN(status) || status < 200 || status > 299) {
        const retryable = status === 429 || status >= 500 || status === 0;
        return { ok:false, retryable, parseRetryable:false, reason:`HTTP ${status} (${attemptName})` };
      }
      return { ok:true };
    } catch (err) {
      return { ok:false, retryable:true, parseRetryable:false, reason:`transport error (${attemptName}): ${err.message}` };
    }
  };

  let first = await attemptRequest('initial', false);
  if (!first.ok && first.retryable) {
    await sleep(700);
    first = await attemptRequest('retry', false);
  }
  if (!first.ok) return { ok:false, file, error:first.reason };

  const tryParse = () => {
    const saved = fs.readFileSync(file, 'utf8');
    if (!saved || saved.trim().length === 0) throw new Error('saved file empty');
    return JSON.parse(saved);
  };

  try {
    return { ok:true, file, data: tryParse() };
  } catch (err) {
    await sleep(400);
    // reliability contract: strict sequential refetch and single parse retry
    const refetch = await attemptRequest('parse-refetch', true);
    if (!refetch.ok) return { ok:false, file, error:`parse failed then strict refetch failed: ${refetch.reason}` };
    try {
      return { ok:true, file, data: tryParse() };
    } catch (err2) {
      return { ok:false, file, error:`parse failed after strict refetch: ${err2.message}` };
    }
  }
}

function pingPongArtifact(targets) {
  const set = new Set(targets);
  if (set.has('Founding Engineer')) return 'plan revision';
  if (set.has('Code Monkey')) return 'test evidence';
  if (set.has('Code Reviewer')) return 'review finding';
  if (set.has('Design')) return 'design brief';
  return 'plan revision';
}

(async () => {
  const summary = {
    runId,
    outDir,
    projectId: null,
    projectName: null,
    paginationPages: 0,
    scannedIssues: 0,
    reassigned: 0,
    alreadyCorrect: 0,
    noValidDirective: 0,
    invalidTargets: 0,
    skippedFailures: 0,
    pingPongWarnings: 0,
    inbox: { todo:0, in_progress:0, blocked:0 },
    issueResults: []
  };

  const meRes = await requestJson({ name:'agents_me', url:`${apiUrl}/api/agents/me` });
  if (!meRes.ok) { console.error(meRes.error); process.exit(1); }
  const me = meRes.data;

  const projectsRes = await requestJson({ name:'projects', url:`${apiUrl}/api/companies/${companyId}/projects` });
  if (!projectsRes.ok) { console.error(projectsRes.error); process.exit(1); }
  const projects = asItems(projectsRes.data);
  const project = projects.find((p) => {
    const n = String(p.name || '').toLowerCase();
    const k = String(p.urlKey || '').toLowerCase();
    const ws = Array.isArray(p.workspaces) ? p.workspaces : [];
    const wsHit = ws.some((w) => String(w.name || '').toLowerCase().includes('story-writing-app') || String(w.repoUrl || '').toLowerCase().includes('story-writing-app'));
    return n.includes('story writing app') || k.includes('story-writing-app') || wsHit;
  });
  if (!project) { console.error('Story Writing App project not found.'); process.exit(1); }
  summary.projectId = project.id;
  summary.projectName = project.name;

  const agentsRes = await requestJson({ name:'agents', url:`${apiUrl}/api/companies/${companyId}/agents` });
  if (!agentsRes.ok) { console.error(agentsRes.error); process.exit(1); }
  const agents = asItems(agentsRes.data);
  const activeAgentByName = new Map();
  for (const a of agents) {
    if (String(a.status || '').toLowerCase() !== 'terminated') {
      const nm = stripBracketsAndTrim(a.name || '');
      if (nm && !activeAgentByName.has(nm)) activeAgentByName.set(nm, a);
    }
  }

  const base = new URL(`${apiUrl}/api/companies/${companyId}/issues`);
  base.searchParams.set('projectId', project.id);
  base.searchParams.set('status', 'backlog,todo,in_progress,in_review,blocked');
  base.searchParams.set('limit', '100');

  const issues = [];
  let page = 1;
  let cursor = null;
  for (;;) {
    const u = new URL(base.toString());
    if (cursor) u.searchParams.set('cursor', cursor);
    else u.searchParams.set('page', String(page));

    const pageRes = await requestJson({ name: `issues_${cursor ? `cursor_${cursor}` : `page_${page}`}`, url: u.toString() });
    if (!pageRes.ok) { console.error(`Issues page failure: ${pageRes.error}`); process.exit(1); }
    summary.paginationPages += 1;
    asItems(pageRes.data).forEach((it) => issues.push(it));
    const n = nextToken(pageRes.data);
    if (!n) break;
    if (n.type === 'cursor') { cursor = n.value; }
    else { page = n.value; cursor = null; }
    if (summary.paginationPages > 200) { console.error('Pagination safety limit exceeded.'); process.exit(1); }
  }

  summary.scannedIssues = issues.length;

  for (const issue of issues) {
    const directives = [];
    const desc = extractDirectives(issue.description || '');
    for (const targetName of desc) {
      directives.push({ createdAt: issue.createdAt || '1970-01-01T00:00:00.000Z', id: `description:${issue.id}`, targetName, source:'description' });
    }

    const cRes = await requestJson({ name:`comments_${issue.identifier || issue.id}`, url:`${apiUrl}/api/issues/${issue.id}/comments` });
    if (!cRes.ok) {
      summary.skippedFailures += 1;
      summary.issueResults.push({ identifier: issue.identifier, action: 'skip_comments_fetch_failed' });
      continue;
    }

    const comments = asItems(cRes.data);
    for (const c of comments) {
      const rows = extractDirectives(c.body || '');
      for (const targetName of rows) directives.push({ createdAt: c.createdAt || '1970-01-01T00:00:00.000Z', id: String(c.id || ''), targetName, source:'comment' });
    }

    if (directives.length === 0) {
      summary.noValidDirective += 1;
      summary.issueResults.push({ identifier: issue.identifier, action: 'no_directive' });
      continue;
    }

    directives.sort((a,b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
      return String(a.id).localeCompare(String(b.id));
    });

    const selected = directives[directives.length - 1];
    const targetName = stripBracketsAndTrim(selected.targetName);
    const target = activeAgentByName.get(targetName);

    if (!target) {
      summary.invalidTargets += 1;
      summary.issueResults.push({ identifier: issue.identifier, action:'invalid_target', targetName });
      continue;
    }

    if (issue.assigneeAgentId === target.id) {
      summary.alreadyCorrect += 1;
      summary.issueResults.push({ identifier: issue.identifier, action:'already_correct', targetName });
      continue;
    }

    const recentTargets = directives.slice(-4).map(d => stripBracketsAndTrim(d.targetName));
    const pingPong = recentTargets.length === 4 && recentTargets[0] === recentTargets[2] && recentTargets[1] === recentTargets[3] && recentTargets[0] !== recentTargets[1];
    if (pingPong) {
      const artifact = pingPongArtifact(recentTargets);
      const warnRes = await requestJson({
        name:`comment_pingpong_${issue.identifier || issue.id}`,
        url:`${apiUrl}/api/issues/${issue.id}/comments`,
        method:'POST',
        body:{ body:`Routing clarification: repeated reassignment detected. Missing artifact before next handoff: ${artifact}.` },
        mutate:true,
      });
      if (warnRes.ok) summary.pingPongWarnings += 1;
    }

    const patchRes = await requestJson({
      name:`patch_assign_${issue.identifier || issue.id}`,
      url:`${apiUrl}/api/issues/${issue.id}`,
      method:'PATCH',
      body:{ assigneeAgentId: target.id, comment: `Assigned to ${target.name}.` },
      mutate:true,
    });

    if (!patchRes.ok) {
      summary.skippedFailures += 1;
      summary.issueResults.push({ identifier: issue.identifier, action:'patch_failed', targetName, error: patchRes.error });
      continue;
    }

    summary.reassigned += 1;
    summary.issueResults.push({ identifier: issue.identifier, action:'reassigned', targetName });
  }

  const inboxRes = await requestJson({ name:'ceo_inbox', url:`${apiUrl}/api/companies/${companyId}/issues?assigneeAgentId=${me.id}&status=todo,in_progress,blocked` });
  if (inboxRes.ok) {
    for (const i of asItems(inboxRes.data)) {
      if (i.status === 'todo') summary.inbox.todo += 1;
      else if (i.status === 'in_progress') summary.inbox.in_progress += 1;
      else if (i.status === 'blocked') summary.inbox.blocked += 1;
    }
  }

  const summaryPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})();
