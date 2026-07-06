import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { WellControlProvider } from './context/WellControlContext';

export default function App() {
  return (
    <AuthProvider>
      <WellControlProvider>
        <RouterProvider router={router} />
      </WellControlProvider>
    </AuthProvider>
  );
}
