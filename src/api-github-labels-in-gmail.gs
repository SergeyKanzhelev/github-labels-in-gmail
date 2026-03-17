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
 * Creates triggers to run the script on a schedule.
 * Deletes any existing triggers before creating new ones.
 */
function setup() {
  // Deletes all triggers in the current project.
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }
  console.log('Deleted all existing triggers.');

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
