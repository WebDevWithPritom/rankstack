# GitHub Team Collaboration & Project Lead Playbook

This document is the official operational guide for managing the RankStack repository. It covers repository administration for the Project Lead (Boss) and the exact Git workflow that all developers must follow.

---

## 1. Roles and Responsibilities

* **Project Lead (Boss):**
  * Repository Owner and Administrator.
  * Owns the `master` branch.
  * Reviews, tests, approves, and merges all Pull Requests (PRs).
  * Manages production deployments to the live server.
  * No code enters `master` without the Lead's explicit approval.

* **Contributing Developers:**
  * Work strictly on isolated feature branches.
  * Never commit directly to `master`.
  * Open Pull Requests with clear descriptions and testing verification.
  * Address review comments and revise code as requested by the Lead.

---

## 2. One-Time GitHub Repository Setup (For the Project Lead)

Complete these steps in GitHub to protect the repository and invite developers:

### Step 1: Invite the Developers
1. Go to your repository on GitHub: `https://github.com/WebDevWithPritom/rankstack`
2. Click **Settings** (tab at the top right).
3. In the left sidebar, click **Collaborators** (under "Access").
4. Click the green **Add people** button.
5. Enter the developer's GitHub username or email address and click **Add to this repository**.
6. An invitation link will be sent to the developer. Once they accept, they can push branches to the repository.

### Step 2: Set Up Branch Protection Rules (Protect `master`)
This ensures developers cannot accidentally overwrite or push broken code directly to `master`.

1. In repository **Settings**, click **Branches** in the left sidebar.
2. In the "Branch protection rules" section, click **Add branch ruleset** or **Add rule**.
3. Under **Branch name pattern**, enter: `master`
4. Check the following protection settings:
   * **Require a pull request before merging:**
     * Check **Require approvals** (Set to `1`).
     * Check **Dismiss stale pull request approvals when new commits are pushed**.
   * **Require status checks to pass before merging** (if automated CI is enabled).
   * **Do not allow bypassing the above settings:** Ensures even admins follow the PR review process.
   * **Restrict deletions:** Prevents anyone from deleting the `master` branch.
   * **Block force pushes:** Prevents `git push --force` from overwriting git history.
5. Click **Create** or **Save changes** at the bottom.

---

## 3. The Developer Workflow (Rules for Developers)

Every developer must follow this 7-step development loop for every single task:

### Step 1: Start from the Latest Master
Before starting any new task, ensure your local `master` is identical to GitHub:
```bash
git checkout master
git pull origin master
```

### Step 2: Create a Dedicated Feature Branch
Never write code on `master`. Create a new branch named with a prefix:
* Features: `feature/<task-name>`
* Bug fixes: `fix/<bug-name>`
* Documentation: `docs/<topic>`

Example:
```bash
git checkout -b feature/dataforseo-backlinks
```

### Step 3: Write and Test Your Code Locally
Make your changes inside `rank-stack/`. Test your code on your local WordPress site (e.g. Laragon or LocalWP):
* Ensure no PHP fatal errors or warnings exist in `debug.log`.
* Ensure no JavaScript console errors appear in the browser (F12 Developer Tools).

### Step 4: Check Status and Stage Changes
Check what files you have modified:
```bash
git status
```
Stage only the relevant files for your task:
```bash
git add rank-stack/includes/class-rankstack-db.php
git add rank-stack/assets/js/rankstack-dashboard.js
```
Or stage all modified files:
```bash
git add .
```

### Step 5: Commit with Clear, Structured Messages
Use standard commit prefixes:
* `feat:` for new features
* `fix:` for bug fixes
* `refactor:` for code restructuring without changing behavior
* `docs:` for documentation updates

Example:
```bash
git commit -m "feat: integrate DataForSEO backlinks overview live endpoint"
```

### Step 6: Push the Feature Branch to GitHub
```bash
git push -u origin feature/dataforseo-backlinks
```

### Step 7: Open a Pull Request (PR) on GitHub
1. Go to `https://github.com/WebDevWithPritom/rankstack`
2. You will see a banner: *"feature/dataforseo-backlinks had recent pushes"*. Click **Compare & pull request**.
3. Fill out the Pull Request template:
   * What was changed
   * What task or spec requirement it satisfies
   * How you tested it
4. Assign the Project Lead as the **Reviewer**.
5. Click **Create pull request**.

---

## 4. The Project Lead (Boss) Workflow: Reviewing & Merging Code

As the Project Lead, you decide what code enters production. Follow this review routine:

### Step 1: Receive PR Notification
When a developer opens a PR, you receive an email or GitHub notification. Open the PR link.

### Step 2: Review Code Changes (The Diff)
1. In the PR, click the **Files changed** tab.
2. Review every single line of code added (green) or removed (red).
3. Look for the following quality and security standards:
   * **SQL Security:** Are queries using `$wpdb->prepare()`? No raw concatenated strings in SQL queries.
   * **Input Sanitization:** Are user inputs sanitized using `sanitize_text_field()`, `esc_url_raw()`, or `intval()`?
   * **Output Escaping:** Are variables escaped with `esc_html()`, `esc_attr()`, or `esc_url()`?
   * **No Hardcoded Credentials:** Are API keys loaded from options or environment variables, not written into code?
   * **Performance:** Are external API responses cached using WordPress transients (`set_transient`)?

### Step 3: Leave Line Comments or Request Changes
* If you see an issue or want something improved, hover over the line number in the diff, click the blue **+** icon, and leave a comment:
  * Example: *"Please sanitize this parameter with sanitize_text_field() before using it in the query."*
* Click **Start a review**. When finished, select **Request changes** and submit.
* The developer will make changes, commit, and push to their branch. The PR will automatically update.

### Step 4: Testing the Branch Locally (Optional but Recommended)
Before approving, you can test their branch on your local machine:
```bash
git fetch origin
git checkout feature/dataforseo-backlinks
```
Test the feature in your browser. When satisfied, switch back:
```bash
git checkout master
```

### Step 5: Approve and Merge
1. Once code quality is verified, go to the PR, click **Review changes** -> **Approve**.
2. Scroll to the bottom of the PR and click the dropdown arrow next to the merge button.
3. Select **Squash and merge**.
   * *Why Squash and merge:* It combines all developer commits into one clean commit on `master`, keeping git history clean and readable.
4. Click **Confirm Squash and merge**.
5. Click **Delete branch** on GitHub to keep the repository tidy.

### Step 6: Deploy to Live Server
Once merged into `master`, update your local copy and deploy:
```bash
git checkout master
git pull origin master
```
Deploy the updated files in `rank-stack/` to the live Hostinger server via FTP or deployment script.

---

## 5. How to Handle Merge Conflicts (Simple Guide)

A merge conflict happens when two developers edit the exact same line of code in the same file.

### How Developers Resolve a Conflict:
1. Ensure your feature branch is checked out:
   ```bash
   git checkout feature/my-feature
   ```
2. Pull the latest master into your branch:
   ```bash
   git pull origin master
   ```
3. Git will output: `CONFLICT (content): Merge conflict in ...`
4. Open the conflicting file in VS Code or your code editor. You will see markers:
   ```
   <<<<<<< HEAD (Current Change - your code)
   $table_links = RankStack_DB::get_table('links');
   =======
   $table_links = $wpdb->prefix . 'rankstack_links';
   >>>>>>> master (Incoming Change from master)
   ```
5. Decide which code to keep, delete the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), and save the file.
6. Stage and commit the resolved file:
   ```bash
   git add rank-stack/includes/class-rankstack-db.php
   git commit -m "fix: resolve merge conflict with master"
   git push origin feature/my-feature
   ```
7. The PR on GitHub will now show: *"This branch has no conflicts with the base branch"* and can be merged.

---

## 6. Emergency Rollback: Reverting Bad Code

If a bug is discovered in production after a merge:
1. Open the closed PR on GitHub.
2. Scroll to the bottom and click the **Revert** button.
3. GitHub automatically creates a new PR that cleanly undoes the changes.
4. Merge the revert PR into `master` and deploy to restore the previous stable version immediately.
