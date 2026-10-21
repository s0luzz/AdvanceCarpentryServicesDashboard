// Saves one or more fields of a job (the server only changes what's sent).
export async function patchJob(id: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/quoted-jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error("Couldn't save the job.");
    }
}
