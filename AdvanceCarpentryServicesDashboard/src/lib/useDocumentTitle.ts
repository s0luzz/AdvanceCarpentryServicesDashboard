import { useEffect } from "react";

const APP_NAME = "ACS Dashboard";

// Browser tab title: "Jobs · ACS Dashboard" (or just the app name).
export function useDocumentTitle(title?: string) {
    useEffect(() => {
        document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
    }, [title]);
}
