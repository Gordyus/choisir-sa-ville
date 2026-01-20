import type { AggregateId, ZoneAggregateDisplay, ZoneAggregatePlugin } from "./types.js";

const registry = new Map<AggregateId, ZoneAggregatePlugin<unknown, unknown>>();

export function registerZoneAggregatePlugin<TParams, TPayload>(
  plugin: ZoneAggregatePlugin<TParams, TPayload>
): void {
  if (registry.has(plugin.id)) {
    throw new Error(`Aggregate plugin already registered: ${plugin.id}`);
  }
  registry.set(plugin.id, plugin as ZoneAggregatePlugin<unknown, unknown>);
}

export function getZoneAggregatePlugin(
  aggregateId: AggregateId
): ZoneAggregatePlugin<unknown, unknown> | null {
  return registry.get(aggregateId) ?? null;
}

export function listZoneAggregatePlugins(): ZoneAggregatePlugin<unknown, unknown>[] {
  return [...registry.values()];
}

export function getZoneAggregateDisplay(aggregateId: AggregateId): ZoneAggregateDisplay | null {
  const plugin = getZoneAggregatePlugin(aggregateId);
  return plugin?.display ?? null;
}
