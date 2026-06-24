import { RouterProvider } from 'react-router';
import { router } from './routes';
import { WellControlProvider } from './context/WellControlContext';

export default function App() {
  return (
    <WellControlProvider>
      <RouterProvider router={router} />
    </WellControlProvider>
  );
}
