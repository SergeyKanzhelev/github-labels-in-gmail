 /**
 * CONFIGURATION
 */
const QUERY        = 'from:notifications@github.com newer_than:30d -label:"gh/processed"';
const MAX_THREADS  = 500;
const ROOT_PREFIX  = 'gh/';
const PROCESSED    = 'gh/processed';
const KEEP_SLASHES = true; // true -> nested labels (gh/area/kubelet). false -> replace "/" with fullwidth slash.

/**
 * EXPLICIT allow-list. Only labels matching one of these patterns will be applied.
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


/**
 * Implementation of GitHub email processing.
 */
function processGitHubEmailsImpl() {
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

        // Handle Pull Request Status
        const prStatus = getGitHubPullRequestStatusHeader(message);
        if (prStatus) {
          thread.addLabel(getOrCreateLabel('pr'));
          labelsAppliedCount++;
          if (prStatus.toLowerCase() === 'merged') {
            thread.addLabel(getOrCreateLabel('k8s/merged'));
            console.log(`Thread ${thread.getId()}: Applied k8s/merged label`);
            labelsAppliedCount++;
          } else if (prStatus.toLowerCase() === 'closed') {
            thread.addLabel(getOrCreateLabel('k8s/closed'));
            console.log(`Thread ${thread.getId()}: Applied k8s/closed label`);
            labelsAppliedCount++;
          }
        }

        // Handle Issue State
        const issueState = getGitHubIssueStateHeader(message);
        if (issueState) {
          thread.addLabel(getOrCreateLabel('issue'));
          labelsAppliedCount++;
          if (issueState.toLowerCase() === 'closed') {
            thread.addLabel(getOrCreateLabel('k8s/closed'));
            console.log(`Thread ${thread.getId()}: Applied k8s/closed label (issue closed)`);
            labelsAppliedCount++;
          }
        }

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
          if (key.startsWith('sig/') || key.startsWith('wg/')) {
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

function reprocessMissingSigLabelsImpl() {
  if (!initLabelCache()) {
    return; // Exit if cache initialization fails.
  }
  const otherSigLabelName = `${ROOT_PREFIX}other-sig`;
  const otherSigLabel = getOrCreateLabel(otherSigLabelName);
  let query = `label:"${PROCESSED}" -label:"${otherSigLabelName}"`;

  // Exclude threads that already have an allowed sig or wg label.
  const allowedGroups = ALLOW.filter(p => {
    const lp = p.toLowerCase();
    return lp.startsWith('sig/') || lp.startsWith('wg/');
  });
  for (const pat of allowedGroups) {
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
≈   threads = GmailApp.search(query, offset, MAX_THREADS);
    console.log(`Queried threads with offset ${offset}. Found ${threads.length} threads`);
    if (threads.length === 0) {
      break;
    }
    offset += threads.length;

    threads.forEach(thread => {
      threadsConsidered++;
      try {
        const message = thread.getMessages().pop();

        // Handle Pull Request Status
        const prStatus = getGitHubPullRequestStatusHeader(message);
        if (prStatus) {
          thread.addLabel(getOrCreateLabel('pr'));
          labelsReappliedCount++;
          if (prStatus.toLowerCase() === 'merged') {
            thread.addLabel(getOrCreateLabel('k8s/merged'));
            console.log(`Thread ${thread.getId()}: Applied k8s/merged label`);
            labelsReappliedCount++;
          } else if (prStatus.toLowerCase() === 'closed') {
            thread.addLabel(getOrCreateLabel('k8s/closed'));
            console.log(`Thread ${thread.getId()}: Applied k8s/closed label`);
            labelsReappliedCount++;
          }
        }

        // Handle Issue State
        const issueState = getGitHubIssueStateHeader(message);
        if (issueState) {
          thread.addLabel(getOrCreateLabel('issue'));
          labelsReappliedCount++;
          if (issueState.toLowerCase() === 'closed') {
            thread.addLabel(getOrCreateLabel('k8s/closed'));
            console.log(`Thread ${thread.getId()}: Applied k8s/closed label (issue closed)`);
            labelsReappliedCount++;
          }
        }

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

          if (key.startsWith('sig/') || key.startsWith('wg/')) {
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
