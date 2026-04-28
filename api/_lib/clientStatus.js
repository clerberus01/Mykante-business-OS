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

const defaultBranding = {
  appName: 'Mykante Business OS',
  logoUrl: '',
  primaryColor: '#FF6321',
  darkColor: '#141414',
  backgroundColor: '#F8F9FA',
  textColor: '#1A1A1A',
  portalTitle: 'Acompanhamento do pedido',
  portalSubtitle: 'Consulta segura por email',
};

function normalizePublicBranding(metadata) {
  const branding = metadata?.branding && typeof metadata.branding === 'object' ? metadata.branding : {};
  const colorPattern = /^#[0-9a-f]{6}$/i;
  const color = (value, fallback) => (typeof value === 'string' && colorPattern.test(value.trim()) ? value.trim() : fallback);
  const text = (value, fallback) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

  return {
    appName: text(branding.appName, defaultBranding.appName),
    logoUrl: typeof branding.logoUrl === 'string' ? branding.logoUrl.trim() : defaultBranding.logoUrl,
    primaryColor: color(branding.primaryColor, defaultBranding.primaryColor),
    darkColor: color(branding.darkColor, defaultBranding.darkColor),
    backgroundColor: color(branding.backgroundColor, defaultBranding.backgroundColor),
    textColor: color(branding.textColor, defaultBranding.textColor),
    portalTitle: text(branding.portalTitle, defaultBranding.portalTitle),
    portalSubtitle: text(branding.portalSubtitle, defaultBranding.portalSubtitle),
  };
}

export function mapPublicClientStatus(client, organizationOrProposals, proposalsOrDeals = [], dealsOrProjects = [], projectsOrTransactions = [], transactionsOrDocuments = [], documentsOrContracts = [], contractsInput = []) {
  const calledWithOrganization = !Array.isArray(organizationOrProposals);
  const organization = calledWithOrganization ? organizationOrProposals : null;
  const proposals = calledWithOrganization ? proposalsOrDeals : organizationOrProposals ?? [];
  const deals = calledWithOrganization ? dealsOrProjects : proposalsOrDeals;
  const projects = calledWithOrganization ? projectsOrTransactions : dealsOrProjects;
  const transactions = calledWithOrganization ? transactionsOrDocuments : projectsOrTransactions;
  const documents = calledWithOrganization ? documentsOrContracts : transactionsOrDocuments;
  const contracts = calledWithOrganization ? contractsInput : documentsOrContracts;

  return {
    id: client.id,
    name: client.name,
    status: client.status,
    createdAt: client.created_at,
    updatedAt: client.updated_at,
    closedAt: client.public_status_closed_at ?? null,
    organization: {
      name: organization?.name ?? null,
      defaultLocale: organization?.default_locale ?? 'pt-BR',
      defaultCurrency: organization?.default_currency ?? 'BRL',
      branding: normalizePublicBranding(organization?.metadata),
    },
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
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      progress: Number(project.progress ?? 0),
      deadline: project.deadline,
      updatedAt: project.updated_at,
    })),
    invoices: transactions.map((transaction) => ({
      id: transaction.id,
      description: transaction.description,
      amount: Number(transaction.amount ?? 0),
      status: transaction.status,
      dueDate: transaction.due_date,
      paymentUrl: transaction.payment_url ?? null,
    })),
    documents: documents.map((document) => ({
      id: document.id,
      name: document.display_name,
      signatureStatus: document.signature_status,
      signatureUrl: document.signature_url ?? null,
      updatedAt: document.updated_at,
    })),
    contracts: contracts.map((contract) => ({
      id: contract.id,
      title: contract.title,
      status: contract.status,
      amount: Number(contract.amount ?? 0),
      currency: contract.currency,
      startsAt: contract.starts_at,
      endsAt: contract.ends_at,
      autoRenew: contract.auto_renew,
      nextRenewalAt: contract.next_renewal_at,
    })),
  };
}
