# Paperclip + Codex setup for story-writing-app

Step-by-step guide to run Paperclip and use Codex to build this app. Assumes minimal prior setup.

---

## What you’re setting up

- **Paperclip**: A server + UI that acts as the “company.” You create a company, a project (this repo), a goal, and “hire” an agent (Codex).
- **Codex**: The AI coding agent that does the work. Paperclip will start Codex, give it tasks, and track work in the UI.

---

## Prerequisites

You need:

- **Node.js 20+** and **pnpm 9.15+**  
  Check: `node -v` and `pnpm -v`
- **Codex CLI** on your PATH  
  Check: `which codex` (you already have it at `~/.nvm/versions/node/v24.14.0/bin/codex`)
- **CODEX_HOME** (optional but recommended)  
  So Paperclip and Codex agree on where skills live. If you use `~/.codex` for Codex, set:

  ```bash
  export CODEX_HOME="$HOME/.codex"
  ```

  Add that line to your `~/.zshrc` if you want it in every shell.

---

## Part 1: Run Paperclip

Do this in a **separate** directory from `story-writing-app` (e.g. your home or a `tools` folder). Paperclip is its own app; your app stays in `story-writing-app`.

### Option A – Quickstart (recommended)

```bash
cd ~   # or any folder that is NOT story-writing-app
npx paperclipai onboard --yes
```

This will:

- Clone or use the Paperclip repo
- Install dependencies
- Set up an embedded Postgres and config
- Start the server and open the UI

When it’s ready, the API is at **http://localhost:3100** and the UI is usually at the same place (or the onboarding flow will open it).

### Option B – Manual

```bash
cd ~
git clone https://github.com/paperclipai/paperclip.git
cd paperclip
pnpm install
pnpm dev
```

Then open **http://localhost:3100** in your browser.

---

## Part 2: First-time setup in the UI

Do these once (or as needed) in the Paperclip UI.

### 1. Create a company (if the onboarding didn’t already)

- In the UI, look for “Create company” or the first-time company setup.
- Name it e.g. “Story Writing Co” and create it.
- Remember you’re now “inside” this company for the next steps.

### 2. Create a project for this app

- Go to **Projects** (or equivalent) and create a new project.
- **Name**: e.g. `story-writing-app`.
- **Workspace**: This tells Paperclip (and Codex) which folder to work in.
  - Add a workspace with **path** = absolute path to this repo, e.g.  
    `/Users/tim/code/story-writing-app`
  - If the UI has a “cwd” or “workspace path” field, use that same path.

So the “project” in Paperclip = this repo + its path on your machine.

### 3. Create a goal

- Go to **Goals** (or Company → Goals) and create a goal.
- **Example**: “Build the story-writing-app: a working app for writing and managing stories.”
- Link this goal to the project you created so tasks can be tied to it.

### 4. Hire the Codex agent

- Go to **Agents** (or Company → Agents) and add a new agent (“Hire”).
- Choose adapter type: **Codex (local)** (often listed as `codex_local`).
- Configure the agent:
  - **Name**: e.g. “Codex Engineer”
  - **Working directory (cwd)**: same as the project workspace:  
    `/Users/tim/code/story-writing-app`
  - **Model** (optional): e.g. `gpt-5.3-codex` or `o4-mini` (use whatever you normally use with Codex).
- Set **reporting**: if there’s a CEO or manager agent, assign it; otherwise leave as top-level.
- Save/create the agent.

Paperclip will use this config to run the Codex CLI in your project directory when it assigns work.

### 5. Enable heartbeats (so Codex runs on a schedule)

- Open the Codex agent you just created.
- Find **Heartbeat** or **Runtime** settings.
- Enable heartbeats and set an **interval** (e.g. every 5 minutes = `300` seconds).
- Save.

After this, Paperclip will wake Codex on that interval to pick up and work on tasks.

---

## Part 3: Give Codex work

- Create an **issue/task** in the project you created (e.g. “Add a basic story list page”).
- **Assign** the task to the Codex agent.
- Optionally link the task to the goal you created.

Codex will pick up assigned tasks on the next heartbeat (or when you trigger a run), checkout the task, and work in `/Users/tim/code/story-writing-app` using the Paperclip skill (task context, checkout, comments, etc.).

---

## Part 4: Codex and Paperclip

- **Codex is already compatible** with Paperclip. Paperclip’s `codex_local` adapter runs the Codex CLI with the right `cwd`, env, and prompt. You don’t need to “install” Paperclip inside Codex.
- **Paperclip skill**: If your Codex has the Paperclip skill (e.g. under `$CODEX_HOME/skills` or `~/.codex/skills`), it will use it to follow the heartbeat procedure (checkout task, update status, comment). If the skill isn’t there, you can add it from the Paperclip repo/skills or your own skill set.
- **Verifying Codex**: In a terminal, run:

  ```bash
  cd /Users/tim/code/story-writing-app
  codex --help
  ```

  If that works, Paperclip can run the same binary with the same project path.

---

## Summary checklist

| Step | What to do |
|------|------------|
| 1 | Install/run Paperclip: `npx paperclipai onboard --yes` (or clone + `pnpm dev`) in a folder that is **not** story-writing-app. |
| 2 | Open http://localhost:3100 and create a company if needed. |
| 3 | Create a project with workspace path = `/Users/tim/code/story-writing-app`. |
| 4 | Create a goal (e.g. “Build the story-writing-app”). |
| 5 | Hire a Codex (local) agent with `cwd` = `/Users/tim/code/story-writing-app`. |
| 6 | Enable heartbeats for that agent. |
| 7 | Create a task in the project, assign it to Codex; it will run on the next heartbeat. |

---

## Board: Verify and merge the PR

When a **Review and merge: BIN-XX** ticket lands in your queue, Code Reviewer has approved the implementation and already created a GitHub PR for you.

**Normal flow:**

1. Open the **PR URL** in the merge ticket (e.g. `https://github.com/tmat06/story-writing-app/pull/4`).
2. Verify the diff looks right — it should contain only Code Monkey’s changes for that ticket.
3. Click **Merge pull request** on GitHub.
4. After merging, pull and rebuild locally: `git pull origin main` then restart the dev server.

That’s it. The PR is already open and approved — you just need to merge it.

**If the ticket has a compare URL instead of a PR URL** (fallback case where `gh pr create` failed):

1. Open the compare URL (e.g. `https://github.com/tmat06/story-writing-app/compare/main...ticket/BIN-64`).
2. Click **Open pull request**, review, and merge.

**If merged PRs don’t seem to change the app:**

1. **Push never reached GitHub** — check the implementation ticket for a "push failed" comment. If the branch isn’t on origin, the agent’s push failed and you’ll need to push manually or re-run Code Monkey.
2. **App not rebuilt** — after merging, always run `git pull origin main` and restart the dev server.
3. **Wrong branch** — verify the PR head branch matches the ticket identifier (e.g. `ticket/BIN-64`).

**Founding Engineer** only writes the implementation plan. **Code Monkey** commits and pushes code. **Code Reviewer** creates the PR. You only merge.

---

## Release a stuck checkout (board)

When a run fails (e.g. rate limit, `process_lost`, timeout) and that run had **checked out** an issue, the issue stays locked. The assignee will get **409 Conflict** on their next checkout and cannot continue until the checkout is released.

**Automated flow (clone-and-cancel):** Agents post a comment containing `Checkout release requested: 409` when they get 409 on checkout. The CEO, on each heartbeat, scans for that phrase and then: posts the board comment below, cancels and unassigns the old issue, creates a new issue with the same title and a description that includes the original description plus all comments formatted as `[Agent Name]:` blocks, assigns the new issue to the last `Assign to:` in the thread, and sets the new issue to **Todo**. The assignee (e.g. Founding Engineer) gets the new issue with no checkout lock and continues there. You do not need to release manually unless you prefer to keep the same issue id.

**When to do this:** You see a failed run for an issue (e.g. "Process lost" or "Transcript (0)") and the same issue is still assigned to an agent who should keep working on it. On the agent's next heartbeat they will try to checkout and get 409.

**Option 1 – Paperclip UI**

- Open the issue in the Paperclip UI.
- If there is a **Release**, **Unlock**, or **Release checkout** action (on the issue or in a run/activity menu), use it. That clears the checkout; the issue remains assigned so the agent can checkout again on their next run.

**Option 2 – API**

- Call the release endpoint with your Paperclip authentication (same auth you use for the UI, e.g. session cookie or API key):

  ```http
  POST {PAPERCLIP_API_URL}/api/issues/{issueId}/release
  Authorization: Bearer <your-token>
  ```

  Use the issue's **id** or **identifier** as `{issueId}` (e.g. the value from the issue URL, such as `BIN-61` or the internal id if the API expects it). Base URL is typically `http://localhost:3100` when running Paperclip locally.

- No request body is required. After a successful response, the issue is no longer checked out; leave it in `todo` or `in_progress` and assigned to the same agent so they can checkout again on their next heartbeat.

**After release:** Ensure the issue status is `todo` or `in_progress` (not `backlog`) so it appears in the assignee's inbox. Then let normal heartbeats run; see **docs/ASSIGNMENT_CONVENTION.md** (§ After rate limit or process loss) for the full recovery flow.

---

## Troubleshooting

- **“codex not found” when Paperclip runs the agent**  
  Paperclip runs in its own environment. Ensure the `codex` binary is on the **system PATH** used by the process that runs Paperclip (e.g. the same shell where you run `pnpm dev`, or the user’s login PATH). If you use nvm, run `pnpm dev` from a terminal where `which codex` works.

- **Agent does nothing**  
  Check: (1) Heartbeats are enabled and interval is set. (2) Task is assigned to the Codex agent. (3) Task status is `todo` or `in_progress` (not blocked/cancelled). (4) In the UI, check the agent’s runs/logs for errors.

- **Codex can’t see the repo**  
  Ensure the project’s workspace path (and the agent’s `cwd`) is exactly `/Users/tim/code/story-writing-app` (no typo, no trailing slash needed).

- **CODEX_HOME**  
  Set `export CODEX_HOME="$HOME/.codex"` (and add to `~/.zshrc` if you want) so Paperclip and Codex both use the same skills directory.

- **`curl: (3) URL rejected: No host part in the URL`**  
  The agent is calling the Paperclip API with an empty or relative URL. **Cause:** `PAPERCLIP_API_URL` is not set (or is empty) in the run environment when Paperclip starts the agent. The adapter must inject the full base URL (e.g. `http://localhost:3100`) so the agent can build URLs like `${PAPERCLIP_API_URL}/api/agents/me`. Fix: In Paperclip, check the agent’s adapter config and the run/env payload; ensure the control-plane URL is passed as `PAPERCLIP_API_URL` for every run (including `issue_assigned` and other wake reasons). If you use `paperclipai agent local-cli`, confirm the printed env includes `PAPERCLIP_API_URL`.

- **Code Monkey / agent: git push fails (`could not read Username for 'https://github.com'`)**  
  The agent runs in a process started by Paperclip. That process often doesn’t have your SSH agent or GitHub credentials. Use one of the following.

  **Option A – SSH available to the process that runs Paperclip**

  1. Use SSH for the repo (you already have this):
     ```bash
     cd /Users/tim/code/story-writing-app
     git remote set-url origin git@github.com:YOUR_ORG/story-writing-app.git
     ```
  2. Start Paperclip from a terminal where SSH works:
     - Open a terminal and run `ssh -T git@github.com`; it should say "Hi ...! You've successfully authenticated."
     - In that same terminal, start Paperclip (e.g. `cd ~/paperclip && pnpm dev`). Do not close the terminal; leave it running.
     - When Paperclip starts Codex, it inherits that shell’s environment. If your SSH key is in the agent (`ssh-add -l` shows it), the Codex subprocess can use it and `git push` can succeed.
  3. If Paperclip is started another way (e.g. backgrounded, or by a different user), that process may not have `SSH_AUTH_SOCK` set. Then either:
     - Start Paperclip from an interactive terminal as above and keep it running there, or
     - Use Option B (token) so push doesn’t depend on SSH.

  **Option B – HTTPS with a token (works even if SSH isn’t available to the agent)**

  1. Create a GitHub **Personal Access Token (PAT)** with `repo` scope: GitHub → Settings → Developer settings → Personal access tokens → Generate new token. Copy the token once; you won’t see it again.
  2. In the repo the agent uses (e.g. `/Users/tim/code/story-writing-app`), set the remote to HTTPS if it isn’t already:
     ```bash
     cd /Users/tim/code/story-writing-app
     git remote set-url origin https://github.com/YOUR_ORG/story-writing-app.git
     ```
  3. Configure Git to use the token non-interactively **for the environment that runs the agent**:
     - **Option B1 – credential.helper store (use only on a machine you control):**  
       In the same shell/environment from which Paperclip is started (so the agent inherits it), run once:
       ```bash
       git config --global credential.helper store
       ```
       Then run one interactive push so Git stores the token:
       ```bash
       cd /Users/tim/code/story-writing-app
       git push origin main
       ```
       When prompted, username = your GitHub username, password = the PAT. After that, pushes from that user’s environment (including the agent) will use the stored token.
     - **Option B2 – GIT_ASKPASS script (no stored password file):**  
       Create a small script that echoes the token (e.g. `echo "$GITHUB_TOKEN"`), make it executable, and set `GIT_ASKPASS` to that script and `GITHUB_TOKEN` to your PAT in the environment that starts Paperclip. Then Git will use that when it needs credentials. Keep the script and token secure (e.g. only you can read the file; don’t commit the script with the token).
  4. Restart Paperclip (or ensure it’s started with the same env that has the credential helper or GIT_ASKPASS). The next time Code Monkey runs `git push`, it should succeed.
