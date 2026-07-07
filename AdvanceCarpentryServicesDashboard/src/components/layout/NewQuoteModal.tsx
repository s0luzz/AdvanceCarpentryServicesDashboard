import {
    type ChangeEvent,
    type FormEvent,
    useEffect,
    useState,
} from "react";

export type NewQuoteFormData = {
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
    files: File[];
};

export type ExistingQuoteData = {
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
};

type NewQuoteModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onCreateQuote: (quote: NewQuoteFormData) => void;
    initialQuote?: ExistingQuoteData;
    mode?: "create" | "edit";
};

function NewQuoteModal({
    isOpen,
    onClose,
    onCreateQuote,
    initialQuote,
    mode = "create",
}: NewQuoteModalProps) {
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");

    const [wallsRoofRate, setWallsRoofRate] = useState("");
    const [floorRate, setFloorRate] = useState("");
    const [ffw, setFfw] = useState("");
    const [gfw, setGfw] = useState("");
    const [floor, setFloor] = useState("");
    const [roof, setRoof] = useState("");
    const [additionalCost, setAdditionalCost] = useState("");
    const [steel, setSteel] = useState("");
    const [files, setFiles] = useState<File[]>([]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (mode === "edit" && initialQuote) {
            setName(initialQuote.name);
            setAddress(initialQuote.address);
            setWallsRoofRate(String(initialQuote.wallsRoofRate));
            setFloorRate(String(initialQuote.floorRate));
            setFfw(String(initialQuote.ffw));
            setGfw(String(initialQuote.gfw));
            setFloor(String(initialQuote.floor));
            setRoof(String(initialQuote.roof));
            setAdditionalCost(String(initialQuote.additionalCost));
            setSteel(String(initialQuote.steel));
            setFiles([]);
        }

        if (mode === "create") {
            resetForm();
        }
    }, [isOpen, mode, initialQuote]);

    function toNumber(value: string) {
        const cleanedValue = value.replace(/[^0-9.-]/g, "");

        if (cleanedValue === "") {
            return 0;
        }

        return Number(cleanedValue);
    }

    const finalCost =
        toNumber(wallsRoofRate) *
            (toNumber(gfw) + toNumber(ffw) + toNumber(roof)) +
        toNumber(floorRate) * toNumber(floor) +
        toNumber(steel) +
        toNumber(additionalCost);

    if (!isOpen) {
        return null;
    }

    function resetForm() {
        setName("");
        setAddress("");
        setWallsRoofRate("");
        setFloorRate("");
        setFfw("");
        setGfw("");
        setFloor("");
        setRoof("");
        setAdditionalCost("");
        setSteel("");
        setFiles([]);
    }

    function handleClose() {
        resetForm();
        onClose();
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        onCreateQuote({
            name,
            quotedAmount: finalCost,
            gst: finalCost * 0.1,
            inclGst: finalCost * 1.1,
            address,
            wallsRoofRate: toNumber(wallsRoofRate),
            floorRate: toNumber(floorRate),
            ffw: toNumber(ffw),
            gfw: toNumber(gfw),
            floor: toNumber(floor),
            roof: toNumber(roof),
            additionalCost: toNumber(additionalCost),
            steel: toNumber(steel),
            files,
        });

        resetForm();
        onClose();
    }

    function handleOnChangeFile(event: ChangeEvent<HTMLInputElement>) {
        const selectedFiles = Array.from(event.target.files ?? []);

        setFiles((currentFiles) => {
            const combinedFiles = [...currentFiles, ...selectedFiles];

            return combinedFiles.filter((file, index, self) => {
                return (
                    index ===
                    self.findIndex(
                        (existingFile) =>
                            existingFile.name === file.name &&
                            existingFile.size === file.size &&
                            existingFile.lastModified === file.lastModified
                    )
                );
            });
        });

        event.target.value = "";
    }

    function removeFile(fileToRemove: File) {
        setFiles((currentFiles) =>
            currentFiles.filter(
                (file) =>
                    !(
                        file.name === fileToRemove.name &&
                        file.size === fileToRemove.size &&
                        file.lastModified === fileToRemove.lastModified
                    )
            )
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            {mode === "edit" ? "Edit Quote" : "New Quote"}
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            {mode === "edit"
                                ? "Update the quote details for this job."
                                : "Add a quoted job to the table."}
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
                            value={wallsRoofRate}
                            onChange={(event) =>
                                setWallsRoofRate(event.target.value)
                            }
                            placeholder="e.g. $90"
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
                            onChange={(event) => setGfw(event.target.value)}
                            placeholder="e.g. 130lm"
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
                            onChange={(event) => setFfw(event.target.value)}
                            placeholder="e.g. 130lm"
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
                            onChange={(event) =>
                                setFloorRate(event.target.value)
                            }
                            placeholder="e.g. $150/sqm"
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
                            placeholder="e.g. 200m²"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Roof
                        </label>
                        <input
                            type="text"
                            value={roof}
                            onChange={(event) => setRoof(event.target.value)}
                            placeholder="e.g. 175m²"
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
                            onChange={(event) =>
                                setAdditionalCost(event.target.value)
                            }
                            placeholder="e.g. $5,000"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        />
                    </div>

                    {mode === "create" && (
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Related Files
                            </label>

                            <input
                                type="file"
                                multiple
                                onChange={handleOnChangeFile}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                            />

                            {files.length > 0 && (
                                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                                        Attached Files
                                    </p>

                                    <div className="space-y-2">
                                        {files.map((file) => (
                                            <div
                                                key={`${file.name}-${file.size}-${file.lastModified}`}
                                                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-gray-800">
                                                        {file.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {(file.size / 1024 / 1024).toFixed(
                                                            2
                                                        )}{" "}
                                                        MB
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(file)}
                                                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col gap-3 pt-3">
                        <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-3">
                            <h2 className="rounded-lg bg-gray-50 px-4 py-2 font-medium">
                                Cost: ${finalCost.toLocaleString()}
                            </h2>

                            <h2 className="rounded-lg bg-gray-50 px-4 py-2 font-medium">
                                GST: ${(finalCost * 0.1).toLocaleString()}
                            </h2>

                            <h2 className="rounded-lg bg-gray-50 px-4 py-2 font-medium">
                                Incl GST: ${(finalCost * 1.1).toLocaleString()}
                            </h2>
                        </div>

                        <div className="flex justify-end gap-3">
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
                                {mode === "edit"
                                    ? "Save Changes"
                                    : "Create Quote"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default NewQuoteModal;