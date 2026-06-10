/**
 * GMAIL FILTERS CONFIGURATION
 * This is where you can define filters to be managed by the script.
 * Use the output from logGmailFilters() to populate this.
 */
const GMAIL_FILTERS = [
  // Example:
  // {
  //   criteria: { from: 'notifications@github.com', query: 'label:kind/bug' },
  //   action: { addLabelNames: ['gh/kind/bug'] }
  // }
  {
    "criteria": {
      "from": "notifications@github.com",
      "query": "(kubernetes OR kubernetes-client OR kubernetes-sigs OR kubernetes-csi)"
    },
    "action": {
      "addLabelNames": [
        "k8s"
      ]
    }
  },
  {
    "criteria": {
      "from": "notifications@github.com",
      "to": "your_activity@noreply.github.com"
    },
    "action": {
      "addLabelNames": [
        "k8s/self"
      ],
      "removeLabelNames": [
        "ID:UNREAD",
        "ID:INBOX"
      ]
    }
  },
  {
    "criteria": {
      "query": "(from:(notifications@github.com) (from:(k8s-merge-robot) OR from:(Kubernetes Prow Robot) OR from:(k8s-ci-robot)))"
    },
    "action": {
      "addLabelNames": [
        "k8s/robot"
      ],
      "removeLabelNames": [
        "ID:UNREAD",
        "ID:INBOX"
      ]
    }
  },
  {
    "criteria": {
      "from": "notifications@github.com",
      "to": "push@noreply.github.com"
    },
    "action": {
      "addLabelNames": [
        "k8s/push"
      ],
      "removeLabelNames": [
        "ID:UNREAD",
        "ID:INBOX"
      ]
    }
  },
  {
    "criteria": {
      "from": "notifications@github.com",
      "to": "assign@noreply.github.com"
    },
    "action": {
      "addLabelNames": [
        "gh/assigned",
        "ID:IMPORTANT",
        "ID:STARRED"
      ]
    }
  },
  {
    "criteria": {
      "to": "review_requested@noreply.github.com"
    },
    "action": {
      "addLabelNames": [
        "gh/requested_review",
        "ID:IMPORTANT",
        "ID:STARRED"
      ]
    }
  },
  {
    "criteria": {
      "to": "author@noreply.github.com"
    },
    "action": {
      "addLabelNames": [
        "ID:IMPORTANT",
        "ID:STARRED",
        "gh/authored"
      ]
    }
  },
  {
    "criteria": {
      "to": "subscribed@noreply.github.com",
      "from": "notifications@github.com"
    },
    "action": {
      "removeLabelNames": [
        "ID:INBOX"
      ]
    }
  },
  {
    "criteria": {
      "query": "list:(kubernetes.kubernetes.github.com)"
    },
    "action": {
      "addLabelNames": [
        "k8s/_repos/k/k"
      ]
    }
  },
  {
    "criteria": {
      "query": "list:(wg-serving.kubernetes-sigs.github.com)"
    },
    "action": {
      "addLabelNames": [
        "k8s/_repos/wg-serving"
      ]
    }
  },
  {
    "criteria": {
      "query": "list:(enhancements.kubernetes.github.com)"
    },
    "action": {
      "addLabelNames": [
        "k8s/_repos/enhancements"
      ]
    }
  },
  {
    "criteria": {
      "query": "list:(inference-perf.kubernetes-sigs.github.com)"
    },
    "action": {
      "addLabelNames": [
        "k8s/_repos/inference-perf"
      ]
    }
  },
  {
    "criteria": {
      "query": "list:([test-infra.kubernetes.github.com)"
    },
    "action": {
      "addLabelNames": [
        "k8s/_repos/test-infra"
      ]
    }
  },
  {
    "criteria": {
      "from": "notifications@github.com",
      "subject": "kubeadm OR OpenShift OR CAPZ OR Azure OR OpenShift OR \"Update k8s-staging-test-infra GCR images as needed\" OR etcd OR vSphere OR bump"
    },
    "action": {
      "addLabelNames": [
        "k8s/low-pri"
      ]
    }
  },
  {
    "criteria": {
      "to": "mention@noreply.github.com"
    },
    "action": {
      "addLabelNames": [
        "gh/mentioned"
      ]
    }
  },
  {
    "criteria": {
      "query": "list:(cri-tools.kubernetes-sigs.github.com)"
    },
    "action": {
      "addLabelNames": [
        "k8s/_repos/cri-tools"
      ]
    }
  },
  {
    "criteria": {
      "query": "\"Merged\" AROUND 1 \"into master\""
    },
    "action": {
      "addLabelNames": [
        "k8s/merged"
      ]
    }
  },
  {
    "criteria": {
      "to": "comment@noreply.github.com"
    },
    "action": {
      "addLabelNames": [
        "gh/commented"
      ]
    }
  },
  {
    "criteria": {
      "query": "list:(cadvisor.google.github.com)"
    },
    "action": {
      "addLabelNames": [
        "k8s/_repos/cadvisor"
      ]
    }
  },
  {
    "criteria": {
      "query": "(\"Closed\" AROUND 1 \"as completed.\") OR (\"Closed\" AROUND 1 \"as not planned.\" ) OR (\"@k8s\\-triage\\-robot\\: Closed this PR.\") OR (\"Closed this PR.\")"
    },
    "action": {
      "addLabelNames": [
        "k8s/closed"
      ]
    }
  },
  {
    "criteria": {
      "query": "list:(node-problem-detector.kubernetes.github.com)"
    },
    "action": {
      "addLabelNames": [
        "k8s/_repos/node-problem-detector"
      ]
    }
  },
  {
    "criteria": {
      "query": "list:(community.kubernetes.github.com)"
    },
    "action": {
      "addLabelNames": [
        "k8s/_repos/community"
      ]
    }
  },
  {
    "criteria": {
      "query": "list:(cloud-provider-gcp.kubernetes.github.com)"
    },
    "action": {
      "addLabelNames": [
        "k8s/_repos/cloud-provider-gcp"
      ]
    }
  },
  {
    "criteria": {
      "query": "list:(website.kubernetes.github.com)"
    },
    "action": {
      "addLabelNames": [
        "k8s/_repos/website"
      ]
    }
  },
  {
    "criteria": {
      "query": "list:(k8s-node-tools.GoogleCloudPlatform.github.com)"
    },
    "action": {
      "addLabelNames": [
        "k8s/_repos/GCP/k8s-node-tools"
      ]
    }
  },
  {
    // Group all W3C GitHub notifications under a single "w3c" label.
    // GitHub sets the List-ID header to "<repo>.<owner>.github.com", so every
    // w3c/* repository (e.g. w3c/webai-roadmap -> webai-roadmap.w3c.github.com)
    // shares the ".w3c.github.com" list domain. Matching on that domain groups
    // all current and future w3c repos with one rule.
    "criteria": {
      "from": "notifications@github.com",
      "query": "list:(w3c.github.com)"
    },
    "action": {
      "addLabelNames": [
        "w3c"
      ]
    }
  }
];
