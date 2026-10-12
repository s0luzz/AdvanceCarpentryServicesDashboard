import { useEffect, useState } from "react";
import { Navigate, NavLink, useNavigate, useParams } from "react-router-dom";

import PdfViewer from "../components/PdfViewer";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type JobFile = {
    id: string;
    originalName: string;
    url?: string;
    path: string;
};

type JobWithFiles = {
    id: string;
    name: string;
    files?: JobFile[];
};

function fileUrl(file: JobFile) {
    // The backend hands out paths like "/uploads/…", served through the proxy.
    return file.url ?? file.path;
}

// The calibrated takeoff viewer, on its own address so Back and refresh
// keep you where you were: /jobs/:jobId/takeoff/:fileId
export default function TakeoffPage() {
    const { jobId, fileId } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState<JobWithFiles | null>(null);
    const [state, setState] = useState<"loading" | "ready" | "error">(
        "loading",
    );

    const file = job?.files?.find((item) => item.id === fileId);

    useDocumentTitle(job ? `Takeoff · ${job.name}` : "Takeoff");

    useEffect(() => {
        if (!jobId) {
            return;
        }

        let cancelled = false;

        fetch(`/api/quoted-jobs/${jobId}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Failed to load job");
                }

                return response.json();
            })
            .then((data: JobWithFiles) => {
                if (!cancelled) {
                    setJob(data);
                    setState("ready");
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setState("error");
                }
            });

        return () => {
            cancelled = true;
        };
    }, [jobId]);

    if (state === "loading") {
        return (
            <p className="p-6 text-sm text-gray-500" role="status">
                Loading plan…
            </p>
        );
    }

    if (state === "error" || !job || !file) {
        return (
            <div className="mx-auto max-w-md p-8 text-center">
                <h1 className="text-xl font-semibold text-gray-900">
                    Couldn't find that plan
                </h1>

                <p className="mt-2 text-gray-600">
                    It may have been deleted from the job.
                </p>

                <NavLink
                    to={jobId ? `/jobs/${jobId}` : "/jobs"}
                    className="mt-6 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                    Back to the job
                </NavLink>
            </div>
        );
    }

    return (
        <PdfViewer
            jobId={job.id}
            fileId={file.id}
            file={fileUrl(file)}
            onClose={() => navigate(`/jobs/${job.id}`)}
        />
    );
}

// The old /quotes/:jobId/pdf-viewer address: send it to the job's first plan
// (or the job page if it has none) instead of asking for a file again.
export function LegacyViewerRedirect() {
    const { jobId } = useParams();
    const [target, setTarget] = useState<string | null>(null);

    useEffect(() => {
        if (!jobId) {
            return;
        }

        fetch(`/api/quoted-jobs/${jobId}`)
            .then((response) => (response.ok ? response.json() : null))
            .then((job: JobWithFiles | null) => {
                const first = job?.files?.[0];
                setTarget(
                    first
                        ? `/jobs/${jobId}/takeoff/${first.id}`
                        : `/jobs/${jobId}`,
                );
            })
            .catch(() => setTarget(`/jobs/${jobId}`));
    }, [jobId]);

    return target ? (
        <Navigate to={target} replace />
    ) : (
        <p className="p-6 text-sm text-gray-500" role="status">
            Loading…
        </p>
    );
}
