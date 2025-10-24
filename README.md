# GitHub → Gmail Labels (Minimal + Robust, Allow-List)

*Automatically create/add labels to emails using GitHub's `X-GitHub-Labels` header.*

This Apps Script scans recent GitHub notification emails and applies **only the labels you allow** as Gmail labels (e.g., `gh/kind/bug`, `gh/sig/docs`).

Inspired by: https://gist.github.com/jimangel/457068192e616029bd2564585a45ddd0

## What it does

* Reads `X-GitHub-Labels` (case-insensitive, folded lines OK).
* Splits labels on **`;` or `,`** (outside quotes) and handles `""` escaped quotes.
* Applies Gmail labels as `gh/<original-label>` (keeps `/` nesting by default).
* **Allow-list only**: labels are applied **only** if they match your patterns.

**Example Gmail searches**

* `label:"gh/kind/bug"`
* `label:"gh/sig/docs"`
* `label:"gh/cncf-cla: yes"` (quote labels with `:` or space)

## Requirements

* Gmail + Google Apps Script (free).
* You receive GitHub notifications from `notifications@github.com`.

## Install

1. **Open Apps Script**: [https://script.google.com](https://script.google.com) → **New project** → name it (e.g., *GitHub Email Labels*).
2. **Paste code**: replace `Code.gs` with the content of `github-labels-in-gmail.gs`
3. **Save** (disk icon).


## First run (authorize)

<img width="795" height="414" alt="image" src="https://gist.github.com/user-attachments/assets/9b6f6826-aee4-4c29-8598-722f58b5e8ee" />

1. In the functions dropdown (bar), choose **`test`** (or `processGitHubEmails`) → **Run** → authorize → **Allow**.
2. Check **View → Executions** (or **Logs**) for results.

> On first run, labels are created on demand.

## Automate (Setup)

After the first run, you need to set up a trigger to run the script automatically.

1. In the functions dropdown, choose **`setup`** → **Run**.
2. Authorize the script if prompted (this requires the `script.scriptapp` scope).

This will create a time-based trigger that runs `processGitHubEmails` every 5 minutes. You only need to run `setup` once.

## Testing & Verification

After running one test, you should see your sidebar has labels now:

<img width="241" height="471" alt="image" src="https://gist.github.com/user-attachments/assets/26a80426-60fd-4711-a421-e1741b70d452" />

## Uninstall

* Delete the time-based trigger.
* Optionally delete `gh/...` labels in Gmail.
* Remove the Apps Script project.


## Automated Deployment (Optional)

This is an alternative to the manual installation steps above.

1. **Install dependencies**:

   ```bash
   make install
   ```

2. **Login to clasp**:

   ```bash
   make login
   ```

3. **Create the script project**:
   This will create a new Apps Script project in your Google Drive and a `.clasp.json` file in this directory.

   ```bash
   make create
   ```

4. **Push the code**:

   ```bash
   make push
   ```

5. **Run setup**:
   After the first push, you need to run the `setup` function once from the Apps Script editor to create the trigger that will automatically process your emails. See the "Automate (Setup)" section above for details.

   TODO: enable execution via makefile on push. See this guide: https://github.com/google/clasp/blob/master/docs/run.md