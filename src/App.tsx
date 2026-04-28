import React, { lazy, Suspense } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { z } from 'zod';
import Layout from './shared/components/Layout';
import { useAuth } from './contexts/AuthContext';
import ContentErrorBoundary from './shared/components/ContentErrorBoundary';
import MfaGate from './features/auth/components/MfaGate';

const Dashboard = lazy(() => import('./features/dashboard/pages/Dashboard'));
const CRM = lazy(() => import('./features/crm/pages/CRM'));
const Login = lazy(() => import('./features/auth/pages/Login'));
const Projects = lazy(() => import('./features/projects/pages/Projects'));
const Calendar = lazy(() => import('./features/calendar/pages/Calendar'));
const Documents = lazy(() => import('./features/documents/pages/Documents'));
const Contracts = lazy(() => import('./features/contracts/pages/Contracts'));
const Settings = lazy(() => import('./features/settings/pages/Settings'));
const Finance = lazy(() => import('./features/finance/pages/Finance'));
const Communications = lazy(() => import('./features/communications/pages/Communications'));
const Automations = lazy(() => import('./features/automations/pages/Automations'));
const PlatformAdmin = lazy(() => import('./features/platform-admin/pages/PlatformAdmin'));
const ProposalStatus = lazy(() => import('./pages/public/ProposalStatus'));
const ClientStatus = lazy(() => import('./pages/public/ClientStatus'));

const emptySearchSchema = z.object({}).catch({});
const crmSearchSchema = z.object({
  clientId: z.string().min(1).optional(),
  action: z.enum(['create-client']).optional(),
}).catch({});
const projectsSearchSchema = z.object({
  projectId: z.string().min(1).optional(),
  action: z.enum(['create-project']).optional(),
}).catch({});
const financeSearchSchema = z.object({
  action: z.enum(['create-transaction']).optional(),
  timestamp: z.coerce.number().finite().optional(),
}).catch({});
const documentsSearchSchema = z.object({
  action: z.enum(['upload-document']).optional(),
}).catch({});

function AppLoadingFallback() {
  return (
    <div className="min-h-screen bg-os-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-mono font-bold tracking-[0.3em] text-gray-400 uppercase">Booting OS...</p>
      </div>
    </div>
  );
}

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { user, loading, mfaRequired } = useAuth();
  const routeKey = useRouterState({
    select: (state) => `${state.location.pathname}:${JSON.stringify(state.location.search)}`,
  });

  if (loading) {
    return <AppLoadingFallback />;
  }

  if (!user) {
    return <Login />;
  }

  if (mfaRequired) {
    return <MfaGate />;
  }

  return (
    <Layout>
      <ContentErrorBoundary resetKey={routeKey}>
        {children}
      </ContentErrorBoundary>
    </Layout>
  );
}

function DashboardRoute() {
  const navigate = useNavigate();

  return (
    <ProtectedShell>
      <Dashboard
        onOpenProject={(projectId) => {
          void navigate({ to: '/projects', search: { projectId } });
        }}
      />
    </ProtectedShell>
  );
}

function CalendarRoute() {
  const navigate = useNavigate();

  return (
    <ProtectedShell>
      <Calendar
        onOpenProject={(projectId) => {
          void navigate({ to: '/projects', search: { projectId } });
        }}
        onOpenFinance={() => {
          void navigate({ to: '/finance' });
        }}
        onCreateTransaction={(timestamp) => {
          void navigate({ to: '/finance', search: { action: 'create-transaction', timestamp } });
        }}
      />
    </ProtectedShell>
  );
}

function CrmRoute() {
  return <ProtectedShell><CRM /></ProtectedShell>;
}

function ProjectsRoute() {
  return <ProtectedShell><Projects /></ProtectedShell>;
}

function FinanceRoute() {
  return <ProtectedShell><Finance /></ProtectedShell>;
}

function CommunicationsRoute() {
  return <ProtectedShell><Communications /></ProtectedShell>;
}

function DocumentsRoute() {
  return <ProtectedShell><Documents /></ProtectedShell>;
}

function ContractsRoute() {
  return <ProtectedShell><Contracts /></ProtectedShell>;
}

function AutomationsRoute() {
  return <ProtectedShell><Automations /></ProtectedShell>;
}

function SettingsRoute() {
  return <ProtectedShell><Settings /></ProtectedShell>;
}

function PlatformAdminRoute() {
  return <ProtectedShell><PlatformAdmin /></ProtectedShell>;
}

function PublicProposalStatusRoute() {
  return <ProposalStatus />;
}

function PublicClientStatusRoute() {
  return <ClientStatus />;
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardRoute,
  validateSearch: (search) => emptySearchSchema.parse(search),
});

const crmRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/crm',
  component: CrmRoute,
  validateSearch: (search) => crmSearchSchema.parse(search),
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsRoute,
  validateSearch: (search) => projectsSearchSchema.parse(search),
});

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: CalendarRoute,
  validateSearch: (search) => emptySearchSchema.parse(search),
});

const financeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/finance',
  component: FinanceRoute,
  validateSearch: (search) => financeSearchSchema.parse(search),
});

const communicationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/messages',
  component: CommunicationsRoute,
  validateSearch: (search) => emptySearchSchema.parse(search),
});

const documentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs',
  component: DocumentsRoute,
  validateSearch: (search) => documentsSearchSchema.parse(search),
});

const contractsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/contracts',
  component: ContractsRoute,
  validateSearch: (search) => emptySearchSchema.parse(search),
});

const automationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/automations',
  component: AutomationsRoute,
  validateSearch: (search) => emptySearchSchema.parse(search),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsRoute,
  validateSearch: (search) => emptySearchSchema.parse(search),
});

const platformAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: PlatformAdminRoute,
  validateSearch: (search) => emptySearchSchema.parse(search),
});

const publicProposalStatusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/proposal/$token',
  component: PublicProposalStatusRoute,
});

const publicClientStatusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/status/$token',
  component: PublicClientStatusRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  crmRoute,
  projectsRoute,
  calendarRoute,
  financeRoute,
  communicationsRoute,
  documentsRoute,
  contractsRoute,
  automationsRoute,
  settingsRoute,
  platformAdminRoute,
  publicProposalStatusRoute,
  publicClientStatusRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <Suspense fallback={<AppLoadingFallback />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
