import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/shell';
import Overview from '@/pages/overview';
import Holdings from '@/pages/holdings';
import ImportPage from '@/pages/import';
import Insights from '@/pages/insights';
import ExportPage from '@/pages/export';
import Onboarding from '@/pages/onboarding';
import Welcome from '@/pages/welcome';
import AdminOutreach from '@/pages/admin-outreach';

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Overview} />
          <Route path="/onboarding" component={Onboarding} />
          <Route path="/holdings" component={Holdings} />
          <Route path="/import" component={ImportPage} />
          <Route path="/insights" component={Insights} />
          <Route path="/export" component={ExportPage} />
          <Route path="/welcome" component={Welcome} />
          <Route path="/admin/outreach" component={AdminOutreach} />
          <Route path="/outreach"><Redirect to="/admin/outreach" replace /></Route>
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
