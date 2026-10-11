import { useEffect, useState } from "react";
import { NavLink } from "react-router";

type SidebarItem = {
    label: string;
    path: string;
    icon: string;
};

const sidebarItems: SidebarItem[] = [
    {
        label: "Dashboard",
        path: "/",
        icon: "🏠",
    },
    {
        label: "Quotes",
        path: "/quotes",
        icon: "🧮",
    },
    {
        label: "PdfViewer",
        path: "/pdf-viewer",
        icon: "📄",
    },
    {
        label: "Jobs",
        path: "/jobs",
        icon: "🛠️",
    },
    {
        label: "Schedule",
        path: "/schedule",
        icon: "📅",
    },
    {
        label: "Invoices",
        path: "/invoices",
        icon: "🧾",
    },
    {
        label: "Suppliers",
        path: "/suppliers",
        icon: "👥",
    },
    {
        label: "Material Prices",
        path: "/material-prices",
        icon: "📈",
    },
    {
        label: "Emails",
        path: "/emails",
        icon: "✉️",
    },
    {
        label: "Files",
        path: "/files",
        icon: "📄",
    },
    {
        label: "Reports",
        path: "/reports",
        icon: "📊",
    },
    {
        label: "Actions / TODO",
        path: "/tasks",
        icon: "✅",
    },
    {
        label: "Settings",
        path: "/settings",
        icon: "⚙️",
    },
];

function Sidebar() {
    const [dark, setDark] = useState(() => {
        try {
            return localStorage.getItem("theme") === "dark";
        } catch {
            return false;
        }
    });

    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);

        try {
            localStorage.setItem("theme", dark ? "dark" : "light");
        } catch {
            // Storage unavailable; the toggle still works for this session.
        }
    }, [dark]);

    return (
        <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
            <div className="flex h-24 items-center border-b border-gray-200 px-6">
                <div>
                    <h1 className="text-lg font-bold leading-tight text-sky-500">
                        Advance
                    </h1>
                    <h2 className="text-lg font-bold leading-tight text-lime-500">
                        Carpentry
                    </h2>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
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
                        className={({ isActive }) =>
                            [
                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                                isActive
                                    ? "bg-gray-100 text-gray-950"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-950",
                            ].join(" ")
                        }
                    >
                        <span className="w-5 text-base">{item.icon}</span>
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-4 py-4">
                <div>
                    <p className="text-sm font-semibold text-gray-900">Raphael</p>
                    <p className="text-xs text-gray-500">Administrator</p>
                </div>

                <button
                    type="button"
                    onClick={() => setDark((value) => !value)}
                    aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                    title={dark ? "Light mode" : "Dark mode"}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-base hover:bg-gray-100"
                >
                    {dark ? "☀️" : "🌙"}
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;