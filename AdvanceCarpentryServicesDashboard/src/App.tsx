import { Route, Routes } from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import JobsPage from "./pages/JobsPage";
import JobDetailPage from "./pages/JobDetailPage";
import SchedulePage from "./pages/SchedulePage";

function App() {
    return (
        <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
        </Routes>
    );
}

export default App;