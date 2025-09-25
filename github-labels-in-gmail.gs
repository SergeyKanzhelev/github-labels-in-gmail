/**
 * GitHub → Gmail (labels-only, allow-list + ; parsing)
 * - Reads X-GitHub-Labels (case-insensitive, folded headers OK)
 * - Parses labels separated by ";" or "," (outside quotes)
 * - Applies ONLY labels that match ALLOW (exact or prefix* glob)
 * - Applies Gmail labels as: gh/<original-label>
 * - Marks threads with gh/processed so we don't reprocess
 */

const QUERY        = 'from:notifications@github.com newer_than:30d -label:"gh/processed"';
const MAX_THREADS  = 500;
const ROOT_PREFIX  = 'gh/';
const PROCESSED    = 'gh/processed';
const KEEP_SLASHES = true; // true -> nested labels (gh/area/kubelet). false -> replace "/" with fullwidth slash.

/**
 * EXPLICIT allow-list. Only labels matching one of these patterns will be applied.
 * Matching is case-insensitive.
 * - Exact: "kind/bug"
 * - Prefix glob: "sig/docs*" matches "sig/docs" and "sig/docs/anything"
 * Examples below — edit for your needs.
 */
const ALLOW = [
  'kind/bug',
  'kind/cleanup',
  'kind/documentation',
  'sig/node',
  'lgtm',
  'approved',
  'do-not-merge/work-in-progress',
];

// Global cache for Gmail labels to avoid API limits.
const LABEL_CACHE = {};
let IS_CACHE_INITIALIZED = false;

/**
 * Initializes the label cache by fetching all user labels from Gmail.
 * This should be called once at the beginning of any script execution.
 * @returns {boolean} True if the cache was initialized successfully, false otherwise.
 */
function initLabelCache() {
  if (IS_CACHE_INITIALIZED) {
    return true;
  }
  try {
    GmailApp.getUserLabels().forEach(label => {
      LABEL_CACHE[label.getName()] = label;
    });
    IS_CACHE_INITIALIZED = true;
    console.log('Label cache initialized successfully.');
    return true;
  } catch (e) {
    console.log(`FATAL: Error initializing label cache: ${e.message}. Aborting execution.`);
    return false;
  }
}

function processGitHubEmails() {
  if (!initLabelCache()) {
    return; // Exit if cache initialization fails.
  }
  const processedLabel = getOrCreateLabel(PROCESSED);
  const otherSigLabel = getOrCreateLabel(`${ROOT_PREFIX}other-sig`);
  let threadsConsidered = 0;
  let processedCount = 0;
  let labelsAppliedCount = 0;
  let offset = 0;
  let threads;

  while (true) {
    threads = GmailApp.search(QUERY, offset, MAX_THREADS);
    if (threads.length === 0) {
      break;
    }
    offset += threads.length;

    threads.forEach(thread => {
      threadsConsidered++;
      try {
        const message = thread.getMessages().pop();
        const header = getGitHubLabelsHeader(message);
        if (!header) {
          return;
        }

        // Parse labels split by ";" or "," outside quotes
        const parsed = splitQuotedMulti(header, [';', ',']);

        const seen = new Set();
        let hasNeedsSig = false;
        let hasSigLabel = false;
        let hasOtherSig = false;
        let hasAllowedSig = false;

        for (const raw of parsed) {
          const lbl = raw.trim();
          if (!lbl) continue;

          const key = lbl.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          if (key === 'needs-sig') {
            hasNeedsSig = true;
          }
          if (key.startsWith('sig/')) {
            hasSigLabel = true;
            if (!isAllowed(lbl)) {
              hasOtherSig = true;
            } else {
              hasAllowedSig = true
            }
          }

          if (isAllowed(lbl)) {
            thread.addLabel(getOrCreateLabel(formatLabelName(lbl)));
            labelsAppliedCount++;
          }
        }

        if (hasOtherSig && !hasAllowedSig) {
          thread.addLabel(otherSigLabel);
          labelsAppliedCount++;
        }

        // Only mark as processed if it has a sig label and not 'needs-sig'.
        if (!hasNeedsSig && hasSigLabel) {
          thread.addLabel(processedLabel);
          processedCount++;
        }
      } catch (e) {
        console.log(`Error processing thread ${thread.getId()}: ${e && e.message}`);
      }
    });
  }

  console.log(`Processing complete. Considered: ${threadsConsidered}, Processed: ${processedCount}, Labels applied: ${labelsAppliedCount}`);
}

function reprocessMissingSigLabels() {
  if (!initLabelCache()) {
    return; // Exit if cache initialization fails.
  }
  const otherSigLabelName = `${ROOT_PREFIX}other-sig`;
  const otherSigLabel = getOrCreateLabel(otherSigLabelName);
  let query = `label:"${PROCESSED}" -label:"${otherSigLabelName}"`;

  // Exclude threads that already have an allowed sig label.
  const allowedSigs = ALLOW.filter(p => p.toLowerCase().startsWith('sig/'));
  for (const pat of allowedSigs) {
    let labelName = pat.toLowerCase();
    // For globs like 'sig/docs*', we exclude the base label name. This isn't perfect
    // but prevents reprocessing for the most common cases.
    if (labelName.endsWith('*')) {
      labelName = labelName.slice(0, -1);
    }
    const fullLabelName = formatLabelName(labelName);
    query += ` -label:"${fullLabelName}"`;
  }

  let threadsConsidered = 0;
  let labelsReappliedCount = 0;
  let offset = 0;
  let threads;

  while (true) {
    threads = GmailApp.search(query, offset, MAX_THREADS);
    if (threads.length === 0) {
      break;
    }
    offset += threads.length;

    threads.forEach(thread => {
      threadsConsidered++;
      try {
        const message = thread.getMessages().pop();
        const header = getGitHubLabelsHeader(message);
        if (!header) {
          return; // Nothing to do if no labels header
        }

        // Parse labels split by ";" or "," outside quotes
        const parsed = splitQuotedMulti(header, [';', ',']);

        // Trim + de-dupe (case-insensitive), then filter by ALLOW
        const seen = new Set();
        let hasOtherSig = false;
        let hasAllowedSig = false;
        for (const raw of parsed) {
          const lbl = raw.trim();
          if (!lbl) continue;

          const key = lbl.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          if (key.startsWith('sig/')) {
            if (!isAllowed(lbl)) {
              hasOtherSig = true;
            } else {
              hasAllowedSig = true;
            }
          }

          if (isAllowed(lbl)) {
            thread.addLabel(getOrCreateLabel(formatLabelName(lbl)));
            labelsReappliedCount++;
          }
        }

        if (hasOtherSig && !hasAllowedSig) {
          thread.addLabel(otherSigLabel);
          labelsReappliedCount++;
        }
      } catch (e) {
        console.log(`Error reprocessing thread ${thread.getId()}: ${e && e.message}`);
      }
    });
  }

  console.log(`Reprocessing complete. Re-evaluated: ${threadsConsidered}, Labels re-applied: ${labelsReappliedCount}`);
}

// ---- Helpers ----

// Case-insensitive header fetch with folded-lines fallback
function getGitHubLabelsHeader(message) {
  const direct =
    message.getHeader('X-GitHub-Labels') ||
    message.getHeader('X-Github-Labels');
  if (direct) return direct;

  const raw = message.getRawContent();
  return extractFoldedHeader(raw, 'x-github-labels');
}

function extractFoldedHeader(raw, headerNameLower) {
  const lines = raw.split(/\r?\n/);
  let collecting = false, value = '';
  const startRe = new RegExp(`^${escapeRe(headerNameLower)}\\s*:`, 'i');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!collecting) {
      if (startRe.test(line)) {
        collecting = true;
        value = line.replace(startRe, '').trim();
      }
    } else {
      if (/^[ \t]/.test(line)) {
        value += ' ' + line.trim();
      } else {
        break;
      }
    }
  }
  return value || null;
}

// Split on any of the delimiters provided (e.g., ";" or ",") outside quotes.
// Supports double-quote escaping with "" inside quoted segments.
function splitQuotedMulti(input, delimiters) {
  if (!input) return [];
  const delimSet = new Set(delimiters);
  const out = [];
  let cur = '';
  let inQ = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (ch === '"') {
      if (inQ && input[i + 1] === '"') { // escaped quote
        cur += '"'; i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }

    if (!inQ && delimSet.has(ch)) {
      out.push(cur.trim());
      cur = '';
      continue;
    }

    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

// Allow-list matcher: case-insensitive exact or prefix* glob
function isAllowed(label) {
  const ll = label.toLowerCase();
  for (const pat of ALLOW) {
    const p = String(pat || '').toLowerCase().trim();
    if (!p) continue;

    if (p.endsWith('*')) {
      const prefix = p.slice(0, -1);
      if (ll.startsWith(prefix)) return true;
    } else if (ll === p) {
      return true;
    }
  }
  return false;
}

/**
 * Gets a Gmail label by name from the cache, creating it if it doesn't exist.
 * Relies on the global LABEL_CACHE, which must be initialized first via initLabelCache().
 * @param {string} name The name of the label.
 * @returns {GmailApp.Label} The label object.
 */
function getOrCreateLabel(name) {
  if (LABEL_CACHE[name]) {
    return LABEL_CACHE[name];
  }
  // If it's not in the cache, it needs to be created.
  try {
    const label = GmailApp.createLabel(name);
    LABEL_CACHE[name] = label;
    return label;
  } catch (e) {
    console.log(`Error creating label "${name}": ${e.message}`);
    throw e; // Re-throw, as this is a significant issue during processing.
  }
}

// Centralized label name formatter
function formatLabelName(label) {
  const finalSegment = KEEP_SLASHES ? label : label.replace(/\//g, '／');
  return `${ROOT_PREFIX}${finalSegment}`;
}


function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Manual runner
function test() { processGitHubEmails(); }
function testReprocess() { reprocessMissingSigLabels(); }

/**
 * Sets up all time-based triggers for the script.
 * This function should be run once after deploying or updating the script.
 * It deletes all existing triggers to prevent duplicates and then creates fresh ones.
 */
function setup() {
  // Configuration for all triggers
  const triggers = [
    { functionName: 'processGitHubEmails', frequencyHours: 1 / 12 }, // 5 minutes
    { functionName: 'reprocessMissingSigLabels', frequencyHours: 1 },      // 1 hour
  ];

  // Delete all existing project triggers to have a clean slate
  ScriptApp.getProjectTriggers().forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  console.log('Deleted all existing triggers.');

  // Create new triggers based on the configuration
  triggers.forEach(config => {
    const { functionName, frequencyHours } = config;
    const triggerBuilder = ScriptApp.newTrigger(functionName).timeBased();

    const frequencyText =
      frequencyHours < 1
        ? `${Math.round(frequencyHours * 60)} minutes`
        : `${frequencyHours} hour(s)`;

    if (frequencyHours < 1) {
      triggerBuilder.everyMinutes(Math.round(frequencyHours * 60));
    } else {
      triggerBuilder.everyHours(frequencyHours);
    }
    triggerBuilder.create();
    console.log(`Trigger created for ${functionName} to run every ${frequencyText}.`);
  });
  
  console.log('All triggers have been set up successfully.');
}
