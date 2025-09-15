/**
 * GitHub → Gmail (labels-only, allow-list + ; parsing)
 * - Reads X-GitHub-Labels (case-insensitive, folded headers OK)
 * - Parses labels separated by ";" or "," (outside quotes)
 * - Applies ONLY labels that match ALLOW (exact or prefix* glob)
 * - Applies Gmail labels as: gh/<original-label>
 * - Marks threads with gh/processed so we don't reprocess
 */

const QUERY        = 'from:notifications@github.com newer_than:30d -label:"gh/processed"';
const MAX_THREADS  = 100;
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

function processGitHubEmails() {
  const threads = GmailApp.search(QUERY, 0, MAX_THREADS);
  const processedLabel = getOrCreateLabel(PROCESSED);

  threads.forEach(thread => {
    try {
      const message = thread.getMessages().pop();
      const header = getGitHubLabelsHeader(message);
      if (!header) {
        thread.addLabel(processedLabel);
        return;
      }

      // Parse labels split by ";" or "," outside quotes
      const parsed = splitQuotedMulti(header, [';', ',']);

      // Trim + de-dupe (case-insensitive), then filter by ALLOW
      const seen = new Set();
      for (const raw of parsed) {
        const lbl = raw.trim();
        if (!lbl) continue;

        const key = lbl.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        if (!isAllowed(lbl)) continue; // <- only apply allowed labels

        const finalSegment = KEEP_SLASHES ? lbl : lbl.replace(/\//g, '／');
        thread.addLabel(getOrCreateLabel(`${ROOT_PREFIX}${finalSegment}`));
      }

      // mark as processed so future runs skip it (without changing read state)
      thread.addLabel(processedLabel);

    } catch (e) {
      console.log(`Error processing thread ${thread.getId()}: ${e && e.message}`);
    }
  });
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

// Labels are created lazily; idempotent
function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Manual runner
function test() { processGitHubEmails(); }

/**
 * Sets up a time-based trigger to run the processGitHubEmails function every 5 minutes.
 * This function should be run once after deploying the script.
 * It deletes any existing triggers for the function to prevent duplicates.
 */
function setup() {
  const functionName = 'processGitHubEmails';
  
  // Delete existing triggers for this function to prevent duplicates
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create a new trigger to run every 5 minutes
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyMinutes(5)
    .create();
  
  console.log(`Trigger created for ${functionName} to run every 5 minutes.`);
}
