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
      try {
        const ctx = createGitHubMessageContext(thread);

        // Handle Pull Request Status
        if (ctx.prStatus) {
          ctx.addLabel('pr');
          if (ctx.prStatus.toLowerCase() === 'merged') {
            if (ctx.addLabel('k8s/merged')) {
              console.log(`Thread ${thread.getId()}: Applied k8s/merged label`);
            }
          } else if (ctx.prStatus.toLowerCase() === 'closed') {
            if (ctx.addLabel('k8s/closed')) {
              console.log(`Thread ${thread.getId()}: Applied k8s/closed label`);
            }
          }
        }

        // Handle Issue State
        if (ctx.issueState) {
          ctx.addLabel('issue');
          if (ctx.issueState.toLowerCase() === 'closed') {
            if (ctx.addLabel('k8s/closed')) {
              console.log(`Thread ${thread.getId()}: Applied k8s/closed label (issue closed)`);
            }
          }
        }

        if (ctx.githubLabels.length === 0) {
          labelsAppliedCount += ctx.appliedLabelsCount;
          return;
        }

        const seen = new Set();
        let hasSigLabel = false;
        let hasOtherSig = false;
        let hasAllowedSig = false;

        for (const raw of ctx.githubLabels) {
          const lbl = raw.trim();
          if (!lbl) continue;

          const key = lbl.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          if (key.startsWith('sig/') || key.startsWith('wg/')) {
            hasSigLabel = true;
            if (!isAllowed(lbl)) {
              hasOtherSig = true;
            } else {
              hasAllowedSig = true
            }
          }

          if (isAllowed(lbl)) {
            ctx.addLabel(formatLabelName(lbl));
          }
        }

        if (hasOtherSig && !hasAllowedSig) {
          ctx.addLabel(`${ROOT_PREFIX}other-sig`);
        }

        labelsAppliedCount += ctx.appliedLabelsCount;
      } catch (e) {
        console.log(`Error processing thread ${thread.getId()}: ${e && e.message}`);
      }
    });
  }

  console.log(`Processing complete. Considered: ${threadsConsidered}, Labels applied: ${labelsAppliedCount}`);
}
