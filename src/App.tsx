import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Instalaciones from './pages/Instalaciones';
import Tecnicos from './pages/Tecnicos';
import Visitas from './pages/Visitas';
import Informes from './pages/Informes';
import Incidencias from './pages/Incidencias';
import Checklists from './pages/Checklists';
import Mapa from './pages/Mapa';
import Calendario from './pages/Calendario';

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/instalaciones" element={<Instalaciones />} />
              <Route path="/tecnicos" element={<Tecnicos />} />
              <Route path="/visitas" element={<Visitas />} />
              <Route path="/informes" element={<Informes />} />
              <Route path="/incidencias" element={<Incidencias />} />
              <Route path="/checklists" element={<Checklists />} />
              <Route path="/mapa" element={<Mapa />} />
              <Route path="/calendario" element={<Calendario />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
