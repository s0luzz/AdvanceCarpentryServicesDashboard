import { useEffect, useState } from "react";
import NewQuoteModal, {
  type NewQuoteFormData,
} from "../components/layout/NewQuoteModal";

type QuotedJob = {
  id: string;
  name: string;
  quotedAmount: number;
  address: string;
};

export default function QuotesPage() {
  const [quotedJobs, setQuotedJobs] = useState<QuotedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewQuoteModalOpen, setIsNewQuoteModalOpen] = useState(false);

  useEffect(() => {
    async function fetchQuotedJobs() {
      try {
            const response = await fetch("http://localhost:3001/quotedJobs");
            const data = await response.json();

            setQuotedJobs(data);
      } catch (error) {
        console.error("Failed to fetch quoted jobs:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchQuotedJobs();
  }, []);

async function handleCreateQuote(formData: NewQuoteFormData) {
  const newQuote: QuotedJob = {
    id: crypto.randomUUID(),
    name: formData.name,
    quotedAmount: Number(formData.quotedAmount),
    address: formData.address,
  };

  try {
    const response = await fetch("http://localhost:3001/quotedJobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newQuote),
    });

    if (!response.ok) {
      throw new Error("Failed to create quote");
    }

    const savedQuote = await response.json();

    setQuotedJobs((currentJobs) => [savedQuote, ...currentJobs]);
    setIsNewQuoteModalOpen(false);
  } catch (error) {
    console.error("Failed to save quote:", error);
  }
}

  if (loading) {
    return <p className="p-6">Loading quoted jobs...</p>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mb-8">
        <p className="text-sm font-medium text-gray-500">Quotes</p>
        <h1 className="mt-1 text-3xl font-semibold text-gray-900">
          Quoted Jobs
        </h1>
        <p className="mt-2 text-gray-600">
          Track jobs that have been quoted before they move into cutting list or
          construction.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Quoted Jobs
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {quotedJobs.length} jobs currently listed as quoted.
            </p>
          </div>

          <button
            onClick={() => setIsNewQuoteModalOpen(true)}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Add Quote
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Quoted Amount</th>
                <th className="px-6 py-3 font-semibold">Address</th>
                <th className="px-6 py-3 font-semibold">Quick Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {quotedJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {job.name}
                  </td>

                  <td className="px-6 py-4 text-gray-700">
                    ${job.quotedAmount.toLocaleString()}
                  </td>

                  <td className="px-6 py-4 text-gray-700">{job.address}</td>

                  <td className="px-6 py-4">
                    <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <NewQuoteModal
        isOpen={isNewQuoteModalOpen}
        onClose={() => setIsNewQuoteModalOpen(false)}
        onCreateQuote={handleCreateQuote}
      />
    </main>
  );
}