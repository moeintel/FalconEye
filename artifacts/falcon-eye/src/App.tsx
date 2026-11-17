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
import FinanceOverview from '@/pages/finance-overview';
import FinanceAssets from '@/pages/finance-assets';
import FinanceActivity from '@/pages/finance-activity';
import FinanceReports from '@/pages/finance-reports';
import FinanceSettings from '@/pages/finance-settings';
import DesignGuide from '@/pages/design-guide';
import { FinanceShell } from '@/components/finance-shell';
import { AccountStatus, FinanceAccount } from '@/components/finance-account';
import { FalcAssistant } from '@/components/falc-assistant';
import './finance.css';
import './assistant.css';

const queryClient = new QueryClient();

function Router() {
  return (
    <>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/"><FinanceOverview accountStatus={<AccountStatus />} /></Route>
          <Route path="/assets"><FinanceAssets accountStatus={<AccountStatus />} /></Route>
          <Route path="/debts"><FinanceAssets debtOnly accountStatus={<AccountStatus />} /></Route>
          <Route path="/activity"><FinanceActivity accountStatus={<AccountStatus />} /></Route>
          <Route path="/reports"><FinanceReports accountStatus={<AccountStatus />} /></Route>
          <Route path="/settings"><FinanceSettings accountPanel={<FinanceAccount />} /></Route>
          <Route path="/design-guide"><FinanceShell><DesignGuide /></FinanceShell></Route>
          <Route path="/holdings"><Redirect to="/assets" replace /></Route>
          <Route path="/export"><Redirect to="/reports" replace /></Route>
          <Route path="/insights"><Redirect to="/" replace /></Route>
          <Route path="/onboarding"><Redirect to="/assets" replace /></Route>
          <Route path="/import"><Redirect to="/assets" replace /></Route>
          <Route path="/welcome"><FinanceShell><Welcome /></FinanceShell></Route>
          <Route path="/admin/outreach"><FinanceShell><AdminOutreach /></FinanceShell></Route>
          <Route path="/outreach"><Redirect to="/admin/outreach" replace /></Route>
          <Route path="/legacy/holdings"><Shell><Holdings /></Shell></Route>
          <Route path="/legacy/import"><Shell><ImportPage /></Shell></Route>
          <Route path="/legacy/overview"><Shell><Overview /></Shell></Route>
          <Route path="/legacy/onboarding"><Shell><Onboarding /></Shell></Route>
          <Route path="/legacy/insights"><Shell><Insights /></Shell></Route>
          <Route path="/legacy/export"><Shell><ExportPage /></Shell></Route>
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
      <FalcAssistant />
    </>
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
