export { createClientRepository, SupabaseClientRepository } from '../features/crm/services/clientRepository';
export { createProjectRepository, SupabaseProjectRepository } from '../features/projects/services/projectRepository';
export {
  createTransactionRepository,
  SupabaseTransactionRepository,
} from '../features/finance/services/transactionRepository';
export { createProposalRepository, SupabaseProposalRepository } from '../features/crm/services/proposalRepository';
export { createDocumentRepository, SupabaseDocumentRepository } from '../features/documents/services/documentRepository';
export {
  createWhatsappRepository,
  SupabaseWhatsappRepository,
} from '../features/communications/services/whatsappRepository';
export { DataLayerError, toDataLayerError } from './shared/dataErrors';
