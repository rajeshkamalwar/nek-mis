// Re-exports for backward compatibility — AppShell is the primary component now.
export { useLastSourceKey } from "./AppShell";

/**
 * @deprecated Use AppShell instead. This stub is kept so any remaining
 * direct <AppNav /> usages compile without changes during the migration.
 */
export function AppNav() {
  return null;
}
