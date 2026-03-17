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

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
