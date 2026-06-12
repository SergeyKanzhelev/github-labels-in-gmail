/**
 * CONFIGURATION
 */
const QUERY        = 'from:notifications@github.com newer_than:300d';
const MAX_THREADS  = 500;
const ROOT_PREFIX  = 'gh/';
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
  let threadsConsidered = 0;
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
      const subject = thread.getFirstMessageSubject();
      const log = [];  // accumulate decisions for this thread

      try {
        const ctx = createGitHubMessageContext(thread);

        // Detect PR or Issue from subject line as fallback
        const isPRBySubject = /\(PR #\d+\)\s*$/.test(subject);
        const isIssueBySubject = /\(Issue #\d+\)\s*$/.test(subject);

        // Handle Pull Request Status
        if (ctx.prStatus) {
          ctx.addLabel('pr');
          const status = ctx.prStatus.toLowerCase();
          if (status === 'merged') {
            log.push(ctx.addLabel('k8s/merged') ? '+k8s/merged (PR)' : 'already k8s/merged');
          } else if (status === 'closed') {
            log.push(ctx.addLabel('k8s/closed') ? '+k8s/closed (PR)' : 'already k8s/closed');
          } else {
            log.push(`PR status: ${ctx.prStatus}`);
          }
        } else if (isPRBySubject) {
          ctx.addLabel('pr');
          log.push('PR (detected from subject)');
        }

        // Handle Issue State
        if (ctx.issueState) {
          ctx.addLabel('issue');
          if (ctx.issueState.toLowerCase() === 'closed') {
            log.push(ctx.addLabel('k8s/closed') ? '+k8s/closed (issue)' : 'already k8s/closed');
          } else {
            log.push(`issue state: ${ctx.issueState}`);
          }
        } else if (isIssueBySubject && !isPRBySubject) {
          ctx.addLabel('issue');
          log.push('issue (detected from subject)');
        }

        // Fallback: check prepackaged closed/merged data when headers don't indicate status
        if (!ctx.existingLabels.has('k8s/merged') && !ctx.existingLabels.has('k8s/closed')) {
          const issueKey = extractIssueKey(subject);
          const closedStatus = getClosedStatus(subject);
          if (closedStatus === 'merged') {
            log.push(ctx.addLabel('k8s/merged') ? `+k8s/merged (prepackaged ${issueKey})` : 'already k8s/merged');
          } else if (closedStatus === 'closed') {
            log.push(ctx.addLabel('k8s/closed') ? `+k8s/closed (prepackaged ${issueKey})` : 'already k8s/closed');
          } else if (issueKey) {
            log.push(`${issueKey} not in prepackaged data`);
          }
        }

        // Fallback: fetch labels from GitHub API if header is missing
        if (ctx.githubLabels.length === 0) {
          const issueKey = extractIssueKey(subject);
          const apiLabels = fetchGitHubLabels(issueKey);
          if (apiLabels && apiLabels.length > 0) {
            ctx.githubLabels = apiLabels;
            log.push(`labels from API (${issueKey})`);
          }
        }

        if (ctx.githubLabels.length === 0) {
          if (!ctx.prStatus && !ctx.issueState && !isPRBySubject && !isIssueBySubject) {
            log.push('no headers');
          }
          log.push('no github labels');
        } else {
          const seen = new Set();
          let sigCount = 0;
          let allowedSigs = [];
          let hasOtherSig = false;
          let hasAllowedSig = false;
          const skipped = [];

          for (const raw of ctx.githubLabels) {
            const lbl = raw.trim();
            if (!lbl) continue;

            const key = lbl.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);

            if (key.startsWith('sig/') || key.startsWith('wg/')) {
              sigCount++;
              if (!isAllowed(lbl)) {
                hasOtherSig = true;
              } else {
                hasAllowedSig = true;
                allowedSigs.push(lbl);
              }
            }

            if (isAllowed(lbl)) {
              const labelName = formatLabelName(lbl);
              const applied = ctx.addLabel(labelName);
              log.push(applied ? `+${labelName}` : `already ${labelName}`);
            } else {
              skipped.push(lbl);
            }
          }

          if (hasOtherSig && !hasAllowedSig) {
            const applied = ctx.addLabel(`${ROOT_PREFIX}other-sig`);
            log.push(applied ? `+${ROOT_PREFIX}other-sig` : `already ${ROOT_PREFIX}other-sig`);
          }

          if (sigCount === 1 && allowedSigs.length === 1) {
            const labelName = formatLabelName(`only/${allowedSigs[0]}`);
            const applied = ctx.addLabel(labelName);
            log.push(applied ? `+${labelName}` : `already ${labelName}`);
          }

          if (sigCount >= 3) {
            const labelName = formatLabelName('many/sigs');
            const applied = ctx.addLabel(labelName);
            log.push(applied ? `+${labelName}` : `already ${labelName}`);
          }

          if (skipped.length > 0) {
            log.push(`skipped[${skipped.join(', ')}]`);
          }
        }

        labelsAppliedCount += ctx.appliedLabelsCount;
      } catch (e) {
        log.push(`ERROR: ${e && e.message}`);
      }

      console.log(`[${subject}] ${log.join('; ')}`);
    });
  }

  console.log(`Processing complete. Considered: ${threadsConsidered}, Labels applied: ${labelsAppliedCount}`);
}
