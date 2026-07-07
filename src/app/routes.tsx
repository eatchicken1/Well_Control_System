import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Monitoring from './pages/Monitoring';
import WellboreStatusDetail from './pages/WellboreStatusDetail';
import History from './pages/History';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import Baseline from './pages/Baseline';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import RouteError from './pages/RouteError';

function WellControlLayout() {
  return <Layout />;
}

export const router = createBrowserRouter([
  { path: '/login', Component: Login, ErrorBoundary: RouteError },
  {
    Component: ProtectedRoute,
    ErrorBoundary: RouteError,
    children: [
      {
        path: '/',
        Component: WellControlLayout,
        ErrorBoundary: RouteError,
        children: [
          { index: true, Component: Dashboard },
          { path: 'monitoring', Component: Monitoring },
          { path: 'monitoring/wellbore-status', Component: WellboreStatusDetail },
          { path: 'baseline', Component: Baseline },
          { path: 'history', Component: History },
          { path: 'alerts', Component: Alerts },
          { path: 'settings', Component: Settings },
          { path: '*', Component: NotFound },
        ],
      },
    ],
  },
]);
