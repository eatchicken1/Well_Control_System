import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { WellControlProvider } from './context/WellControlContext';
import Dashboard from './pages/Dashboard';
import Monitoring from './pages/Monitoring';
import History from './pages/History';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import Baseline from './pages/Baseline';
import Login from './pages/Login';

function WellControlLayout() {
  return (
    <WellControlProvider>
      <Layout />
    </WellControlProvider>
  );
}

export const router = createBrowserRouter([
  { path: '/login', Component: Login },
  {
    Component: ProtectedRoute,
    children: [
      {
        path: '/',
        Component: WellControlLayout,
        children: [
          { index: true, Component: Dashboard },
          { path: 'monitoring', Component: Monitoring },
          { path: 'baseline', Component: Baseline },
          { path: 'history', Component: History },
          { path: 'alerts', Component: Alerts },
          { path: 'settings', Component: Settings },
        ],
      },
    ],
  },
]);
