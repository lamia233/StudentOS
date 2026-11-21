import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppLayout } from './components/AppLayout';
import { PageLoader, Spinner } from './components/ui';
import Landing from './pages/Landing';
import { Login, Register } from './pages/Auth';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Academics = lazy(() => import('./pages/Academics'));
const Planner = lazy(() => import('./pages/Planner'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Knowledge = lazy(() => import('./pages/Knowledge'));
const Career = lazy(() => import('./pages/Career'));
const Skills = lazy(() => import('./pages/Skills'));
const Campus = lazy(() => import('./pages/Campus'));
const Productivity = lazy(() => import('./pages/Productivity'));
const Radar = lazy(() => import('./pages/Radar'));
const Focus = lazy(() => import('./pages/Focus'));
const Assistant = lazy(() => import('./pages/Assistant'));
const Notion = lazy(() => import('./pages/Notion'));
const Settings = lazy(() => import('./pages/Settings'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const NotFound = lazy(() => import('./pages/NotFound'));

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!user.onboarded && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenSpinner />;
  if (user) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Lazy><Dashboard /></Lazy>} />
          <Route path="academics" element={<Lazy><Academics /></Lazy>} />
          <Route path="planner" element={<Lazy><Planner /></Lazy>} />
          <Route path="calendar" element={<Lazy><CalendarPage /></Lazy>} />
          <Route path="tasks" element={<Lazy><Tasks /></Lazy>} />
          <Route path="knowledge" element={<Lazy><Knowledge /></Lazy>} />
          <Route path="career" element={<Lazy><Career /></Lazy>} />
          <Route path="skills" element={<Lazy><Skills /></Lazy>} />
          <Route path="campus" element={<Lazy><Campus /></Lazy>} />
          <Route path="productivity" element={<Lazy><Productivity /></Lazy>} />
          <Route path="radar" element={<Lazy><Radar /></Lazy>} />
          <Route path="focus" element={<Lazy><Focus /></Lazy>} />
          <Route path="assistant" element={<Lazy><Assistant /></Lazy>} />
          <Route path="notion" element={<Lazy><Notion /></Lazy>} />
          <Route path="settings" element={<Lazy><Settings /></Lazy>} />
          <Route path="*" element={<Lazy><NotFound /></Lazy>} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}
