import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

type Tone = "info" | "success" | "error";

export type ToastOptions = {
    message: string;
    tone?: Tone;
    action?: { label: string; onClick: () => void };
    durationMs?: number;
};

export type ConfirmOptions = {
    title: string;
    message?: string;
    confirmLabel?: string;
    // Red confirm button, and Cancel is focused first so Enter is safe.
    destructive?: boolean;
};

type Feedback = {
    toast: (options: ToastOptions | string) => void;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<Feedback | null>(null);

type ToastItem = ToastOptions & { id: number };

const DEFAULT_DURATION_MS = 5000;

export function FeedbackProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [pendingConfirm, setPendingConfirm] = useState<
        (ConfirmOptions & { resolve: (value: boolean) => void }) | null
    >(null);
    const nextId = useRef(1);
    const timers = useRef(new Map<number, number>());

    const dismiss = useCallback((id: number) => {
        window.clearTimeout(timers.current.get(id));
        timers.current.delete(id);
        setToasts((current) => current.filter((item) => item.id !== id));
    }, []);

    const toast = useCallback(
        (input: ToastOptions | string) => {
            const options: ToastOptions =
                typeof input === "string" ? { message: input } : input;

            // The same message arriving again (e.g. repeated autosave
            // failures) refreshes the existing toast instead of stacking.
            setToasts((current) => {
                const existing = current.find(
                    (item) =>
                        item.message === options.message &&
                        !options.action &&
                        !item.action,
                );
                const id = existing?.id ?? nextId.current++;

                window.clearTimeout(timers.current.get(id));
                timers.current.set(
                    id,
                    window.setTimeout(
                        () => dismiss(id),
                        options.durationMs ?? DEFAULT_DURATION_MS,
                    ),
                );

                return existing
                    ? current
                    : [...current, { ...options, id }];
            });
        },
        [dismiss],
    );

    const confirm = useCallback(
        (options: ConfirmOptions) =>
            new Promise<boolean>((resolve) =>
                setPendingConfirm({ ...options, resolve }),
            ),
        [],
    );

    const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

    function answer(result: boolean) {
        pendingConfirm?.resolve(result);
        setPendingConfirm(null);
    }

    return (
        <FeedbackContext.Provider value={value}>
            {children}

            <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex flex-col items-center gap-2 px-4">
                {toasts.map((item) => (
                    <div
                        key={item.id}
                        role={item.tone === "error" ? "alert" : "status"}
                        className={`pointer-events-auto flex max-w-md items-center gap-4 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
                            item.tone === "error"
                                ? "bg-red-700"
                                : "bg-slate-900"
                        }`}
                    >
                        <span className="min-w-0 flex-1">{item.message}</span>

                        {item.action && (
                            <button
                                type="button"
                                onClick={() => {
                                    item.action?.onClick();
                                    dismiss(item.id);
                                }}
                                className="shrink-0 font-semibold text-sky-300 hover:text-sky-200"
                            >
                                {item.action.label}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => dismiss(item.id)}
                            aria-label="Dismiss"
                            className="shrink-0 text-lg leading-none text-white/70 hover:text-white"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {pendingConfirm && (
                <ConfirmDialog
                    {...pendingConfirm}
                    onAnswer={answer}
                />
            )}
        </FeedbackContext.Provider>
    );
}

function ConfirmDialog({
    title,
    message,
    confirmLabel = "Confirm",
    destructive,
    onAnswer,
}: ConfirmOptions & { onAnswer: (value: boolean) => void }) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    const confirmRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        (destructive ? cancelRef : confirmRef).current?.focus();
    }, [destructive]);

    return (
        <div
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4"
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    onAnswer(false);
                }
            }}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            >
                <h2
                    id="confirm-title"
                    className="text-lg font-semibold text-gray-900"
                >
                    {title}
                </h2>

                {message && (
                    <p className="mt-2 text-sm text-gray-600">{message}</p>
                )}

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={() => onAnswer(false)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                        Cancel
                    </button>

                    <button
                        ref={confirmRef}
                        type="button"
                        onClick={() => onAnswer(true)}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                            destructive
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-gray-900 hover:bg-gray-800"
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function useFeedback() {
    const context = useContext(FeedbackContext);

    if (!context) {
        throw new Error("useFeedback must be used inside FeedbackProvider");
    }

    return context;
}
