export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isAuthorizedClientEmail(inputEmail, client) {
  const normalizedInput = normalizeEmail(inputEmail);

  if (!normalizedInput || !client) {
    return false;
  }

  return [client.email, client.contact_email].some((candidate) => normalizeEmail(candidate) === normalizedInput);
}

export function mapPublicProposalStatus(proposal) {
  const client = Array.isArray(proposal.clients) ? proposal.clients[0] : proposal.clients;

  return {
    id: proposal.id,
    title: proposal.title,
    status: proposal.status,
    value: Number(proposal.value ?? 0),
    description: proposal.description ?? null,
    validUntil: proposal.valid_until,
    createdAt: proposal.created_at,
    updatedAt: proposal.updated_at,
    clientName: client?.name ?? null,
  };
}
