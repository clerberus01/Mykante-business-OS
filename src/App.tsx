import React, { lazy, Suspense, useCallback } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import Layout from './components/Layout';
import { useAuth } from './contexts/AuthContext';
import ContentErrorBoundary from './components/ContentErrorBoundary';
import { setPendingNavigationIntent } from './lib/navigation';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const CRM = lazy(() => import('./pages/CRM'));
const Login = lazy(() => import('./pages/Login'));
const Projects = lazy(() => import('./pages/Projects'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Documents = lazy(() => import('./pages/Documents'));
const Settings = lazy(() => import('./pages/Settings'));
const Finance = lazy(() => import('./pages/Finance'));
const Communications = lazy(() => import('./pages/Communications'));

const tabRoutes: Record<string, string> = {
  dashboard: '/',
  crm: '/crm',
  projects: '/projects',
  calendar: '/calendar',
  finance: '/finance',
  messages: '/messages',
  docs: '/docs',
  settings: '/settings',
};

const routeTabs: Record<string, string> = {
  '/': 'dashboard',
  '/crm': 'crm',
  '/projects': 'projects',
  '/calendar': 'calendar',
  '/finance': 'finance',
  '/messages': 'messages',
  '/docs': 'docs',
  '/settings': 'settings',
};

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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeTab = routeTabs[pathname] ?? 'dashboard';
  const setActiveTab = useCallback(
    (tab: string) => {
      void navigate({ to: tabRoutes[tab] ?? '/' });
    },
    [navigate],
  );

  if (loading) {
    return <AppLoadingFallback />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <ContentErrorBoundary resetKey={activeTab}>
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
          setPendingNavigationIntent({ kind: 'open-project', projectId });
          void navigate({ to: '/projects' });
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
          setPendingNavigationIntent({ kind: 'open-project', projectId });
          void navigate({ to: '/projects' });
        }}
        onOpenFinance={() => {
          void navigate({ to: '/finance' });
        }}
        onCreateTransaction={(timestamp) => {
          setPendingNavigationIntent({ kind: 'create-transaction', timestamp });
          void navigate({ to: '/finance' });
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

function SettingsRoute() {
  return <ProtectedShell><Settings /></ProtectedShell>;
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardRoute,
});

const crmRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/crm',
  component: CrmRoute,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsRoute,
});

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: CalendarRoute,
});

const financeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/finance',
  component: FinanceRoute,
});

const communicationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/messages',
  component: CommunicationsRoute,
});

const documentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs',
  component: DocumentsRoute,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  crmRoute,
  projectsRoute,
  calendarRoute,
  financeRoute,
  communicationsRoute,
  documentsRoute,
  settingsRoute,
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
