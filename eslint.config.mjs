import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.gs"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: {
        // Apps Script built-in globals
        GmailApp: "readonly",
        Gmail: "readonly",
        PropertiesService: "readonly",
        ScriptApp: "readonly",
        UrlFetchApp: "readonly",
        console: "readonly",

        // Project globals shared across .gs files (Apps Script merges
        // all files into a single scope at runtime).
        CLOSED_ITEMS: "writable",
        QUERY: "writable",
        MAX_THREADS: "writable",
        ROOT_PREFIX: "writable",
        KEEP_SLASHES: "writable",
        ALLOW: "writable",
        GMAIL_FILTERS: "writable",
        LABEL_CACHE: "writable",
        IS_CACHE_INITIALIZED: "writable",
        initLabelCache: "writable",
        getOrCreateLabel: "writable",
        formatLabelName: "writable",
        isAllowed: "writable",
        splitQuotedMulti: "writable",
        createGitHubMessageContext: "writable",
        getGitHubLabelsHeader: "writable",
        getGitHubPullRequestStatusHeader: "writable",
        getGitHubIssueStateHeader: "writable",
        extractFoldedHeader: "writable",
        escapeRe: "writable",
        extractIssueKey: "writable",
        getClosedStatus: "writable",
        fetchGitHubLabels: "writable",
        processGitHubEmailsImpl: "writable",
        reconcileGmailFiltersImpl: "writable",
        applyGmailFiltersReconciliationImpl: "writable",
      },
    },
    rules: {
      // All .gs files share a single global scope in Apps Script,
      // so top-level declarations are intentionally global.
      "no-redeclare": "off",
      "no-unused-vars": ["warn", { vars: "local", argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
];
