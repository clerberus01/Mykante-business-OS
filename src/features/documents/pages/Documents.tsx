import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import {
  FileText,
  Search,
  Plus,
  MoreHorizontal,
  Folder,
  Download,
  Share2,
  Trash2,
  Loader2,
  PenLine,
  ScanText,
  GitCompare,
  History,
} from 'lucide-react';
import { cn, formatDate } from '@/src/lib/utils';
import { useSupabaseDocuments } from '@/src/hooks/supabase';
import type { StoredDocument } from '@/src/types';
import { clearPendingNavigationIntent, getPendingNavigationIntent } from '@/src/lib/navigation';

function formatBytes(sizeBytes: number) {
  if (sizeBytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(sizeBytes) / Math.log(1024)), units.length - 1);
  const value = sizeBytes / 1024 ** index;

  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function getDocumentBadge(document: StoredDocument) {
  const extension = document.fileExtension?.toLowerCase() ?? '';

  if (extension === 'pdf') return { label: 'PDF', className: 'bg-red-500' };
  if (['doc', 'docx'].includes(extension)) return { label: 'DOC', className: 'bg-blue-500' };
  if (['zip', 'rar', '7z'].includes(extension)) return { label: 'ZIP', className: 'bg-amber-500' };

  return { label: extension ? extension.slice(0, 3).toUpperCase() : 'FILE', className: 'bg-slate-500' };
}

export default function Documents() {
  const navigate = useNavigate();
  const routeSearch = useRouterState({
    select: (state) => state.location.search as { action?: string },
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const versionInputRef = useRef<HTMLInputElement | null>(null);
  const {
    documents,
    loading,
    uploadDocument,
    uploadNewVersion,
    requestSignature,
    runOcr,
    loadVersions,
    deleteDocument,
    downloadDocument,
  } = useSupabaseDocuments();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState<string>('Todos os Arquivos');
  const [isUploading, setIsUploading] = useState(false);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [versionTarget, setVersionTarget] = useState<StoredDocument | null>(null);

  React.useEffect(() => {
    if (routeSearch.action === 'upload-document') {
      fileInputRef.current?.click();
      void navigate({ to: '/docs', search: {}, replace: true });
      return;
    }

    const pendingIntent = getPendingNavigationIntent();

    if (pendingIntent?.kind === 'upload-document') {
      fileInputRef.current?.click();
      clearPendingNavigationIntent();
    }
  }, [navigate, routeSearch.action]);

  const folderStats = useMemo(() => {
    const counts = new Map<string, number>();

    for (const document of documents) {
      counts.set(document.folder, (counts.get(document.folder) ?? 0) + 1);
    }

    return counts;
  }, [documents]);

  const folders = useMemo(() => Array.from(folderStats.keys()).sort(), [folderStats]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const matchesFolder = activeFolder === 'Todos os Arquivos' || document.folder === activeFolder;
      const normalizedQuery = searchQuery.trim().toLowerCase();

      const matchesQuery =
        !normalizedQuery ||
        document.displayName.toLowerCase().includes(normalizedQuery) ||
        document.fileExtension?.toLowerCase().includes(normalizedQuery) ||
        document.folder.toLowerCase().includes(normalizedQuery);

      return matchesFolder && matchesQuery;
    });
  }, [activeFolder, documents, searchQuery]);

  const totalStorageUsed = useMemo(
    () => documents.reduce((sum, document) => sum + document.sizeBytes, 0),
    [documents],
  );

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setIsUploading(true);

    try {
      await uploadDocument(selectedFile);
    } catch (error) {
      console.error('Document upload failed:', error);
      window.alert('Nao foi possivel enviar o arquivo.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteDocument = async (document: StoredDocument) => {
    if (!window.confirm(`Deseja realmente excluir "${document.displayName}"?`)) {
      return;
    }

    setBusyDocumentId(document.id);

    try {
      await deleteDocument(document);
    } catch (error) {
      console.error('Document deletion failed:', error);
      window.alert('Nao foi possivel excluir o documento.');
    } finally {
      setBusyDocumentId(null);
    }
  };

  const handleRequestSignature = async (document: StoredDocument) => {
    const signerEmail = window.prompt('E-mail do assinante');

    if (!signerEmail?.trim()) return;

    setBusyDocumentId(document.id);

    try {
      await requestSignature({
        document,
        signerEmail: signerEmail.trim(),
        signerName: window.prompt('Nome do assinante')?.trim() || null,
        provider: window.prompt('Provider (internal_pdf, clicksign ou docusign)', 'internal_pdf')?.trim() || 'internal_pdf',
      });
      window.alert('Solicitacao de assinatura registrada.');
    } catch (error) {
      console.error('Document signature request failed:', error);
      window.alert('Nao foi possivel solicitar assinatura.');
    } finally {
      setBusyDocumentId(null);
    }
  };

  const handleRunOcr = async (document: StoredDocument) => {
    setBusyDocumentId(document.id);

    try {
      await runOcr(document);
      window.alert('OCR processado ou encaminhado para provider.');
    } catch (error) {
      console.error('Document OCR failed:', error);
      window.alert('Nao foi possivel processar OCR.');
    } finally {
      setBusyDocumentId(null);
    }
  };

  const handleVersionUploadClick = (document: StoredDocument) => {
    setVersionTarget(document);
    versionInputRef.current?.click();
  };

  const handleVersionSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile || !versionTarget) return;

    setBusyDocumentId(versionTarget.id);

    try {
      await uploadNewVersion({
        document: versionTarget,
        file: selectedFile,
        changeSummary: window.prompt('Resumo das alteracoes desta versao')?.trim() || null,
      });
      window.alert('Nova versao registrada.');
    } catch (error) {
      console.error('Document version upload failed:', error);
      window.alert('Nao foi possivel registrar nova versao.');
    } finally {
      setBusyDocumentId(null);
      setVersionTarget(null);
    }
  };

  const handleCompareVersions = async (document: StoredDocument) => {
    setBusyDocumentId(document.id);

    try {
      const versions = await loadVersions(document.id);
      const [current, previous] = versions;

      if (!current || !previous) {
        window.alert('Este documento ainda nao possui versoes suficientes para comparacao.');
        return;
      }

      window.alert([
        `Comparacao: ${document.displayName}`,
        `Versao atual: v${current.versionNumber} - ${formatBytes(current.sizeBytes)} - ${formatDate(current.createdAt)}`,
        `Versao anterior: v${previous.versionNumber} - ${formatBytes(previous.sizeBytes)} - ${formatDate(previous.createdAt)}`,
        `Diferenca de tamanho: ${formatBytes(Math.abs(current.sizeBytes - previous.sizeBytes))}`,
        current.changeSummary ? `Resumo atual: ${current.changeSummary}` : null,
        previous.changeSummary ? `Resumo anterior: ${previous.changeSummary}` : null,
      ].filter(Boolean).join('\n'));
    } catch (error) {
      console.error('Document version compare failed:', error);
      window.alert('Nao foi possivel comparar versoes.');
    } finally {
      setBusyDocumentId(null);
    }
  };

  const handleDownloadDocument = async (document: StoredDocument) => {
    setBusyDocumentId(document.id);

    try {
      await downloadDocument(document);
    } catch (error) {
      console.error('Document download failed:', error);
      window.alert('Nao foi possivel abrir o documento.');
    } finally {
      setBusyDocumentId(null);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">
              Document Registry
            </span>
            <span className="text-[10px] font-mono text-gray-400">
              STORAGE_USED: {formatBytes(totalStorageUsed)}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-os-text tracking-tight">Arquivos e Documentos</h2>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelection}
          />
          <input
            ref={versionInputRef}
            type="file"
            className="hidden"
            onChange={(event) => void handleVersionSelection(event)}
          />
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={isUploading}
            className="bg-brand text-white text-[10px] px-4 py-2 rounded font-bold hover:bg-os-dark transition-all uppercase tracking-wider flex items-center gap-2 shadow-sm shadow-brand/20 disabled:opacity-60"
          >
            {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Upload Arquivo
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden">
        <div className="lg:col-span-3 space-y-6 overflow-y-auto pr-2 scrollbar-hide">
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Pastas</h3>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveFolder('Todos os Arquivos')}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded shadow-sm text-xs font-bold transition-all',
                  activeFolder === 'Todos os Arquivos'
                    ? 'bg-os-dark text-white transform translate-x-1'
                    : 'text-gray-500 hover:text-os-text hover:bg-white',
                )}
              >
                <Folder className="w-4 h-4 opacity-60" />
                Todos os Arquivos
              </button>
              {folders.map((folder) => (
                <button
                  type="button"
                  key={folder}
                  onClick={() => setActiveFolder(folder)}
                  className={cn(
                    'w-full flex items-center justify-between p-2 rounded text-xs font-medium transition-all group',
                    activeFolder === folder
                      ? 'bg-white text-os-text border border-gray-100'
                      : 'text-gray-500 hover:text-os-text hover:bg-white',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Folder className="w-4 h-4 text-gray-300 group-hover:text-brand transition-colors" />
                    {folder}
                  </div>
                  <span className="text-[9px] font-mono text-gray-300">{folderStats.get(folder) ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded border border-gray-100 bg-white/50 space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Quick Share</h4>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Os arquivos ficam em bucket privado com acesso restrito por organização.
            </p>
            <div className="border-2 border-dashed border-gray-200 rounded p-4 flex items-center justify-center">
              <Share2 className="w-6 h-6 text-gray-200" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 flex flex-col bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 flex items-center gap-4 bg-gray-50/30">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar por nome, extensão ou tag..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-100 rounded text-xs focus:ring-1 focus:ring-brand outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
              <span>FILTRAR_POR:</span>
              <select
                value={activeFolder}
                onChange={(event) => setActiveFolder(event.target.value)}
                className="bg-transparent border-none focus:ring-0 text-os-text font-bold uppercase cursor-pointer"
              >
                <option value="Todos os Arquivos">Todos</option>
                {folders.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-brand" />
                  <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase opacity-40">
                    Loading Registry...
                  </span>
                </div>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 sticky top-0 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Nome do Arquivo</th>
                    <th className="px-6 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Tamanho</th>
                    <th className="px-6 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Modificado</th>
                    <th className="px-6 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Pasta</th>
                    <th className="px-6 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Fluxos</th>
                    <th className="px-6 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredDocuments.map((document) => {
                    const badge = getDocumentBadge(document);
                    const isBusy = busyDocumentId === document.id;

                    return (
                      <tr key={document.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer">
                        <td className="px-6 py-4 text-xs font-bold text-os-text flex items-center gap-3">
                          <div className={cn('w-8 h-8 rounded flex items-center justify-center text-white font-black', badge.className)}>
                            {badge.label}
                          </div>
                          {document.displayName}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-mono text-gray-500">{formatBytes(document.sizeBytes)}</td>
                        <td className="px-6 py-4 text-[10px] font-mono text-gray-500">{formatDate(document.updatedAt)}</td>
                        <td className="px-6 py-4">
                          <span className="px-1.5 py-0.5 rounded-[2px] bg-gray-100 border border-gray-200 text-[9px] font-bold text-gray-500 uppercase tracking-widest uppercase">
                            {document.folder}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            <span className={cn(
                              'px-1.5 py-0.5 rounded-[2px] border text-[8px] font-bold uppercase tracking-widest',
                              document.signatureStatus === 'signed'
                                ? 'bg-green-50 text-green-600 border-green-100'
                                : document.signatureStatus === 'requested'
                                  ? 'bg-blue-50 text-blue-600 border-blue-100'
                                  : 'bg-gray-50 text-gray-400 border-gray-100',
                            )}>
                              SIGN:{document.signatureStatus ?? 'not_requested'}
                            </span>
                            <span className={cn(
                              'px-1.5 py-0.5 rounded-[2px] border text-[8px] font-bold uppercase tracking-widest',
                              document.ocrStatus === 'completed'
                                ? 'bg-green-50 text-green-600 border-green-100'
                                : document.ocrStatus === 'provider_required'
                                  ? 'bg-amber-50 text-amber-600 border-amber-100'
                                  : 'bg-gray-50 text-gray-400 border-gray-100',
                            )}>
                              OCR:{document.ocrStatus ?? 'not_requested'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-[2px] bg-gray-50 border border-gray-100 text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                              V{document.currentVersion ?? 1}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              type="button"
                              onClick={() => void handleRequestSignature(document)}
                              disabled={isBusy}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-white rounded border border-transparent hover:border-gray-100 transition-all disabled:opacity-50"
                              title="Solicitar assinatura"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRunOcr(document)}
                              disabled={isBusy}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-white rounded border border-transparent hover:border-gray-100 transition-all disabled:opacity-50"
                              title="Executar OCR"
                            >
                              <ScanText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVersionUploadClick(document)}
                              disabled={isBusy}
                              className="p-1.5 text-gray-400 hover:text-brand hover:bg-white rounded border border-transparent hover:border-gray-100 transition-all disabled:opacity-50"
                              title="Nova versão"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCompareVersions(document)}
                              disabled={isBusy}
                              className="p-1.5 text-gray-400 hover:text-os-text hover:bg-white rounded border border-transparent hover:border-gray-100 transition-all disabled:opacity-50"
                              title="Comparar versões"
                            >
                              <GitCompare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDownloadDocument(document)}
                              disabled={isBusy}
                              className="p-1.5 text-gray-400 hover:text-os-text hover:bg-white rounded border border-transparent hover:border-gray-100 transition-all disabled:opacity-50"
                              title="Baixar"
                            >
                              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteDocument(document)}
                              disabled={isBusy}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded border border-transparent hover:border-gray-100 transition-all disabled:opacity-50"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-gray-400 hover:text-brand hover:bg-white rounded border border-transparent hover:border-gray-100 transition-all"
                              title="Detalhes"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loading && filteredDocuments.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center grayscale opacity-10">
                <FileText className="w-12 h-12 mb-4" />
                <p className="text-[11px] font-bold uppercase tracking-[0.4em]">Empty Registry</p>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-[10px] font-mono text-gray-400">
            <div className="flex gap-4">
              <span>PÁGINA: 01 / 01</span>
              <span>REGISTROS: {filteredDocuments.length}</span>
            </div>
            <div className="flex gap-1">
              <button type="button" className="px-2 py-1 bg-white border border-gray-200 rounded disabled:opacity-30" disabled>
                ANT
              </button>
              <button type="button" className="px-2 py-1 bg-white border border-gray-200 rounded" disabled>
                PRÓX
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
