// Placeholder shapes shown while data loads, so the layout doesn't jump.
export function SkeletonBar({ className = "" }: { className?: string }) {
    return (
        <div
            className={`animate-pulse rounded bg-gray-200 ${className}`}
            aria-hidden="true"
        />
    );
}

export function TableSkeleton({
    rows = 8,
    columns = 5,
}: {
    rows?: number;
    columns?: number;
}) {
    return (
        <div role="status" aria-label="Loading" className="divide-y divide-gray-200">
            {Array.from({ length: rows }, (_, row) => (
                <div
                    key={row}
                    className="grid gap-6 px-6 py-5"
                    style={{
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    }}
                >
                    {Array.from({ length: columns }, (_, col) => (
                        <SkeletonBar
                            key={col}
                            className={`h-4 ${col === 0 ? "w-2/3" : "w-full"}`}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
    return (
        <div
            role="status"
            aria-label="Loading"
            className="space-y-3 rounded-xl border border-gray-200 bg-white p-6"
        >
            <SkeletonBar className="h-5 w-1/3" />
            {Array.from({ length: lines }, (_, line) => (
                <SkeletonBar key={line} className="h-4 w-full" />
            ))}
        </div>
    );
}
