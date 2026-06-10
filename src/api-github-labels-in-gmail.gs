/**
 * ENTRY POINTS
 * These functions are intended to be run manually or by triggers.
 * Implementation details are located in the other .gs files.
 */


function processGitHubEmails() {
  processGitHubEmailsImpl();
}

/**
 * Wrapper function to run all processing tasks.
 * This is the target for all time-based triggers.
 */
function processAll() {
  processGitHubEmailsImpl();
}

/**
 * Compares current Gmail filters with the GMAIL_FILTERS configuration.
 * Generates and logs a diff of changes needed to synchronize them.
 * Does NOT apply any changes.
 */
function reconcileGmailFilters() {
  reconcileGmailFiltersImpl();
}

/**
 * Actually applies the changes to synchronize Gmail filters with configuration.
 * - Creates missing filters.
 * - Deletes extra filters not in the config.
 */
function applyGmailFiltersReconciliation() {
  applyGmailFiltersReconciliationImpl();
}

/**
 * Process old GitHub email threads (older than 150 days) using the prepackaged closed data.
 * Threads already carrying a k8s/merged or k8s/closed label are skipped.
 */
function processOldThreads() {
  if (!initLabelCache()) {
    return;
  }
  const query = 'from:notifications@github.com older_than:150d';
  let offset = 0;
  let threads;

  let matched = 0;
  let notFound = 0;
  let skipped = 0;
  let total = 0;

  while (true) {
    threads = GmailApp.search(query, offset, MAX_THREADS);
    if (threads.length === 0) {
      break;
    }
    offset += threads.length;

    threads.forEach(thread => {
      total++;
      try {
        const subject = thread.getFirstMessageSubject();
        const issueKey = extractIssueKey(subject);
        const existingLabels = new Set(thread.getLabels().map(l => l.getName()));

        if (existingLabels.has('k8s/merged') || existingLabels.has('k8s/closed')) {
          skipped++;
          return; // already labeled
        }

        const closedStatus = getClosedStatus(subject);
        if (closedStatus === 'merged') {
          const label = getOrCreateLabel('k8s/merged');
          thread.addLabel(label);
          console.log(`OLD Thread ${thread.getId()}: Applied k8s/merged (${issueKey}) — "${subject}"`);
          matched++;
        } else if (closedStatus === 'closed') {
          const label = getOrCreateLabel('k8s/closed');
          thread.addLabel(label);
          console.log(`OLD Thread ${thread.getId()}: Applied k8s/closed (${issueKey}) — "${subject}"`);
          matched++;
        } else {
          console.log(`OLD Thread ${thread.getId()}: No match (${issueKey || 'no key'}) — "${subject}"`);
          notFound++;
        }
      } catch (e) {
        console.log(`Error processing old thread ${thread.getId()}: ${e && e.message}`);
      }
    });

    console.log(`Progress: processed ${total} threads so far (matched: ${matched}, skipped: ${skipped}, not found: ${notFound})`);
  }

  console.log(`Old threads done. Total: ${total}, Matched: ${matched}, Skipped: ${skipped}, Not found: ${notFound}`);
}

/**
 * Deletes all triggers in the current project.
 */
function deleteTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }
  console.log(`Deleted ${triggers.length} trigger(s).`);
}

/**
 * Creates triggers to run the script on a schedule.
 * Deletes any existing triggers before creating new ones.
 */
function setup() {
  deleteTriggers();
  // Create triggers to run every 10 minutes between 8am and 9am.
  for (let minute = 0; minute < 60; minute += 10) {
    ScriptApp.newTrigger('processAll')
        .timeBased()
        .atHour(8)
        .nearMinute(minute)
        .everyDays(1)
        .create();
  }
  console.log('Created triggers to run every 10 minutes between 8am and 9am.');

  // Create triggers to run once per hour between 9am and 6pm (18:00).
  for (let hour = 9; hour <= 18; hour++) {
    ScriptApp.newTrigger('processAll')
        .timeBased()
        .atHour(hour)
        .nearMinute(0)
        .everyDays(1)
        .create();
  }
  console.log('Created triggers to run once per hour between 9am and 6pm.');
  
  console.log('All triggers have been set up successfully.');
}
