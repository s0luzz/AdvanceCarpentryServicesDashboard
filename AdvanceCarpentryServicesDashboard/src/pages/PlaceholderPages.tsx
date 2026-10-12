import { NavLink } from "react-router-dom";

import { useDocumentTitle } from "../lib/useDocumentTitle";

export function ComingSoonPage({ title }: { title: string }) {
    useDocumentTitle(title);

    return (
        <div className="mx-auto max-w-md py-16 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">
                {title}
            </h1>

            <p className="mt-3 text-gray-600">
                This part of the dashboard isn't built yet.
            </p>

            <NavLink
                to="/"
                className="mt-6 inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
                Back to dashboard
            </NavLink>
        </div>
    );
}

export function NotFoundPage() {
    useDocumentTitle("Page not found");

    return (
        <div className="mx-auto max-w-md py-16 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">
                Page not found
            </h1>

            <p className="mt-3 text-gray-600">
                There's nothing at this address.
            </p>

            <NavLink
                to="/"
                className="mt-6 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
                Back to dashboard
            </NavLink>
        </div>
    );
}
