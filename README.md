# GitHub → Gmail Labels (Modular & Robust)

*Automatically create/add labels to emails using GitHub's `X-GitHub-Labels` header and manage Gmail filters via configuration.*

This Apps Script scans recent GitHub notification emails and applies **only the labels you allow** as Gmail labels (e.g., `gh/kind/bug`, `gh/sig/docs`). It also allows you to manage your Gmail filter rules through a JavaScript configuration file.

Inspired by: https://gist.github.com/jimangel/457068192e616029bd2564585a45ddd0

## What it does

* **GitHub Labeling**: Reads `X-GitHub-Labels`, splits them on `;` or `,`, and applies them to threads using an allow-list.
* **Filter Management**: Synchronize your Gmail filters from a local configuration (`src/filters/config.gs`).
* **Utilities**:
    * `reconcileGmailFilters`: Previews the differences between your config and your actual Gmail filters.
    * `applyGmailFiltersReconciliation`: Synchronizes your Gmail account with your filter configuration.

**Example Gmail searches**

* `label:"gh/kind/bug"`
* `label:"gh/sig/docs"`

## Requirements

* Gmail + Google Apps Script.
* You receive GitHub notifications from `notifications@github.com`.
* [clasp](https://github.com/google/clasp) (recommended for managing multiple files).

## Installation (via clasp)

This project is organized into multiple files and is best managed using `clasp`.

1. **Install dependencies**:
   ```bash
   make install
   ```
2. **Login to clasp**:
   ```bash
   make login
   ```
3. **Create the script project**:
   ```bash
   make create
   ```
4. **Push the code**:
   ```bash
   make push
   ```

## First run (authorize)

1. Open your project in the [Apps Script editor](https://script.google.com).
2. In the functions dropdown, choose **`processGitHubEmails`** → **Run** → authorize the requested scopes.
3. Check the logs for results.

## Automate (Setup)

To run the labeling logic automatically:

1. In the functions dropdown, choose **`setup`** → **Run**.
2. This creates triggers to run the processing logic on a regular schedule (8-9am every 10 mins, then hourly until 6pm).

## Managing Filters

1. Define your filters in `src/filters/config.gs`.
2. Run `reconcileGmailFilters` to see a diff.
3. Run `applyGmailFiltersReconciliation` to apply the changes (Create/Delete) to your Gmail account.

## Uninstall

* Delete the time-based triggers in the Apps Script editor.
* Optionally delete `gh/...` labels in Gmail.
* Remove the Apps Script project.
