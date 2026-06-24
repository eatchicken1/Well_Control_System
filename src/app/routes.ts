import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import Monitoring from './pages/Monitoring';
import History from './pages/History';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import Baseline from './pages/Baseline';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'monitoring', Component: Monitoring },
      { path: 'baseline', Component: Baseline },
      { path: 'history', Component: History },
      { path: 'alerts', Component: Alerts },
      { path: 'settings', Component: Settings },
    ],
  },
]);
