// Shared type definitions for the entity-cache projection registry.
// Written by rivergen init. Do not edit — these types are fundamental infrastructure.

export type QueryKey = readonly unknown[];

export type ProjectionFn<TEntity = unknown, TContext = unknown> = (
  entity: TEntity,
  context?: TContext,
) => QueryKey | QueryKey[] | null;

export interface EntityProjectionEntry<TEntity = unknown, TContext = unknown> {
  ownedKeyFactories: string[];
  onCreate: {
    required: ProjectionFn<TEntity, TContext>[];
    invalidate: ProjectionFn<TEntity, TContext>[];
  };
  onUpdate: {
    required: ProjectionFn<TEntity, TContext>[];
    invalidate: ProjectionFn<TEntity, TContext>[];
  };
  onDelete: {
    invalidate: QueryKey[];
  };
}
