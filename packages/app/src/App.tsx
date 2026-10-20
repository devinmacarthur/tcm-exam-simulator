import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import Dashboard from './pages/Dashboard.tsx';
import ExamSetup from './pages/ExamSetup.tsx';
import StudySetup from './pages/StudySetup.tsx';
import Runner from './pages/Runner.tsx';
import Results from './pages/Results.tsx';
import Analytics from './pages/Analytics.tsx';
import Bank from './pages/Bank.tsx';
import Distinctions from './pages/Distinctions.tsx';
import Settings from './pages/Settings.tsx';
import History from './pages/History.tsx';
import About from './pages/About.tsx';

export default function App() {
  return (
    <Routes>
      <Route path="/attempt/:id" element={<Runner />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/exam" element={<ExamSetup />} />
        <Route path="/study" element={<StudySetup />} />
        <Route path="/results/:id" element={<Results />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/bank" element={<Bank />} />
        <Route path="/distinctions" element={<Distinctions />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}
