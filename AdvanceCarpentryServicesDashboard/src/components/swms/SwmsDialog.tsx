import { useEffect, useState } from "react";

import { downloadSwms } from "../../lib/downloadInvoice";

type SwmsDialogProps = {
    // The job the SWMS is for: its address is the workplace location.
    job: { address: string };
    onClose: () => void;
    onDone: (message: string) => void;
};

const INPUT =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";

function todayIso() {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");

    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function SwmsDialog({ job, onClose, onDone }: SwmsDialogProps) {
    const [date, setDate] = useState(todayIso());
    const [location, setLocation] = useState(job.address);
    const [person, setPerson] = useState("");
    const [principalContractor, setPrincipalContractor] = useState("");
    const [workers, setWorkers] = useState("");
    const [maxWorkers, setMaxWorkers] = useState(24);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    // Principal contractor, person responsible and the workers carry over from
    // the last SWMS that was made.
    useEffect(() => {
        fetch("/api/swms/defaults")
            .then((response) => response.json())
            .then((defaults) => {
                setPerson(defaults.person ?? "");
                setPrincipalContractor(defaults.principalContractor ?? "");
                setWorkers((defaults.workers ?? []).join("\n"));
                setMaxWorkers(defaults.maxWorkers ?? 24);
            })
            .catch(() => setError("Couldn't load the last SWMS details."))
            .finally(() => setReady(true));
    }, []);

    const workerList = workers
        .split("\n")
        .map((name) => name.trim())
        .filter(Boolean);
    const complete =
        ready &&
        date &&
        location.trim() &&
        person.trim() &&
        principalContractor.trim() &&
        workerList.length <= maxWorkers;

    async function download(format: "docx" | "pdf") {
        setBusy(true);
        setError("");

        try {
            await downloadSwms(
                {
                    principalContractor,
                    person,
                    location,
                    date,
                    workers: workerList,
                },
                format,
            );
            onDone(`SWMS ${format === "docx" ? "Word file" : "PDF"} downloaded.`);
            onClose();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Couldn't create the SWMS.");
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">SWMS</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Your SWMS with these details filled in. Everything else stays as it is.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Close dialog"
                    >
                        ×
                    </button>
                </div>

                <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">
                        Date
                        <input type="date" className={`${INPUT} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                        Workplace location
                        <input className={`${INPUT} mt-1`} value={location} onChange={(e) => setLocation(e.target.value)} />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                        Person responsible
                        <input className={`${INPUT} mt-1`} value={person} onChange={(e) => setPerson(e.target.value)} disabled={!ready} />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                        Principal contractor
                        <input
                            className={`${INPUT} mt-1`}
                            value={principalContractor}
                            onChange={(e) => setPrincipalContractor(e.target.value)}
                            disabled={!ready}
                        />
                    </label>

                    <details className="rounded-lg border border-gray-200 px-4 py-3">
                        <summary className="cursor-pointer text-sm font-medium text-gray-700">
                            Workers ({workerList.length})
                        </summary>

                        <label className="mt-3 block text-sm text-gray-600">
                            One name per line, as they should appear on the sign-in sheet.
                            <textarea
                                rows={10}
                                className={`${INPUT} mt-2`}
                                value={workers}
                                onChange={(e) => setWorkers(e.target.value)}
                                disabled={!ready}
                            />
                        </label>

                        {workerList.length > maxWorkers && (
                            <p className="mt-2 text-sm text-red-600">
                                Only {maxWorkers} workers fit on the SWMS.
                            </p>
                        )}
                    </details>
                </div>

                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                        Cancel
                    </button>

                    {(["docx", "pdf"] as const).map((format) => (
                        <button
                            key={format}
                            type="button"
                            onClick={() => void download(format)}
                            disabled={busy || !complete}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                            {busy ? "Creating..." : format === "docx" ? "Word" : "PDF"}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
