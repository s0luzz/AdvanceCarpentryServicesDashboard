import { useEffect, useRef, useState } from "react";
import { DotsHorizontal } from "@untitledui/icons";

export type RowMenuItem = {
    label: string;
    onSelect: () => void;
    destructive?: boolean;
};

// A "…" button that opens a small menu. Keeps rare/destructive actions
// (like Delete) away from the everyday buttons in a row.
export default function RowMenu({
    items,
    label,
}: {
    items: RowMenuItem[];
    label: string;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const close = (event: MouseEvent | KeyboardEvent) => {
            if (
                event instanceof KeyboardEvent
                    ? event.key === "Escape"
                    : !rootRef.current?.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", close);

        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", close);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
                <DotsHorizontal className="h-5 w-5" />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 z-30 mt-1 min-w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                >
                    {items.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setOpen(false);
                                item.onSelect();
                            }}
                            className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                                item.destructive
                                    ? "font-medium text-red-600"
                                    : "text-gray-700"
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
