import { useRef, useState, type FormEvent } from "react";

import { useDocumentTitle } from "../lib/useDocumentTitle";

type LoginPageProps = {
    passwordSet: boolean;
    onLoggedIn: () => void;
};

const FOCUS_RING =
    "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30";

export default function LoginPage({
    passwordSet,
    onLoggedIn,
}: LoginPageProps) {
    useDocumentTitle("Sign in");

    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [shake, setShake] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!password || submitting) {
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            if (response.ok) {
                onLoggedIn();
                return;
            }

            const body = await response.json().catch(() => null);
            setError(body?.message ?? "Couldn't sign in.");
            setShake(true);
            setPassword("");
        } catch {
            setError(
                "Couldn't reach the server. Check it's running and try again.",
            );
            setShake(true);
        } finally {
            setSubmitting(false);
            // The field was cleared and the button disabled, which drops
            // focus; put the cursor back so they can just retype.
            inputRef.current?.focus();
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-sm">
                <div
                    role="img"
                    aria-label="Advance Carpentry Services"
                    className="mb-6 text-center"
                >
                    <p className="text-2xl font-bold leading-tight tracking-tight text-sky-600">
                        Advance
                    </p>
                    <p className="text-2xl font-bold leading-tight tracking-tight text-lime-700">
                        Carpentry
                    </p>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Services
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    onAnimationEnd={() => setShake(false)}
                    className={`rounded-2xl border border-gray-200 bg-white p-6 shadow-sm ${
                        shake ? "animate-shake" : ""
                    }`}
                >
                    <h1 className="text-lg font-semibold text-gray-900">
                        Sign in
                    </h1>

                    <p className="mt-1 text-sm text-gray-500">
                        Enter the dashboard password to continue.
                    </p>

                    {!passwordSet && (
                        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            No password has been set yet. On the computer
                            running the server, run{" "}
                            <code className="font-semibold">
                                npm run set-password
                            </code>
                            .
                        </p>
                    )}

                    <label
                        htmlFor="password"
                        className="mt-5 block text-sm font-medium text-gray-700"
                    >
                        Password
                    </label>

                    <div className="relative mt-2">
                        {/* 16px text stops iPhone Safari zooming in on focus. */}
                        <input
                            ref={inputRef}
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            autoFocus
                            autoComplete="current-password"
                            aria-describedby="login-error"
                            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-20 text-base text-gray-900 outline-none focus-visible:border-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/20"
                        />

                        <button
                            type="button"
                            onClick={() =>
                                setShowPassword((value) => !value)
                            }
                            aria-pressed={showPassword}
                            aria-label="Show password"
                            className={`absolute inset-y-0 right-0 rounded-r-lg px-4 text-xs font-medium text-gray-600 hover:text-gray-900 ${FOCUS_RING}`}
                        >
                            {showPassword ? "Hide" : "Show"}
                        </button>
                    </div>

                    {/* Reserved space, so the card doesn't jump when an error appears. */}
                    <p
                        id="login-error"
                        role="alert"
                        className="mt-3 min-h-10 text-sm font-medium text-red-600"
                    >
                        {error}
                    </p>

                    <button
                        type="submit"
                        disabled={!password || submitting}
                        className={`w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-[0.98] active:bg-gray-950 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:active:scale-100 focus-visible:ring-offset-2 ${FOCUS_RING}`}
                    >
                        {submitting ? "Signing in…" : "Sign in"}
                    </button>
                </form>
            </div>
        </main>
    );
}
