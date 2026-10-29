import { now } from '../../shared/time.js';

/** Version in force at `instant`: the latest one already started, unless it has already ended. */
export function effectiveVersion(versions, instant = now()) {
  const eligible = versions
    .filter(version => version.effectiveFrom <= instant)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom) || right.versionNumber - left.versionNumber);
  const latest = eligible[0];
  return latest && (!latest.effectiveTo || latest.effectiveTo > instant) ? latest : null;
}

export function versionStatusAt(version, current, instant) {
  if (version.effectiveFrom > instant) return 'SCHEDULED';
  return current?.versionNumber === version.versionNumber ? 'ACTIVE' : 'EXPIRED';
}

/** ACTIVE while a non-deactivating version is in force; DRAFT while every version is still scheduled. */
export function parameterStatusAt(current, versions, instant) {
  if (current && current.changeType !== 'DEACTIVATE') return 'ACTIVE';
  if (!current && versions.every(version => version.effectiveFrom > instant)) return 'DRAFT';
  return 'INACTIVE';
}
