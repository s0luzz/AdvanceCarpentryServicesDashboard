import { useParams } from "react-router-dom";

function JobDetailPage() {
    const { jobId } = useParams<{ jobId: string }>();

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <h1 className="text-3xl font-semibold text-gray-900">
                Job Details
            </h1>

            <p className="mt-2 text-gray-600">
                Viewing job: {jobId}
            </p>
        </main>
    );
}

export default JobDetailPage;