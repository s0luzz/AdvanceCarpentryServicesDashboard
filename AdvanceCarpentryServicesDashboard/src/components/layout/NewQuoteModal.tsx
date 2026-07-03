import { type FormEvent, useState } from "react";

export type NewQuoteFormData = {
    name: string;
    quotedAmount: number;
    address: string;
};

type NewQuoteModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onCreateQuote: (quote: NewQuoteFormData) => void;
};

function NewQuoteModal({ isOpen, onClose, onCreateQuote }: NewQuoteModalProps) {
    const [name, setName] = useState("");
    const [quotedAmount, setQuotedAmount] = useState("");
    const [address, setAddress] = useState("");
    const [WallsRoofRate, setWallsRoofRate] = useState("");
    const [floorRate, setFloorRate] = useState("");
    const [ffw, setffw] = useState(""); 
    const [gfw, setgfw] = useState("");
    const [floor, setFloor] = useState("");
    const [Roof, setRoof] = useState("");
    const [additionalCost, setAdditionalCost] = useState("");
    const [steel, setSteel] = useState("");

    if (!isOpen) {
        return null;
    }

    function resetForm() {
        setName("");
        setQuotedAmount("");
        setAddress("");
    }

    function handleClose() {
        resetForm();
        onClose();
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        onCreateQuote({
            name,
            quotedAmount: Number(WallsRoofRate) * (Number(gfw) + Number(ffw)) + Number(floorRate) * Number(floor) + Number(steel) + Number(additionalCost),
            address,
        });

        resetForm();
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            New Quote
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Add a quoted job to the frontend table.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-lg px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Close modal"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Client Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="e.g. Baulkham Hills Townhouses"
                            required
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Walls + Roof Rate
                        </label>
                        <input
                            type="text"
                            value={WallsRoofRate}
                            onChange={(event) => setWallsRoofRate(event.target.value)}
                            placeholder="e.g. $90"
                            required
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Ground Floor Walls
                        </label>
                        <input
                            type="text"
                            value={gfw}
                            onChange={(event) => setgfw(event.target.value)}
                            placeholder="e.g. 130lm"
                            required
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            First Floor Walls
                        </label>
                        <input
                            type="text"
                            value={ffw}
                            onChange={(event) => setffw(event.target.value)}
                            placeholder="e.g. 130lm"
                            required
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Floor Rate
                        </label>
                        <input
                            type="text"
                            value={floorRate}
                            onChange={(event) => setFloorRate(event.target.value)}
                            placeholder="e.g. $150/sqm"
                            required
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Floor
                        </label>
                        <input
                            type="text"
                            value={floor}
                            onChange={(event) => setFloor(event.target.value)}
                            placeholder="e.g. 200m^2"
                            required
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Roof
                        </label>
                        <input
                            type="text"
                            value={Roof}
                            onChange={(event) => setRoof(event.target.value)}
                            placeholder="e.g. 175m^2"
                            required
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Steel Cost
                        </label>
                        <input
                            type="text"
                            value={steel}
                            onChange={(event) => setSteel(event.target.value)}
                            placeholder="e.g. $15,000"
                            required
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Address
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={(event) => setAddress(event.target.value)}
                            placeholder="e.g. 70-72 Old Northern Road, Baulkham Hills NSW 2153"
                            required
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Additional Cost
                        </label>
                        <input
                            type="text"
                            value={additionalCost}
                            onChange={(event) => setAdditionalCost(event.target.value)}
                            placeholder="e.g. $5,000"
                            required
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-3">
                        <h2 className="rounded-lg  px-4 py-2 text-sm font-medium text-gray-700 ">
                            Final Cost: ${Number(WallsRoofRate) * (Number(gfw) + Number(ffw)) + Number(floorRate) * Number(floor) + Number(steel) + Number(additionalCost)}
                        </h2>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                        >
                            Create Quote
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default NewQuoteModal;
