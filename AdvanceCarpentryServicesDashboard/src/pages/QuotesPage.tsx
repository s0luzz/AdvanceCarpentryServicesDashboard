import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import NewQuoteModal, {
  type NewQuoteFormData,
} from "../components/layout/NewQuoteModal";
import deleteicon from "../assets/icons/delete.svg";

type QuotedJob = {
  id: string;
  name: string;
  quotedAmount: number;
  gst: number;
  inclGst: number;
  address: string;
  wallsRoofRate: number;
  floorRate: number;
  ffw: number;
  gfw: number;
  floor: number;
  roof: number;
  additionalCost: number;
  steel: number;
  date: string;
};

export default function QuotesPage() {
  const [quotedJobs, setQuotedJobs] = useState<QuotedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewQuoteModalOpen, setIsNewQuoteModalOpen] = useState(false);

  function formatCurrency(value: number | undefined) {
    return `$${(value ?? 0).toLocaleString()}`;
  }

  async function fetchQuotedJobs() {
    try {
      const response = await fetch("http://localhost:3001/api/quoted-jobs");

      if (!response.ok) {
        throw new Error("Failed to fetch quoted jobs");
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setQuotedJobs(data);
      } else {
        console.error("Expected array but got:", data);
      }
    } catch (error) {
      console.error("Failed to fetch quoted jobs:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQuotedJobs();
  }, []);

  async function handleCreateQuote(formData: NewQuoteFormData) {
    try {
      const quoteData = new FormData();

      quoteData.append("name", formData.name);
      quoteData.append("quotedAmount", String(formData.quotedAmount));
      quoteData.append("gst", String(formData.gst));
      quoteData.append("inclGst", String(formData.inclGst));
      quoteData.append("address", formData.address);
      quoteData.append("wallsRoofRate", String(formData.wallsRoofRate));
      quoteData.append("floorRate", String(formData.floorRate));
      quoteData.append("ffw", String(formData.ffw));
      quoteData.append("gfw", String(formData.gfw));
      quoteData.append("floor", String(formData.floor));
      quoteData.append("roof", String(formData.roof));
      quoteData.append("additionalCost", String(formData.additionalCost));
      quoteData.append("steel", String(formData.steel));

      formData.files.forEach((file) => {
        quoteData.append("files", file);
      });

      const response = await fetch("http://localhost:3001/api/quoted-jobs", {
        method: "POST",
        body: quoteData,
      });

      if (!response.ok) {
        throw new Error("Failed to create quote");
      }

      await fetchQuotedJobs();
      setIsNewQuoteModalOpen(false);
    } catch (error) {
      console.error("Failed to save quote:", error);
    }
  }

  async function handleDeleteQuote(id: string) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this quote?"
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3001/api/quoted-jobs/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete quote");
      }

      setQuotedJobs((currentJobs) =>
        currentJobs.filter((job) => job.id !== id)
      );
    } catch (error) {
      console.error("Failed to delete quote:", error);
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
            type="button"
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
                <th className="px-6 py-3 font-semibold">
                  Quoted Amount Incl. GST
                </th>
                <th className="px-6 py-3 font-semibold">Address</th>
                <th className="px-6 py-3 font-semibold">Date</th>
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
                    {formatCurrency(job.inclGst)}
                  </td>

                  <td className="px-6 py-4 text-gray-700">{job.address}</td>
                  <td className="px-6 py-4 text-gray-700">
                    {new Date(job.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <NavLink
                        to={`/jobs/${job.id}`}
                        className="flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-100"
                      >
                        View
                      </NavLink>

                      <button
                        type="button"
                        onClick={() => handleDeleteQuote(job.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                      >
                        <img src={deleteicon} alt="Delete" className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {quotedJobs.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-sm text-gray-500"
                  >
                    No quoted jobs yet.
                  </td>
                </tr>
              )}
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