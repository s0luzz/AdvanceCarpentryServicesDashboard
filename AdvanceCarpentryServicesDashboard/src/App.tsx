import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import Sidebar from "./components/layout/Sidebar";
import { useFeedback } from "./components/ui/Feedback";
import QuotesPage from "./pages/QuotesPage";
import DashboardPage from "./pages/DashboardPage";
import JobsPage from "./pages/JobsPage";
import JobDetailPage from "./pages/JobDetailPage";
import SchedulePage from "./pages/SchedulePage";
import PdfViewerPage from "./pages/PdfViewerPage";
import PdfEditorPage from "./pages/PdfEditorPage";
import InvoicesPage from "./pages/InvoicesPage";
import EmployeesPage from "./pages/EmployeesPage";
import LoginPage from "./pages/LoginPage";
import TakeoffPage, { LegacyViewerRedirect } from "./pages/TakeoffPage";
import { ComingSoonPage, NotFoundPage } from "./pages/PlaceholderPages";

type AuthState = "loading" | "in" | "out";

// Sidebar entries that exist but have no page yet.
const COMING_SOON = [
    { path: "/suppliers", title: "Suppliers" },
    { path: "/material-prices", title: "Material Prices" },
    { path: "/emails", title: "Emails" },
    { path: "/files", title: "Files" },
    { path: "/reports", title: "Reports" },
    { path: "/tasks", title: "Actions / TODO" },
    { path: "/settings", title: "Settings" },
];

// Plan/markup workspaces use the whole window: no sidebar, no page padding.
const FULL_SCREEN_ROUTES = [
    /^\/quotes\/[^/]+\/pdf-editor$/,
    /^\/jobs\/[^/]+\/takeoff\/[^/]+$/,
    /^\/pdf-viewer$/,
];

function urlOf(input: Parameters<typeof fetch>[0]) {
    if (typeof input === "string") {
        return input;
    }

    return input instanceof Request ? input.url : String(input);
}

function App() {
    const [auth, setAuth] = useState<AuthState>("loading");
    const [passwordSet, setPasswordSet] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const { toast } = useFeedback();
    const { pathname } = useLocation();

    const fullScreen = FULL_SCREEN_ROUTES.some((pattern) =>
        pattern.test(pathname),
    );

    useEffect(() => {
        fetch("/api/auth/me")
            .then(async (response) => {
                if (response.ok) {
                    setAuth("in");
                    return;
                }

                const body = await response.json().catch(() => null);
                setPasswordSet(body?.passwordSet !== false);
                setAuth("out");
            })
            .catch(() => setAuth("out"));
    }, []);

    // One safety net for every API call:
    //  - 401 (session expired) -> back to the sign-in screen
    //  - server unreachable / server error -> a visible message, so a failed
    //    save never goes unnoticed. (Ordinary 4xx are handled where they happen.)
    useEffect(() => {
        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            const url = urlOf(args[0]);
            const isApi = url.includes("/api/") && !url.includes("/api/auth/");
            let response: Response;

            try {
                response = await originalFetch(...args);
            } catch (error) {
                if (isApi && (error as Error).name !== "AbortError") {
                    toast({
                        message:
                            "Couldn't reach the server. Check your connection and try again.",
                        tone: "error",
                    });
                }

                throw error;
            }

            if (isApi && response.status === 401) {
                setAuth("out");
            } else if (isApi && response.status >= 500) {
                toast({
                    message:
                        "The server ran into a problem. Your last change may not have saved.",
                    tone: "error",
                });
            }

            return response;
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, [toast]);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" }).catch(
            () => undefined,
        );
        setAuth("out");
    }

    if (auth === "loading") {
        return (
            <p className="p-6 text-sm text-gray-500" role="status">
                Loading…
            </p>
        );
    }

    if (auth === "out") {
        return (
            <LoginPage
                passwordSet={passwordSet}
                onLoggedIn={() => setAuth("in")}
            />
        );
    }

    const routes = (
        <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/quotes" element={<QuotesPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route
                path="/jobs/:jobId/takeoff/:fileId"
                element={<TakeoffPage />}
            />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route
                path="/quotes/:jobId/pdf-editor"
                element={<PdfEditorPage />}
            />
            <Route
                path="/quotes/:jobId/pdf-viewer"
                element={<LegacyViewerRedirect />}
            />
            <Route path="/pdf-viewer" element={<PdfViewerPage />} />
            {COMING_SOON.map((item) => (
                <Route
                    key={item.path}
                    path={item.path}
                    element={<ComingSoonPage title={item.title} />}
                />
            ))}
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );

    if (fullScreen) {
        return <main className="min-h-screen bg-gray-50">{routes}</main>;
    }

    return (
        <div className="min-h-screen bg-gray-50 md:flex">
            {/* Phones: slim top bar with a menu button instead of the sidebar. */}
            <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
                <button
                    type="button"
                    onClick={() => setMenuOpen(true)}
                    aria-label="Open menu"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-xl text-gray-700 hover:bg-gray-100"
                >
                    ☰
                </button>

                <p className="text-base font-bold leading-tight tracking-tight">
                    <span className="text-sky-600">Advance</span>{" "}
                    <span className="text-lime-700">Carpentry</span>
                </p>
            </header>

            {menuOpen && (
                <div
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-40 bg-black/40 md:hidden"
                />
            )}

            <Sidebar
                onLogout={handleLogout}
                open={menuOpen}
                onNavigate={() => setMenuOpen(false)}
            />

            {/* The single page container: pages render inside it and add no
                outer padding or <main> of their own. */}
            <main className="min-w-0 flex-1 p-4 md:p-8">{routes}</main>
        </div>
    );
}

export default App;
