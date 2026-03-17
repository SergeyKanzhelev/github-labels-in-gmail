/**
 * Implementation of Gmail filter reconciliation.
 */

function reconcileGmailFiltersImpl() {
  const diff = getGmailFiltersDiff();
  if (!diff) return;

  console.log('--- GMAIL FILTERS RECONCILIATION DIFF (PREVIEW) ---');
  
  if (diff.toCreate.length === 0 && diff.extraRemote.length === 0) {
    console.log('✅ Configuration is perfectly in sync with Gmail.');
  } else {
    if (diff.toCreate.length > 0) {
      console.log(`\n➕ MISSING IN GMAIL (To be created: ${diff.toCreate.length}):`);
      diff.toCreate.forEach(item => {
        console.log(`  Config Item #${item.index}: ${JSON.stringify(item.config)}`);
      });
    }

    if (diff.extraRemote.length > 0) {
      console.log(`\n⚠️  EXTRA IN GMAIL (Not in config: ${diff.extraRemote.length}):`);
      diff.extraRemote.forEach(remote => {
        console.log(`  Filter ID ${remote.id}: Criteria: ${JSON.stringify(remote.criteria)}, Action: ${JSON.stringify(diff.formatActionForLog(remote.action))}`);
      });
    }
  }
  console.log('\n-----------------------------------------');
}

function applyGmailFiltersReconciliationImpl() {
  const diff = getGmailFiltersDiff();
  if (!diff) return;

  if (diff.toCreate.length === 0 && diff.extraRemote.length === 0) {
    console.log('✅ Nothing to do. Configuration is already in sync.');
    return;
  }

  // 1. Create missing filters
  diff.toCreate.forEach(item => {
    try {
      const filterResource = {
        criteria: { ...item.config.criteria },
        action: { ...item.config.action }
      };

      const resolveToId = (name) => {
        if (name.startsWith('ID:')) return name.slice(3);
        return diff.nameToId[name] || name;
      };

      if (filterResource.action.addLabelNames) {
        filterResource.action.addLabelIds = filterResource.action.addLabelNames.map(resolveToId);
        delete filterResource.action.addLabelNames;
      }
      if (filterResource.action.removeLabelNames) {
        filterResource.action.removeLabelIds = filterResource.action.removeLabelNames.map(resolveToId);
        delete filterResource.action.removeLabelNames;
      }

      // Clean the resource: remove null/undefined/empty string values that can cause "Empty response"
      [filterResource.criteria, filterResource.action].forEach(obj => {
        Object.keys(obj).forEach(key => {
          if (obj[key] === null || obj[key] === undefined || obj[key] === '') {
            delete obj[key];
          }
        });
      });

      Gmail.Users.Settings.Filters.create(filterResource, 'me');
      console.log(`✅ Created filter: ${JSON.stringify(filterResource.criteria)}`);
    } catch (e) {
      console.log(`❌ Error creating filter #${item.index}: ${e.message}`);
      console.log(`   Attempted Resource: ${JSON.stringify(item.config)}`);
    }
  });

  // 2. Delete extra filters
  diff.extraRemote.forEach(remote => {
    try {
      Gmail.Users.Settings.Filters.remove('me', remote.id);
      console.log(`🗑️ Deleted extra filter: ${remote.id}`);
    } catch (e) {
      console.log(`❌ Error deleting filter ${remote.id}: ${e.message}`);
    }
  });

  console.log('✨ Reconciliation complete.');
  IS_CACHE_INITIALIZED = false; 
}

function getGmailFiltersDiff() {
  if (!initLabelCache()) return null;

  const idToName = {};
  const nameToId = {};
  Object.keys(LABEL_CACHE).forEach(name => {
    try {
      const id = LABEL_CACHE[name].getId();
      idToName[id] = name;
      nameToId[name] = id;
    } catch (e) {}
  });

  const formatActionForLog = (action) => {
    const readable = { ...action };
    if (readable.addLabelIds) {
      readable.addLabelNames = readable.addLabelIds.map(id => idToName[id] || `ID:${id}`);
      delete readable.addLabelIds;
    }
    if (readable.removeLabelIds) {
      readable.removeLabelNames = readable.removeLabelIds.map(id => idToName[id] || `ID:${id}`);
      delete readable.removeLabelIds;
    }
    return readable;
  };

  try {
    const response = Gmail.Users.Settings.Filters.list('me');
    const remoteFilters = response.filter || [];

    const toCreate = [];
    const matchedRemoteIds = new Set();
    const extraRemote = [];

    GMAIL_FILTERS.forEach((local, index) => {
      const localActionWithIds = { ...local.action };
      const resolveToId = (name) => {
        if (name.startsWith('ID:')) return name.slice(3);
        return nameToId[name] || name;
      };

      if (localActionWithIds.addLabelNames) {
        localActionWithIds.addLabelIds = localActionWithIds.addLabelNames.map(resolveToId);
        delete localActionWithIds.addLabelNames;
      }
      if (localActionWithIds.removeLabelNames) {
        localActionWithIds.removeLabelIds = localActionWithIds.removeLabelNames.map(resolveToId);
        delete localActionWithIds.removeLabelNames;
      }

      const match = remoteFilters.find(remote => {
        if (matchedRemoteIds.has(remote.id)) return false;
        return isFilterMatch(local.criteria, localActionWithIds, remote.criteria, remote.action);
      });

      if (match) {
        matchedRemoteIds.add(match.id);
      } else {
        toCreate.push({ index: index + 1, config: local });
      }
    });

    remoteFilters.forEach(remote => {
      if (!matchedRemoteIds.has(remote.id)) {
        extraRemote.push(remote);
      }
    });

    return { toCreate, extraRemote, nameToId, formatActionForLog };
  } catch (e) {
    console.log(`Error fetching filters: ${e.message}`);
    return null;
  }
}

function isFilterMatch(localCrit, localAct, remoteCrit, remoteAct) {
  // Normalize criteria
  const keys = new Set([...Object.keys(localCrit), ...Object.keys(remoteCrit)]);
  for (const key of keys) {
    if ((localCrit[key] || '') !== (remoteCrit[key] || '')) return false;
  }

  // Compare actions
  const actKeys = ['addLabelIds', 'removeLabelIds', 'forward', 'indexableText'];
  for (const key of actKeys) {
    const localVal = localAct[key];
    const remoteVal = remoteAct[key];
    
    if (Array.isArray(localVal)) {
      if (!Array.isArray(remoteVal) || localVal.length !== remoteVal.length) return false;
      const sLocal = [...localVal].sort();
      const sRemote = [...remoteVal].sort();
      if (!sLocal.every((v, i) => v === sRemote[i])) return false;
    } else {
      if ((localVal || '') !== (remoteVal || '')) return false;
    }
  }

  return true;
}
