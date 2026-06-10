# Add built-in filter for k8s-triage-robot Not Planned closing messages

## Implementation Steps

### Task 1: Add built-in filter for k8s-triage-robot Not Planned closing messages

- [ ] Add a built-in filter to handle the k8s-triage-robot closing message that says 'Closing this issue, marking it as Not Planned'. The full message from the bot includes details about the triage rules (90d stale, 30d rotten, 30d close) and the /close not-planned command. This notification is noise for most users and should be automatically labeled or filtered. The filter should match on the key phrase 'Closing this issue, marking it as Not Planned' from @k8s-triage-robot.
