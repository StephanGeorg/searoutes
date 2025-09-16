/**
 * Maritime profile utilities for vessel-specific routing
 * Handles passage restrictions and weight calculations for different vessel classes
 * @author Stephan Georg
 * @version 1.0.0
 */

/**
 * Normalize feature ID to a number or null
 * @private
 * @param {*} fid - Feature ID to normalize
 * @returns {number|null} Normalized feature ID or null if invalid
 */
function normalizeFid(fid) {
  if (fid === null) return null;
  if (typeof fid === 'number' && Number.isFinite(fid)) return fid;
  const n = Number(fid);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compute effective passage status for all vessel classes without overrides
 * @param {Object} cfg - Maritime configuration object
 * @param {Object} cfg.passages - Passage definitions with status and feature_ids
 * @param {string} cfg.default_policy - Default policy for passages ('allowed', 'restricted', 'forbidden')
 * @param {string[]} classes - Array of vessel class names
 * @returns {Object} Object mapping passage IDs to status and feature_ids
 * @returns {Object} returns.passageId.status - Status object mapping class names to status strings
 * @returns {number[]} returns.passageId.feature_ids - Array of feature IDs for this passage
 */
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

/**
 * Collect edge rules for each vessel class based on effective status
 * @param {Object} effective - Effective status object from computeEffectiveStatusNoOverrides
 * @param {string[]} classes - Array of vessel class names
 * @returns {Object} Object mapping class names to rule sets
 * @returns {Set<number>} returns.className.forbidden - Set of forbidden feature IDs
 * @returns {Set<number>} returns.className.restricted - Set of restricted feature IDs
 */
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

/**
 * Create a weight function for a specific vessel class with passage restrictions
 * @param {string} clazz - Vessel class name
 * @param {Object} rules - Rules object from collectClassEdgeRules
 * @param {Set<number>} rules.clazz.forbidden - Set of forbidden feature IDs for this class
 * @param {Set<number>} rules.clazz.restricted - Set of restricted feature IDs for this class
 * @param {number} restrictedMultiplier - Multiplier for restricted passages (e.g., 1.25)
 * @param {Function} weightFn - Base weight function (typically haversine distance)
 * @returns {Function} Weight function that takes (a, b, edgeData) and returns weight
 * @returns {number} Weight function returns Infinity for forbidden edges, multiplied weight for restricted, base weight otherwise
 */
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
