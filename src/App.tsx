import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { TabsLayout } from './components/TabsLayout';
import { Toast } from './components/Toast';
import { BrowsePage } from './pages/BrowsePage';
import { HistoryPage } from './pages/HistoryPage';
import { LibraryPage } from './pages/LibraryPage';
import { NovelPage } from './pages/NovelPage';
import { ReaderPage } from './pages/ReaderPage';
import { SettingsPage, SettingsSectionPage } from './pages/SettingsPage';
import { SitePage } from './pages/SitePage';
import { StatsPage } from './pages/StatsPage';
import { UpdatesPage } from './pages/UpdatesPage';

// The pet's drawing and catalog load only when its tab is opened.
const PetPage = lazy(() => import('./pages/PetPage').then((m) => ({ default: m.PetPage })));

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<TabsLayout />}>
          <Route index element={<LibraryPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="browse" element={<BrowsePage />} />
          <Route path="browse/:sourceId" element={<SitePage />} />
          <Route
            path="pet"
            element={
              <Suspense fallback={null}>
                <PetPage />
              </Suspense>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/:section" element={<SettingsSectionPage />} />
        </Route>
        <Route path="novel/:novelId" element={<NovelPage />} />
        <Route path="read/:novelId/:index" element={<ReaderPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="updates" element={<UpdatesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </BrowserRouter>
  );
}
