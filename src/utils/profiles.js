function normalizeFid(fid) {
  if (fid === null) return null;
  if (typeof fid === 'number' && Number.isFinite(fid)) return fid;
  const n = Number(fid);
  return Number.isFinite(n) ? n : null;
}

export function computeEffectiveStatusNoOverrides(cfg, classes) {
  const out = {};
  for (const [passageId, p] of Object.entries(cfg.passages || {})) {
    const status = {};
    for (const clazz of classes) {
      const clsStatus = (p.status && p.status[clazz]) || cfg.default_policy;
      status[clazz] = clsStatus;
    }
    out[passageId] = { status, feature_ids: p.feature_ids || [] };
  }
  return out;
}

export function collectClassEdgeRules(effective, classes) {
  const rules = {};
  for (const clazz of classes) {
    rules[clazz] = { forbidden: new Set(), restricted: new Set() };
  }

  for (const { status, feature_ids } of Object.values(effective)) {
    const ids = feature_ids || [];
    if (!ids.length) continue;

    for (const clazz of classes) {
      const s = status[clazz];
      if (s === 'forbidden') ids.forEach((id) => rules[clazz].forbidden.add(id));
      else if (s === 'restricted') ids.forEach((id) => rules[clazz].restricted.add(id));
      // 'allowed' → no action
    }
  }

  return rules;
}

export function makeWeightFn(clazz, rules, restrictedMultiplier, weightFn) {
  const { forbidden, restricted } = rules[clazz];
  return (a, b, edgeData = {}) => {
    const base = Math.trunc(weightFn(a, b));
    const fid = normalizeFid(edgeData.fid);
    if (fid !== null) {
      if (forbidden.has(fid)) return Infinity;
      if (restricted.has(fid)) return base * restrictedMultiplier;
    }
    return base;
  };
}
