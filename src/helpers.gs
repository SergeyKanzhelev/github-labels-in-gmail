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

/**
 * Wraps a Gmail thread and its last message into a context object for GitHub processing.
 * Parses relevant headers once and gathers existing labels.
 */
function createGitHubMessageContext(thread) {
  const message = thread.getMessages().pop();
  const existingLabels = new Set(thread.getLabels().map(l => l.getName()));
  
  const rawLabelsHeader = getGitHubLabelsHeader(message);
  const githubLabels = splitQuotedMulti(rawLabelsHeader, [';', ',']);
  
  return {
    thread: thread,
    message: message,
    existingLabels: existingLabels,
    githubLabels: githubLabels,
    prStatus: getGitHubPullRequestStatusHeader(message),
    issueState: getGitHubIssueStateHeader(message),
    
    // Internal state trackers for processing
    appliedLabelsCount: 0,
    
    /**
     * Adds a label to the thread only if it's not already present.
     * Updates appliedLabelsCount if a change was made.
     */
    addLabel: function(labelName) {
      if (this.existingLabels.has(labelName)) {
        return false;
      }
      const label = getOrCreateLabel(labelName);
      this.thread.addLabel(label);
      this.existingLabels.add(labelName);
      this.appliedLabelsCount++;
      return true;
    }
  };
}

// Case-insensitive header fetch with folded-lines fallback
function getGitHubLabelsHeader(message) {
  const direct =
    message.getHeader('X-GitHub-Labels') ||
    message.getHeader('X-Github-Labels');
  if (direct) return direct;

  const raw = message.getRawContent();
  return extractFoldedHeader(raw, 'x-github-labels');
}

function getGitHubPullRequestStatusHeader(message) {
  const direct =
    message.getHeader('X-GitHub-PullRequestStatus') ||
    message.getHeader('X-Github-PullRequestStatus');
  if (direct) return direct;

  const raw = message.getRawContent();
  return extractFoldedHeader(raw, 'x-github-pullrequeststatus');
}

function getGitHubIssueStateHeader(message) {
  const direct =
    message.getHeader('X-GitHub-IssueState') ||
    message.getHeader('X-Github-IssueState');
  if (direct) return direct;

  const raw = message.getRawContent();
  return extractFoldedHeader(raw, 'x-github-issuestate');
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

/**
 * Extracts "org/repo#number" from a GitHub notification email subject.
 * Subjects look like:
 *   "[kubernetes/enhancements] KEP-3085: prepare for GA (PR #6167)"
 *   "Re: [kubernetes/node-problem-detector] CVEs in v1.35.2 (Issue #1277)"
 */
function extractIssueKey(subject) {
  if (!subject) return null;
  const repoMatch = subject.match(/\[([^\]]+\/[^\]]+)\]/);
  const numMatch = subject.match(/\((?:Issue|PR) #(\d+)\)/);
  if (repoMatch && numMatch) {
    return repoMatch[1] + '#' + numMatch[1];
  }
  return null;
}

/**
 * Looks up an issue/PR in the prepackaged CLOSED_ITEMS map.
 * Returns "closed", "merged", or null.
 */
function getClosedStatus(subject) {
  if (typeof CLOSED_ITEMS === 'undefined') return null;
  const key = extractIssueKey(subject);
  if (!key) return null;
  const [repo, numStr] = key.split('#');
  const num = parseInt(numStr, 10);
  const entry = CLOSED_ITEMS[repo];
  if (!entry) return null;
  if (entry.merged && entry.merged.includes(num)) return 'merged';
  if (entry.closed && entry.closed.includes(num)) return 'closed';
  return null;
}

/**
 * Fetches labels for a GitHub issue/PR via the GitHub API.
 * Requires GITHUB_TOKEN script property to be set.
 * @param {string} issueKey "org/repo#number" format
 * @returns {string[]|null} Array of label names, or null if unavailable.
 */
function fetchGitHubLabels(issueKey) {
  if (!issueKey) return null;
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) return null;

  const [repo, numStr] = issueKey.split('#');
  const url = `https://api.github.com/repos/${repo}/issues/${numStr}/labels`;
  const response = UrlFetchApp.fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    console.log(`GitHub API error ${response.getResponseCode()} for ${issueKey}`);
    return null;
  }

  const labels = JSON.parse(response.getContentText());
  return labels.map(l => l.name);
}
