import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { TabsLayout } from './components/TabsLayout';
import { Toast } from './components/Toast';
import { BrowsePage } from './pages/BrowsePage';
import { HistoryPage } from './pages/HistoryPage';
import { LibraryPage } from './pages/LibraryPage';
import { NovelPage } from './pages/NovelPage';
import { ReaderPage } from './pages/ReaderPage';
import { SettingsPage } from './pages/SettingsPage';
import { SitePage } from './pages/SitePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<TabsLayout />}>
          <Route index element={<LibraryPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="browse" element={<BrowsePage />} />
          <Route path="browse/:sourceId" element={<SitePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="novel/:novelId" element={<NovelPage />} />
        <Route path="read/:novelId/:index" element={<ReaderPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </BrowserRouter>
  );
}
