import { useEffect, useState } from "react";

import { useFeedback } from "../components/ui/Feedback";
import {
    UNIFORM_ITEMS,
    UNIFORM_SIZES,
    exportUniformReport,
    itemTotal,
    type UniformItem,
    type UniformSize,
    type UniformStock,
} from "../lib/uniformStock";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const STEP =
    "h-8 w-8 rounded-md border border-gray-300 text-base font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40";

export default function UniformStockPage() {
    useDocumentTitle("Uniform stock");

    const { toast } = useFeedback();
    const [stock, setStock] = useState<UniformStock | null>(null);

    async function send(body: Record<string, unknown>) {
        const response = await fetch("/api/uniform-stock", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(result?.message ?? "Couldn't update the stock.");
        }

        return result as UniformStock;
    }

    useEffect(() => {
        fetch("/api/uniform-stock")
            .then((response) => response.json())
            .then(setStock)
            .catch(() => toast({ message: "Couldn't load the uniform stock.", tone: "error" }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Shows the change straight away; the server's answer replaces it, and a
    // failure puts the real numbers back.
    async function change(item: UniformItem, size: UniformSize, body: { delta: number } | { count: number }) {
        if (!stock) {
            return;
        }

        const next = "delta" in body ? stock[item][size] + body.delta : body.count;

        if (next < 0) {
            return;
        }

        setStock({ ...stock, [item]: { ...stock[item], [size]: next } });

        try {
            setStock(await send({ item, size, ...body }));
        } catch (error) {
            toast({ message: error instanceof Error ? error.message : "Couldn't update the stock.", tone: "error" });
            fetch("/api/uniform-stock")
                .then((response) => response.json())
                .then(setStock)
                .catch(() => undefined);
        }
    }

    return (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-900">Uniform stock</h1>
                    <p className="mt-2 text-gray-600">
                        What's in the store, by size. Use + and − as stock comes in and goes out, or type a count.
                    </p>
                </div>

                <button
                    type="button"
                    disabled={!stock}
                    onClick={() => stock && exportUniformReport(stock)}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                    Print report
                </button>
            </div>

            {stock && (
                <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="w-full min-w-[760px] text-center text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Item</th>
                                {UNIFORM_SIZES.map((size) => (
                                    <th key={size} className="px-2 py-3 font-semibold">
                                        {size}
                                    </th>
                                ))}
                                <th className="px-4 py-3 font-semibold">Total</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200">
                            {UNIFORM_ITEMS.map(({ key, label }) => (
                                <tr key={key}>
                                    <td className="px-4 py-4 text-left text-base font-semibold text-gray-900">{label}</td>

                                    {UNIFORM_SIZES.map((size) => (
                                        <td key={size} className="px-2 py-4">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    type="button"
                                                    className={STEP}
                                                    disabled={stock[key][size] === 0}
                                                    onClick={() => void change(key, size, { delta: -1 })}
                                                    aria-label={`Remove one ${label} ${size}`}
                                                >
                                                    −
                                                </button>

                                                <input
                                                    key={stock[key][size]}
                                                    defaultValue={stock[key][size]}
                                                    inputMode="numeric"
                                                    aria-label={`${label} ${size} count`}
                                                    onBlur={(e) => {
                                                        const count = Number(e.target.value);

                                                        if (Number.isInteger(count) && count >= 0) {
                                                            if (count !== stock[key][size]) {
                                                                void change(key, size, { count });
                                                            }
                                                        } else {
                                                            e.target.value = String(stock[key][size]);
                                                        }
                                                    }}
                                                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                                                    className="h-8 w-12 rounded-md border border-gray-300 bg-white text-center text-sm font-semibold text-gray-900"
                                                />

                                                <button
                                                    type="button"
                                                    className={STEP}
                                                    onClick={() => void change(key, size, { delta: 1 })}
                                                    aria-label={`Add one ${label} ${size}`}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </td>
                                    ))}

                                    <td className="px-4 py-4 text-base font-semibold text-gray-900">
                                        {itemTotal(stock, key)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
