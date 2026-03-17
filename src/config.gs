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
