export function filterByClientId<T extends { clientId?: string }>(items: T[], clientId: string | null | undefined) {
  if (!clientId) {
    return [];
  }

  return items.filter((item) => item.clientId === clientId);
}
