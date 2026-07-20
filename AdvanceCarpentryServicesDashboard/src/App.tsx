import { Route, Routes } from "react-router-dom";

import Sidebar from "./components/layout/Sidebar";
import QuotesPage from "./pages/QuotesPage";
import DashboardPage from "./pages/DashboardPage";
import JobsPage from "./pages/JobsPage";
import JobDetailPage from "./pages/JobDetailPage";
import SchedulePage from "./pages/SchedulePage";
import PdfViewerPage from "./pages/PdfViewerPage";


function App() {
    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar />

            <main className="flex-1 p-6">
                <Routes>
                    <Route path="/pdf-viewer" element={<PdfViewerPage />} />
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/jobs" element={<JobsPage />} />
                    <Route path="/quotes" element={<QuotesPage />} />
                    <Route path="/jobs/:jobId" element={<JobDetailPage />} />
                    <Route path="/schedule" element={<SchedulePage />} />
                </Routes>
            </main>
        </div>
    );
}

export default App;