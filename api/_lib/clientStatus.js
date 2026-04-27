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

export function mapPublicClientStatus(client, proposals = [], deals = []) {
  return {
    id: client.id,
    name: client.name,
    status: client.status,
    createdAt: client.created_at,
    updatedAt: client.updated_at,
    closedAt: client.public_status_closed_at ?? null,
    proposals: proposals.map((proposal) => ({
      id: proposal.id,
      title: proposal.title,
      status: proposal.status,
      value: Number(proposal.value ?? 0),
      description: proposal.description ?? null,
      validUntil: proposal.valid_until,
      updatedAt: proposal.updated_at,
    })),
    pipeline: deals.map((deal) => ({
      id: deal.id,
      title: deal.title,
      status: deal.status,
      value: Number(deal.value ?? 0),
      probability: Number(deal.probability ?? 0),
      updatedAt: deal.updated_at,
      stageName: Array.isArray(deal.crm_pipeline_stages)
        ? deal.crm_pipeline_stages[0]?.name ?? null
        : deal.crm_pipeline_stages?.name ?? null,
    })),
  };
}
