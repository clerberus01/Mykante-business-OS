export { createClientRepository, SupabaseClientRepository } from './clients/clientRepository';
export { createProjectRepository, SupabaseProjectRepository } from './projects/projectRepository';
export {
  createTransactionRepository,
  SupabaseTransactionRepository,
} from './finance/transactionRepository';
export { createProposalRepository, SupabaseProposalRepository } from './proposals/proposalRepository';
export { createDocumentRepository, SupabaseDocumentRepository } from './documents/documentRepository';
export {
  createWhatsappRepository,
  SupabaseWhatsappRepository,
} from './communications/whatsappRepository';
export { DataLayerError, toDataLayerError } from './shared/dataErrors';
