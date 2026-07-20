import {
    type ChangeEvent,
    type FormEvent,
    useEffect,
    useState,
} from "react";

export type QuoteStatus =
    | "Quoted"
    | "Cutting List"
    | "Under Construction"
    | "Complete";

export type NewQuoteFormData = {
    name: string;
    status: QuoteStatus;
    quotedAmount: number;
    gst: number;
    inclGst: number;
    address: string;

    wallsRoofRate: number;
    gfw: number;
    roof: number;

    hasSecondFloor: boolean;
    floorRate: number;
    ffw: number;
    floor: number;

    hasHebel: boolean;
    hebelHeight: number;
    hebelLength: number;
    hebelRate: number;
    hebelCost: number;

    additionalCost: number;
    steel: number;
    files: File[];
};

export type JobDocument = {
  id: string;
  name: string;
  originalName: string;
  storedName: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export type ExistingQuoteData = {
    name: string;
    status: QuoteStatus;
    quotedAmount: number;
    gst: number;
    inclGst: number;
    address: string;

    wallsRoofRate: number;
    gfw: number;
    roof: number;

    hasSecondFloor: boolean;
    floorRate: number;
    ffw: number;
    floor: number;

    hasHebel: boolean;
    hebelHeight: number;
    hebelLength: number;
    hebelRate: number;
    hebelCost: number;

    additionalCost: number;
    steel: number;
    files: File[];

  documents?: JobDocument[];
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
    const [status, setStatus] = useState<QuoteStatus>("Quoted");
    const [wallsRoofRate, setWallsRoofRate] = useState("");
    const [gfw, setGfw] = useState("");
    const [roof, setRoof] = useState("");

    const [hasSecondFloor, setHasSecondFloor] = useState(false);
    const [floorRate, setFloorRate] = useState("");
    const [ffw, setFfw] = useState("");
    const [floor, setFloor] = useState("");

    const [hasHebel, setHasHebel] = useState(false);
    const [hebelHeight, setHebelHeight] = useState("");
    const [hebelLength, setHebelLength] = useState("");
    const [hebelRate, setHebelRate] = useState("");

    const [additionalCost, setAdditionalCost] = useState("");
    const [steel, setSteel] = useState("");
    const [files, setFiles] = useState<File[]>([]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (mode === "edit" && initialQuote) {
            const secondFloorEnabled =
                initialQuote.hasSecondFloor === true ||
                Number(initialQuote.ffw ?? 0) > 0 ||
                Number(initialQuote.floor ?? 0) > 0 ||
                Number(initialQuote.floorRate ?? 0) > 0;

            const hebelEnabled =
                initialQuote.hasHebel === true ||
                Number(initialQuote.hebelHeight ?? 0) > 0 ||
                Number(initialQuote.hebelLength ?? 0) > 0 ||
                Number(initialQuote.hebelRate ?? 0) > 0;

            setName(initialQuote.name);
            setAddress(initialQuote.address);
            setStatus(initialQuote.status ?? "Quoted");
            setWallsRoofRate(String(initialQuote.wallsRoofRate ?? 0));
            setGfw(String(initialQuote.gfw ?? 0));
            setRoof(String(initialQuote.roof ?? 0));

            setHasSecondFloor(secondFloorEnabled);
            setFloorRate(String(initialQuote.floorRate ?? 0));
            setFfw(String(initialQuote.ffw ?? 0));
            setFloor(String(initialQuote.floor ?? 0));

            setHasHebel(hebelEnabled);
            setHebelHeight(String(initialQuote.hebelHeight ?? 0));
            setHebelLength(String(initialQuote.hebelLength ?? 0));
            setHebelRate(String(initialQuote.hebelRate ?? 0));

            setAdditionalCost(String(initialQuote.additionalCost ?? 0));
            setSteel(String(initialQuote.steel ?? 0));
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

        const numberValue = Number(cleanedValue);

        if (Number.isNaN(numberValue)) {
            return 0;
        }

        return numberValue;
    }

    const groundWallsCost = toNumber(wallsRoofRate) * toNumber(gfw);
    const roofCost = toNumber(wallsRoofRate) * toNumber(roof);

    const secondFloorWallsCost = hasSecondFloor
        ? toNumber(wallsRoofRate) * toNumber(ffw)
        : 0;

    const floorCost = hasSecondFloor
        ? toNumber(floorRate) * toNumber(floor)
        : 0;

    const hebelCost = hasHebel
        ? toNumber(hebelHeight) * toNumber(hebelLength) * toNumber(hebelRate)
        : 0;

    const finalCost =
        groundWallsCost +
        roofCost +
        secondFloorWallsCost +
        floorCost +
        hebelCost +
        toNumber(steel) +
        toNumber(additionalCost);

    if (!isOpen) {
        return null;
    }

    function resetForm() {
        setName("");
        setAddress("");
        setStatus("Quoted");
        setWallsRoofRate("");
        setGfw("");
        setRoof("");

        setHasSecondFloor(false);
        setFloorRate("");
        setFfw("");
        setFloor("");

        setHasHebel(false);
        setHebelHeight("");
        setHebelLength("");
        setHebelRate("");

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
            gfw: toNumber(gfw),
            roof: toNumber(roof),
            status,
            hasSecondFloor,
            floorRate: hasSecondFloor ? toNumber(floorRate) : 0,
            ffw: hasSecondFloor ? toNumber(ffw) : 0,
            floor: hasSecondFloor ? toNumber(floor) : 0,

            hasHebel,
            hebelHeight: hasHebel ? toNumber(hebelHeight) : 0,
            hebelLength: hasHebel ? toNumber(hebelLength) : 0,
            hebelRate: hasHebel ? toNumber(hebelRate) : 0,
            hebelCost,

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
                            Status
                        </label>

                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value as QuoteStatus)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                        >
                            <option value="Quoted">Quoted</option>
                            <option value="Cutting List">Cutting List</option>
                            <option value="Under Construction">Under Construction</option>
                            <option value="Complete">Complete</option>
                        </select>
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

                    <div className="rounded-xl border border-gray-200 p-4">
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                            Base Quote
                        </h3>

                        <div className="space-y-4">
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
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4">
                        <label className="flex cursor-pointer items-center gap-3">
                            <input
                                type="checkbox"
                                checked={hasSecondFloor}
                                onChange={(event) => {
                                    setHasSecondFloor(event.target.checked);

                                    if (!event.target.checked) {
                                        setFloorRate("");
                                        setFfw("");
                                        setFloor("");
                                    }
                                }}
                                className="h-4 w-4"
                            />

                            <div>
                                <p className="text-sm font-semibold text-gray-900">
                                    Add another floor
                                </p>

                            </div>
                        </label>

                        {hasSecondFloor && (
                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700">
                                        First Floor Walls
                                    </label>
                                    <input
                                        type="text"
                                        value={ffw}
                                        onChange={(event) =>
                                            setFfw(event.target.value)
                                        }
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
                                        Floor Area
                                    </label>
                                    <input
                                        type="text"
                                        value={floor}
                                        onChange={(event) =>
                                            setFloor(event.target.value)
                                        }
                                        placeholder="e.g. 200m²"
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4">
                        <label className="flex cursor-pointer items-center gap-3">
                            <input
                                type="checkbox"
                                checked={hasHebel}
                                onChange={(event) => {
                                    setHasHebel(event.target.checked);

                                    if (!event.target.checked) {
                                        setHebelHeight("");
                                        setHebelLength("");
                                        setHebelRate("");
                                    }
                                }}
                                className="h-4 w-4"
                            />

                            <div>
                                <p className="text-sm font-semibold text-gray-900">
                                    Add Hebel
                                </p>

                            </div>
                        </label>

                        {hasHebel && (
                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700">
                                        Hebel Height
                                    </label>
                                    <input
                                        type="text"
                                        value={hebelHeight}
                                        onChange={(event) =>
                                            setHebelHeight(event.target.value)
                                        }
                                        placeholder="e.g. 2.7"
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700">
                                        Hebel Length
                                    </label>
                                    <input
                                        type="text"
                                        value={hebelLength}
                                        onChange={(event) =>
                                            setHebelLength(event.target.value)
                                        }
                                        placeholder="e.g. 45"
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700">
                                        Hebel Rate
                                    </label>
                                    <input
                                        type="text"
                                        value={hebelRate}
                                        onChange={(event) =>
                                            setHebelRate(event.target.value)
                                        }
                                        placeholder="e.g. $85"
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                    />
                                </div>

                                <div className="rounded-lg bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                                    Hebel Cost: ${hebelCost.toLocaleString()}
                                </div>
                            </div>
                        )}
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
                                                        {(file.size / 1024 / 1024).toFixed(2)} MB
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
                                {mode === "edit" ? "Save Changes" : "Create Quote"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default NewQuoteModal;