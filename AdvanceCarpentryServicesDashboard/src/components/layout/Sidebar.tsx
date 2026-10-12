import { useEffect, useState, type ComponentType } from "react";
import { NavLink } from "react-router";
import {
    BarChart01,
    Calculator,
    Calendar,
    CheckSquare,
    File05,
    Folder,
    Home01,
    Mail01,
    Moon01,
    Receipt,
    Settings01,
    Sun,
    Tool02,
    TrendUp01,
    Users01,
    Users02,
} from "@untitledui/icons";

type SidebarItem = {
    label: string;
    path: string;
    icon: ComponentType<{ className?: string }>;
    // Not built yet: still listed, but tagged so it isn't a surprise.
    soon?: boolean;
};

const sidebarItems: SidebarItem[] = [
    {
        label: "Dashboard",
        path: "/",
        icon: Home01,
    },
    {
        label: "Quotes",
        path: "/quotes",
        icon: Calculator,
    },
    {
        label: "Plan Viewer",
        path: "/pdf-viewer",
        icon: File05,
    },
    {
        label: "Jobs",
        path: "/jobs",
        icon: Tool02,
    },
    {
        label: "Schedule",
        path: "/schedule",
        icon: Calendar,
    },
    {
        label: "Invoices",
        path: "/invoices",
        icon: Receipt,
    },
    {
        label: "Employees",
        path: "/employees",
        icon: Users02,
    },
    {
        label: "Suppliers",
        path: "/suppliers",
        icon: Users01,
        soon: true,
    },
    {
        label: "Material Prices",
        path: "/material-prices",
        icon: TrendUp01,
        soon: true,
    },
    {
        label: "Emails",
        path: "/emails",
        icon: Mail01,
        soon: true,
    },
    {
        label: "Files",
        path: "/files",
        icon: Folder,
        soon: true,
    },
    {
        label: "Reports",
        path: "/reports",
        icon: BarChart01,
        soon: true,
    },
    {
        label: "Actions / TODO",
        path: "/tasks",
        icon: CheckSquare,
        soon: true,
    },
    {
        label: "Settings",
        path: "/settings",
        icon: Settings01,
        soon: true,
    },
];

type SidebarProps = {
    onLogout: () => void;
    // Phone layout: the sidebar is a slide-over drawer below the md breakpoint.
    open: boolean;
    onNavigate: () => void;
};

function Sidebar({ onLogout, open, onNavigate }: SidebarProps) {
    // index.html already applied the saved choice (or the computer's setting).
    const [dark, setDark] = useState(() =>
        document.documentElement.classList.contains("dark"),
    );

    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
    }, [dark]);

    // Only an explicit click is saved, so "follow the computer" stays the default.
    function toggleDark() {
        const next = !dark;
        setDark(next);

        try {
            localStorage.setItem("theme", next ? "dark" : "light");
        } catch {
            // Storage unavailable; the toggle still works for this session.
        }
    }

    return (
        <aside
            className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 ${
                open ? "translate-x-0" : "-translate-x-full"
            }`}
        >
            <div className="flex h-24 items-center border-b border-gray-200 px-6">
                <div role="img" aria-label="Advance Carpentry Services">
                    <p className="text-lg font-bold leading-tight tracking-tight text-sky-600">
                        Advance
                    </p>
                    <p className="text-lg font-bold leading-tight tracking-tight text-lime-700">
                        Carpentry
                    </p>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Services
                    </p>
                </div>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
                {sidebarItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === "/"}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                            [
                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                                isActive
                                    ? "bg-gray-100 text-gray-950"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-950",
                            ].join(" ")
                        }
                    >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                        {item.soon && (
                            <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Soon
                            </span>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-4 py-4">
                <div>
                    <p className="text-sm font-semibold text-gray-900">Raphael</p>
                    <p className="text-xs text-gray-500">Administrator</p>
                    <button
                        type="button"
                        onClick={onLogout}
                        className="mt-1 text-xs font-medium text-gray-500 underline hover:text-gray-900"
                    >
                        Sign out
                    </button>
                </div>

                <button
                    type="button"
                    onClick={toggleDark}
                    aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                    title={dark ? "Light mode" : "Dark mode"}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                    {dark ? <Sun className="h-5 w-5" /> : <Moon01 className="h-5 w-5" />}
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;