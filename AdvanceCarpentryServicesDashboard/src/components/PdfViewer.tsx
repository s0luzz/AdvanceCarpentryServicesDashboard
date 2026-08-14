import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type PdfViewerProps = {
  jobId: string;
  file: File | string;
  onClose?: () => void;
};

type Point = {
  x: number;
  y: number;
};

type Vector = {
  x: number;
  y: number;
};

type Line = {
  start: Point;
  end: Point;
};

type PanPosition = {
  x: number;
  y: number;
};

type AxisCalibration = {
  start: Point;
  end: Point;
  realDistanceMm: number;
  pageSpaceLength: number;
  unitVector: Vector;
  mmPerPageUnit: number;
};

type Calibration = {
  pageNumber: number;
  primaryAxis: AxisCalibration;
  secondaryAxis: AxisCalibration;
};

type CalibrationDraft = {
  primaryAxis?: AxisCalibration;
  secondaryAxis?: AxisCalibration;
};

type Measurement = {
  id: string;
  pageNumber: number;
  start: Point;
  end: Point;
  distanceMm: number;
};

type AreaCategory = "floor" | "roof";

type AreaBox = {
  id: string;
  pageNumber: number;
  category: AreaCategory;
  firstLine: Line;
  secondLine: Line;
  corners: [Point, Point, Point, Point];
  lengthMm: number;
  widthMm: number;
  areaM2: number;
};

type MeasurementCategory = "gfw" | "ffw";

type AssignedPageWallTotal = {
  pageNumber: number;
  category: MeasurementCategory;
  totalMm: number;
  measurementCount: number;
};

type AssignedPageAreaTotal = {
  pageNumber: number;
  category: AreaCategory;
  totalM2: number;
  boxCount: number;
};

type SavedTakeoff = {
  calibrations: Record<number, Calibration>;
  measurements: Measurement[];
  areaBoxes: AreaBox[];
  assignedPageWallTotals: Record<
    number,
    AssignedPageWallTotal
  >;
  assignedPageAreaTotals: Record<
    string,
    AssignedPageAreaTotal
  >;
};

type CalibrationUnit = "mm" | "m";

type CalibrationAxis = "primary" | "secondary";

type ViewerTool =
  | "pan"
  | "calibrate"
  | "measure-walls"
  | "measure-floor"
  | "measure-roof";

type AreaDrawingStep = "first-line" | "second-line";

const API_URL = "http://localhost:3001";

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
const SCALE_STEP = 0.2;
const MIN_LINE_LENGTH = 0.002;
const MIN_AXIS_DETERMINANT = 0.1;
const SAVE_DELAY_MS = 600;

function createEmptyTakeoff(): SavedTakeoff {
  return {
    calibrations: {},
    measurements: [],
    areaBoxes: [],
    assignedPageWallTotals: {},
    assignedPageAreaTotals: {},
  };
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getAreaAssignmentKey(
  pageNumber: number,
  category: AreaCategory,
) {
  return `${pageNumber}-${category}`;
}

function getPageSpaceVector(
  start: Point,
  end: Point,
  pageAspectRatio: number,
): Vector {
  return {
    x: (end.x - start.x) * pageAspectRatio,
    y: end.y - start.y,
  };
}

function getVectorLength(vector: Vector) {
  return Math.sqrt(
    vector.x ** 2 + vector.y ** 2,
  );
}

function normaliseVector(vector: Vector): Vector {
  const length = getVectorLength(vector);

  if (length === 0) {
    return {
      x: 0,
      y: 0,
    };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function calculateAxisAngleDifference(
  firstAxis: Vector,
  secondAxis: Vector,
) {
  const dotProduct =
    firstAxis.x * secondAxis.x +
    firstAxis.y * secondAxis.y;

  const clampedDotProduct = clamp(
    Math.abs(dotProduct),
    -1,
    1,
  );

  return (
    (Math.acos(clampedDotProduct) * 180) /
    Math.PI
  );
}

function calculateCalibratedDistance(
  start: Point,
  end: Point,
  pageAspectRatio: number,
  calibration: Calibration,
) {
  const measurementVector =
    getPageSpaceVector(
      start,
      end,
      pageAspectRatio,
    );

  const primary =
    calibration.primaryAxis.unitVector;

  const secondary =
    calibration.secondaryAxis.unitVector;

  const determinant =
    primary.x * secondary.y -
    primary.y * secondary.x;

  if (
    Math.abs(determinant) <
    MIN_AXIS_DETERMINANT
  ) {
    return null;
  }

  const primaryComponent =
    (measurementVector.x * secondary.y -
      measurementVector.y * secondary.x) /
    determinant;

  const secondaryComponent =
    (primary.x * measurementVector.y -
      primary.y * measurementVector.x) /
    determinant;

  const primaryDistanceMm =
    primaryComponent *
    calibration.primaryAxis.mmPerPageUnit;

  const secondaryDistanceMm =
    secondaryComponent *
    calibration.secondaryAxis.mmPerPageUnit;

  return Math.sqrt(
    primaryDistanceMm ** 2 +
    secondaryDistanceMm ** 2,
  );
}

function formatDistance(distanceMm: number) {
  if (distanceMm >= 1000) {
    return `${(distanceMm / 1000).toFixed(2)} m`;
  }

  return `${Math.round(distanceMm)} mm`;
}

function formatTotalDistance(distanceMm: number) {
  return `${(distanceMm / 1000).toFixed(2)} m`;
}

function formatArea(areaM2: number) {
  return `${areaM2.toFixed(2)} m²`;
}

function formatCalibrationDistance(
  distanceMm: number,
) {
  if (
    distanceMm >= 1000 &&
    distanceMm % 1000 === 0
  ) {
    return `${distanceMm / 1000} m`;
  }

  return `${distanceMm.toLocaleString(
    "en-AU",
  )} mm`;
}

function parseSavedTakeoff(
  value: unknown,
): SavedTakeoff {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return createEmptyTakeoff();
  }

  const takeoff =
    value as Partial<SavedTakeoff>;

  return {
    calibrations:
      takeoff.calibrations &&
      typeof takeoff.calibrations === "object"
        ? takeoff.calibrations
        : {},

    measurements:
      Array.isArray(takeoff.measurements)
        ? takeoff.measurements
        : [],

    areaBoxes:
      Array.isArray(takeoff.areaBoxes)
        ? takeoff.areaBoxes
        : [],

    assignedPageWallTotals:
      takeoff.assignedPageWallTotals &&
      typeof takeoff.assignedPageWallTotals ===
        "object"
        ? takeoff.assignedPageWallTotals
        : {},

    assignedPageAreaTotals:
      takeoff.assignedPageAreaTotals &&
      typeof takeoff.assignedPageAreaTotals ===
        "object"
        ? takeoff.assignedPageAreaTotals
        : {},
  };
}

async function readJsonResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const contentType =
    response.headers.get("content-type");

  if (
    !contentType
      ?.toLowerCase()
      .includes("application/json")
  ) {
    const responseText =
      await response.text();

    if (
      responseText
        .trim()
        .toLowerCase()
        .startsWith("<!doctype")
    ) {
      throw new Error(
        "The request reached the frontend instead of the backend. Confirm the backend is running on port 3001.",
      );
    }

    throw new Error(
      `${fallbackMessage} The server returned a non-JSON response.`,
    );
  }

  const result = (await response.json()) as T;

  if (!response.ok) {
    const errorResult =
      result as {
        message?: string;
      };

    throw new Error(
      errorResult.message ??
        `${fallbackMessage} (${response.status}).`,
    );
  }

  return result;
}

export default function PdfViewer({
  jobId,
  file,
  onClose,
}: PdfViewerProps) {
  const viewportRef =
    useRef<HTMLDivElement>(null);

  const pageWrapperRef =
    useRef<HTMLDivElement>(null);

  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const scaleRef = useRef(1);

  const pageWidthRef = useRef<
    number | undefined
  >(undefined);

  const panRef = useRef<PanPosition>({
    x: 0,
    y: 0,
  });

  const activeToolRef =
    useRef<ViewerTool>("pan");

  const modalOpenRef = useRef(false);

  const hasLoadedTakeoffRef =
    useRef(false);

  const [numberOfPages, setNumberOfPages] =
    useState(0);

  const [pageNumber, setPageNumber] =
    useState(1);

  const [scale, setScale] = useState(1);

  const [pageWidth, setPageWidth] =
    useState<number | undefined>();

  const [pan, setPan] = useState<PanPosition>({
    x: 0,
    y: 0,
  });

  const [
    isLoadingTakeoff,
    setIsLoadingTakeoff,
  ] = useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [saveError, setSaveError] =
    useState("");

  const [lastSavedAt, setLastSavedAt] =
    useState<Date | null>(null);

  const [isPanning, setIsPanning] =
    useState(false);

  const [activeTool, setActiveTool] =
    useState<ViewerTool>("pan");

  const [
    calibrationAxis,
    setCalibrationAxis,
  ] = useState<CalibrationAxis>("primary");

  const [
    calibrationStart,
    setCalibrationStart,
  ] = useState<Point | null>(null);

  const [
    calibrationEnd,
    setCalibrationEnd,
  ] = useState<Point | null>(null);

  const [
    calibrationDrafts,
    setCalibrationDrafts,
  ] = useState<
    Record<number, CalibrationDraft>
  >({});

  const [calibrations, setCalibrations] =
    useState<Record<number, Calibration>>(
      {},
    );

  const [
    measurementStart,
    setMeasurementStart,
  ] = useState<Point | null>(null);

  const [
    measurementEnd,
    setMeasurementEnd,
  ] = useState<Point | null>(null);

  const [measurements, setMeasurements] =
    useState<Measurement[]>([]);

  const [areaBoxes, setAreaBoxes] =
    useState<AreaBox[]>([]);

  const [
    areaDrawingStep,
    setAreaDrawingStep,
  ] = useState<AreaDrawingStep>(
    "first-line",
  );

  const [
    areaLineStart,
    setAreaLineStart,
  ] = useState<Point | null>(null);

  const [
    areaLineEnd,
    setAreaLineEnd,
  ] = useState<Point | null>(null);

  const [
    firstAreaLine,
    setFirstAreaLine,
  ] = useState<Line | null>(null);

  const [
    isDistanceModalOpen,
    setIsDistanceModalOpen,
  ] = useState(false);

  const [distanceInput, setDistanceInput] =
    useState("");

  const [distanceUnit, setDistanceUnit] =
    useState<CalibrationUnit>("mm");

  const [viewerError, setViewerError] =
    useState("");

  const [
    selectedWallCategory,
    setSelectedWallCategory,
  ] = useState<MeasurementCategory>("gfw");

  const [
    assignedPageWallTotals,
    setAssignedPageWallTotals,
  ] = useState<
    Record<number, AssignedPageWallTotal>
  >({});

  const [
    assignedPageAreaTotals,
    setAssignedPageAreaTotals,
  ] = useState<
    Record<string, AssignedPageAreaTotal>
  >({});

  const currentCalibration =
    calibrations[pageNumber];

  const currentCalibrationDraft =
    calibrationDrafts[pageNumber] ?? {};

  const currentWallAssignment =
    assignedPageWallTotals[pageNumber];

  const currentFloorAssignment =
    assignedPageAreaTotals[
      getAreaAssignmentKey(
        pageNumber,
        "floor",
      )
    ];

  const currentRoofAssignment =
    assignedPageAreaTotals[
      getAreaAssignmentKey(
        pageNumber,
        "roof",
      )
    ];

  const currentMeasurements = useMemo(
    () =>
      measurements.filter(
        (measurement) =>
          measurement.pageNumber ===
          pageNumber,
      ),
    [measurements, pageNumber],
  );

  const currentFloorBoxes = useMemo(
    () =>
      areaBoxes.filter(
        (box) =>
          box.pageNumber === pageNumber &&
          box.category === "floor",
      ),
    [areaBoxes, pageNumber],
  );

  const currentRoofBoxes = useMemo(
    () =>
      areaBoxes.filter(
        (box) =>
          box.pageNumber === pageNumber &&
          box.category === "roof",
      ),
    [areaBoxes, pageNumber],
  );

  const currentWallTotalMm = useMemo(
    () =>
      currentMeasurements.reduce(
        (total, measurement) =>
          total + measurement.distanceMm,
        0,
      ),
    [currentMeasurements],
  );

  const currentFloorTotalM2 = useMemo(
    () =>
      currentFloorBoxes.reduce(
        (total, box) =>
          total + box.areaM2,
        0,
      ),
    [currentFloorBoxes],
  );

  const currentRoofTotalM2 = useMemo(
    () =>
      currentRoofBoxes.reduce(
        (total, box) =>
          total + box.areaM2,
        0,
      ),
    [currentRoofBoxes],
  );

  const assignedTotals = useMemo(() => {
    const wallTotals = Object.values(
      assignedPageWallTotals,
    ).reduce(
      (totals, item) => {
        totals[item.category] +=
          item.totalMm;

        return totals;
      },
      {
        gfw: 0,
        ffw: 0,
      } satisfies Record<
        MeasurementCategory,
        number
      >,
    );

    const areaTotals = Object.values(
      assignedPageAreaTotals,
    ).reduce(
      (totals, item) => {
        totals[item.category] +=
          item.totalM2;

        return totals;
      },
      {
        floor: 0,
        roof: 0,
      } satisfies Record<
        AreaCategory,
        number
      >,
    );

    return {
      ...wallTotals,
      ...areaTotals,
    };
  }, [
    assignedPageWallTotals,
    assignedPageAreaTotals,
  ]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    pageWidthRef.current = pageWidth;
  }, [pageWidth]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    modalOpenRef.current =
      isDistanceModalOpen;
  }, [isDistanceModalOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadTakeoff() {
      hasLoadedTakeoffRef.current = false;
      setIsLoadingTakeoff(true);
      setSaveError("");
      setLastSavedAt(null);

      try {
        const response = await fetch(
          `${API_URL}/api/quoted-jobs/${jobId}`,
        );

        const job =
          await readJsonResponse<{
            takeoff?: unknown;
          }>(
            response,
            "Unable to load quote",
          );

        if (cancelled) {
          return;
        }

        const saved = parseSavedTakeoff(
          job.takeoff,
        );

        setCalibrations(
          saved.calibrations,
        );

        setMeasurements(
          saved.measurements,
        );

        setAreaBoxes(
          saved.areaBoxes,
        );

        setAssignedPageWallTotals(
          saved.assignedPageWallTotals,
        );

        setAssignedPageAreaTotals(
          saved.assignedPageAreaTotals,
        );

        setCalibrationDrafts({});
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Unable to load takeoff:",
          error,
        );

        setSaveError(
          error instanceof Error
            ? error.message
            : "Unable to load saved takeoff.",
        );
      } finally {
        if (!cancelled) {
          setIsLoadingTakeoff(false);

          hasLoadedTakeoffRef.current =
            true;
        }
      }
    }

    void loadTakeoff();

    return () => {
      cancelled = true;
    };
  }, [jobId, file]);

  useEffect(() => {
    if (!hasLoadedTakeoffRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(
      async () => {
        const takeoff: SavedTakeoff = {
          calibrations,
          measurements,
          areaBoxes,
          assignedPageWallTotals,
          assignedPageAreaTotals,
        };

        setIsSaving(true);
        setSaveError("");

        try {
          const response = await fetch(
            `${API_URL}/api/quoted-jobs/${jobId}`,
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                takeoff,

                gfw:
                  assignedTotals.gfw /
                  1000,

                ffw:
                  assignedTotals.ffw /
                  1000,

                floor:
                  assignedTotals.floor,

                roof:
                  assignedTotals.roof,
              }),
            },
          );

          await readJsonResponse(
            response,
            "Unable to save takeoff",
          );

          setLastSavedAt(new Date());
        } catch (error) {
          console.error(
            "Unable to save takeoff:",
            error,
          );

          setSaveError(
            error instanceof Error
              ? error.message
              : "Unable to save takeoff.",
          );
        } finally {
          setIsSaving(false);
        }
      },
      SAVE_DELAY_MS,
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    jobId,
    calibrations,
    measurements,
    areaBoxes,
    assignedPageWallTotals,
    assignedPageAreaTotals,
    assignedTotals.gfw,
    assignedTotals.ffw,
    assignedTotals.floor,
    assignedTotals.roof,
  ]);

  useEffect(() => {
    setNumberOfPages(0);
    setPageNumber(1);

    setScale(1);
    scaleRef.current = 1;

    setPageWidth(undefined);
    pageWidthRef.current = undefined;

    const initialPan = {
      x: 0,
      y: 0,
    };

    setPan(initialPan);
    panRef.current = initialPan;

    setIsPanning(false);

    setActiveTool("pan");
    activeToolRef.current = "pan";

    resetDrawingState();

    setViewerError("");
    dragStartRef.current = null;
  }, [file]);

  useEffect(() => {
    setActiveTool("pan");
    activeToolRef.current = "pan";

    resetDrawingState();

    const assignment =
      assignedPageWallTotals[pageNumber];

    if (assignment) {
      setSelectedWallCategory(
        assignment.category,
      );
    }

    const nextPan = {
      x: 0,
      y: 0,
    };

    setPan(nextPan);
    panRef.current = nextPan;

    dragStartRef.current = null;
    setIsPanning(false);
    setViewerError("");
  }, [
    pageNumber,
    assignedPageWallTotals,
  ]);

  useEffect(() => {
    function handleMouseMove(
      event: globalThis.MouseEvent,
    ) {
      const dragStart =
        dragStartRef.current;

      if (!dragStart) {
        return;
      }

      const nextPan = {
        x:
          dragStart.panX +
          event.clientX -
          dragStart.mouseX,

        y:
          dragStart.panY +
          event.clientY -
          dragStart.mouseY,
      };

      panRef.current = nextPan;
      setPan(nextPan);
    }

    function handleMouseUp() {
      dragStartRef.current = null;
      setIsPanning(false);
    }

    window.addEventListener(
      "mousemove",
      handleMouseMove,
    );

    window.addEventListener(
      "mouseup",
      handleMouseUp,
    );

    return () => {
      window.removeEventListener(
        "mousemove",
        handleMouseMove,
      );

      window.removeEventListener(
        "mouseup",
        handleMouseUp,
      );
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    function handleWheel(
      event: WheelEvent,
    ) {
      const currentViewport =
        viewportRef.current;

      if (!currentViewport) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (modalOpenRef.current) {
        return;
      }

      const bounds =
        currentViewport.getBoundingClientRect();

      const cursorX =
        event.clientX - bounds.left;

      const cursorY =
        event.clientY - bounds.top;

      const currentScale =
        pageWidthRef.current
          ? 1
          : scaleRef.current;

      const direction =
        event.deltaY < 0 ? 1 : -1;

      const nextScale = clamp(
        Number(
          (
            currentScale +
            direction * SCALE_STEP
          ).toFixed(2),
        ),
        MIN_SCALE,
        MAX_SCALE,
      );

      if (
        nextScale === currentScale &&
        pageWidthRef.current === undefined
      ) {
        return;
      }

      const ratio =
        nextScale / currentScale;

      const centredCursorX =
        cursorX - bounds.width / 2;

      const centredCursorY =
        cursorY - bounds.height / 2;

      const nextPan = {
        x:
          centredCursorX -
          (centredCursorX -
            panRef.current.x) *
            ratio,

        y:
          centredCursorY -
          (centredCursorY -
            panRef.current.y) *
            ratio,
      };

      pageWidthRef.current = undefined;
      scaleRef.current = nextScale;
      panRef.current = nextPan;

      setPageWidth(undefined);
      setScale(nextScale);
      setPan(nextPan);
    }

    viewport.addEventListener(
      "wheel",
      handleWheel,
      {
        passive: false,
      },
    );

    return () => {
      viewport.removeEventListener(
        "wheel",
        handleWheel,
      );
    };
  }, []);

  function resetDrawingState() {
    setCalibrationAxis("primary");
    setCalibrationStart(null);
    setCalibrationEnd(null);

    setMeasurementStart(null);
    setMeasurementEnd(null);

    resetAreaDrawing();

    setIsDistanceModalOpen(false);
    setDistanceInput("");
  }

  function resetAreaDrawing() {
    setAreaDrawingStep("first-line");
    setAreaLineStart(null);
    setAreaLineEnd(null);
    setFirstAreaLine(null);
  }

  function getCurrentAreaCategory():
    | AreaCategory
    | null {
    if (activeTool === "measure-floor") {
      return "floor";
    }

    if (activeTool === "measure-roof") {
      return "roof";
    }

    return null;
  }

  function getPageAspectRatio() {
    const bounds =
      pageWrapperRef.current?.getBoundingClientRect();

    if (
      !bounds ||
      bounds.width === 0 ||
      bounds.height === 0
    ) {
      return null;
    }

    return bounds.width / bounds.height;
  }

  function updateScale(nextScale: number) {
    scaleRef.current = nextScale;
    setScale(nextScale);
  }

  function updatePan(nextPan: PanPosition) {
    panRef.current = nextPan;
    setPan(nextPan);
  }

  function applyButtonZoom(
    nextScale: number,
  ) {
    const currentScale =
      pageWidth ? 1 : scale;

    const clampedScale = clamp(
      nextScale,
      MIN_SCALE,
      MAX_SCALE,
    );

    const ratio =
      clampedScale / currentScale;

    pageWidthRef.current = undefined;
    setPageWidth(undefined);

    updateScale(clampedScale);

    updatePan({
      x: panRef.current.x * ratio,
      y: panRef.current.y * ratio,
    });
  }

  function zoomIn() {
    const currentScale =
      pageWidth ? 1 : scale;

    applyButtonZoom(
      currentScale + SCALE_STEP,
    );
  }

  function zoomOut() {
    const currentScale =
      pageWidth ? 1 : scale;

    applyButtonZoom(
      currentScale - SCALE_STEP,
    );
  }

  function resetView() {
    pageWidthRef.current = undefined;
    setPageWidth(undefined);

    updateScale(1);

    updatePan({
      x: 0,
      y: 0,
    });
  }

  function fitToWidth() {
    const viewportWidth =
      viewportRef.current?.clientWidth;

    if (!viewportWidth) {
      return;
    }

    const fittedWidth = Math.max(
      viewportWidth - 64,
      300,
    );

    pageWidthRef.current = fittedWidth;
    setPageWidth(fittedWidth);

    updateScale(1);

    updatePan({
      x: 0,
      y: 0,
    });
  }

  function selectTool(tool: ViewerTool) {
    dragStartRef.current = null;

    setIsPanning(false);
    setViewerError("");

    setCalibrationStart(null);
    setCalibrationEnd(null);

    setMeasurementStart(null);
    setMeasurementEnd(null);

    resetAreaDrawing();

    if (
      tool !== "pan" &&
      tool !== "calibrate" &&
      !currentCalibration
    ) {
      setViewerError(
        "Complete both scale directions before measuring.",
      );

      setActiveTool("pan");
      activeToolRef.current = "pan";

      return;
    }

    if (tool === "calibrate") {
      setCalibrationAxis("primary");

      setCalibrationDrafts(
        (current) => ({
          ...current,
          [pageNumber]: {},
        }),
      );
    }

    setActiveTool(tool);
    activeToolRef.current = tool;
  }

  function handlePanStart(
    event: ReactMouseEvent<HTMLDivElement>,
  ) {
    if (
      activeToolRef.current !== "pan" ||
      modalOpenRef.current ||
      event.button !== 0
    ) {
      return;
    }

    const target =
      event.target as HTMLElement;

    if (
      target.closest(
        "button, input, select, a",
      )
    ) {
      return;
    }

    event.preventDefault();

    dragStartRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };

    setIsPanning(true);
  }

  function getRelativePoint(
    event: ReactMouseEvent<SVGSVGElement>,
  ): Point | null {
    const bounds =
      pageWrapperRef.current?.getBoundingClientRect();

    if (
      !bounds ||
      bounds.width === 0 ||
      bounds.height === 0
    ) {
      return null;
    }

    return {
      x: clamp(
        (event.clientX - bounds.left) /
          bounds.width,
        0,
        1,
      ),

      y: clamp(
        (event.clientY - bounds.top) /
          bounds.height,
        0,
        1,
      ),
    };
  }

  function handleOverlayClick(
    event: ReactMouseEvent<SVGSVGElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const point =
      getRelativePoint(event);

    if (!point) {
      return;
    }

    if (activeTool === "calibrate") {
      handleCalibrationPoint(point);
      return;
    }

    if (
      activeTool === "measure-walls"
    ) {
      handleWallMeasurementPoint(point);
      return;
    }

    if (
      activeTool === "measure-floor" ||
      activeTool === "measure-roof"
    ) {
      handleAreaPoint(point);
    }
  }

  function handleCalibrationPoint(
    point: Point,
  ) {
    if (!calibrationStart) {
      setCalibrationStart(point);
      setCalibrationEnd(null);
      setViewerError("");

      return;
    }

    const pageAspectRatio =
      getPageAspectRatio();

    if (!pageAspectRatio) {
      setViewerError(
        "Unable to read the PDF page dimensions.",
      );

      return;
    }

    const vector = getPageSpaceVector(
      calibrationStart,
      point,
      pageAspectRatio,
    );

    const pageSpaceLength =
      getVectorLength(vector);

    if (
      pageSpaceLength <
      MIN_LINE_LENGTH
    ) {
      setViewerError(
        "The calibration line is too short.",
      );

      return;
    }

    if (
      calibrationAxis === "secondary" &&
      currentCalibrationDraft.primaryAxis
    ) {
      const angleDifference =
        calculateAxisAngleDifference(
          currentCalibrationDraft.primaryAxis
            .unitVector,
          normaliseVector(vector),
        );

      if (angleDifference < 20) {
        setViewerError(
          "The second scale direction is too close to the first.",
        );

        return;
      }
    }

    setCalibrationEnd(point);
    setDistanceInput("");
    setIsDistanceModalOpen(true);
  }

  function saveCalibrationAxis() {
    if (
      !calibrationStart ||
      !calibrationEnd
    ) {
      return;
    }

    const enteredDistance =
      Number(distanceInput);

    if (
      !Number.isFinite(enteredDistance) ||
      enteredDistance <= 0
    ) {
      setViewerError(
        "Enter a distance greater than zero.",
      );

      return;
    }

    const pageAspectRatio =
      getPageAspectRatio();

    if (!pageAspectRatio) {
      setViewerError(
        "Unable to read the PDF page dimensions.",
      );

      return;
    }

    const realDistanceMm =
      distanceUnit === "m"
        ? enteredDistance * 1000
        : enteredDistance;

    const vector = getPageSpaceVector(
      calibrationStart,
      calibrationEnd,
      pageAspectRatio,
    );

    const pageSpaceLength =
      getVectorLength(vector);

    if (
      pageSpaceLength <
      MIN_LINE_LENGTH
    ) {
      setViewerError(
        "The calibration line is too short.",
      );

      return;
    }

    const axisCalibration: AxisCalibration =
      {
        start: calibrationStart,
        end: calibrationEnd,
        realDistanceMm,
        pageSpaceLength,
        unitVector:
          normaliseVector(vector),
        mmPerPageUnit:
          realDistanceMm /
          pageSpaceLength,
      };

    if (
      calibrationAxis === "primary"
    ) {
      setCalibrationDrafts(
        (current) => ({
          ...current,

          [pageNumber]: {
            primaryAxis:
              axisCalibration,
          },
        }),
      );

      setCalibrationAxis("secondary");
      setCalibrationStart(null);
      setCalibrationEnd(null);
      setIsDistanceModalOpen(false);
      setDistanceInput("");
      setViewerError("");

      return;
    }

    const primaryAxis =
      currentCalibrationDraft.primaryAxis;

    if (!primaryAxis) {
      setViewerError(
        "The first calibration direction is missing.",
      );

      return;
    }

    const determinant =
      primaryAxis.unitVector.x *
        axisCalibration.unitVector.y -
      primaryAxis.unitVector.y *
        axisCalibration.unitVector.x;

    if (
      Math.abs(determinant) <
      MIN_AXIS_DETERMINANT
    ) {
      setViewerError(
        "The calibration directions are too similar.",
      );

      return;
    }

    setCalibrations((current) => ({
      ...current,

      [pageNumber]: {
        pageNumber,
        primaryAxis,
        secondaryAxis:
          axisCalibration,
      },
    }));

    setCalibrationDrafts(
      (current) => ({
        ...current,

        [pageNumber]: {
          primaryAxis,
          secondaryAxis:
            axisCalibration,
        },
      }),
    );

    setCalibrationStart(null);
    setCalibrationEnd(null);
    setIsDistanceModalOpen(false);
    setDistanceInput("");
    setViewerError("");

    setActiveTool("pan");
    activeToolRef.current = "pan";
  }

  function handleWallMeasurementPoint(
    point: Point,
  ) {
    if (!currentCalibration) {
      return;
    }

    if (!measurementStart) {
      setMeasurementStart(point);
      setMeasurementEnd(null);
      setViewerError("");

      return;
    }

    const pageAspectRatio =
      getPageAspectRatio();

    if (!pageAspectRatio) {
      setViewerError(
        "Unable to read the PDF page dimensions.",
      );

      return;
    }

    const distanceMm =
      calculateCalibratedDistance(
        measurementStart,
        point,
        pageAspectRatio,
        currentCalibration,
      );

    if (
      distanceMm === null ||
      distanceMm <= 0
    ) {
      setViewerError(
        "Unable to calculate that measurement.",
      );

      return;
    }

    setMeasurements((current) => [
      ...current,

      {
        id: createId(),
        pageNumber,
        start: measurementStart,
        end: point,
        distanceMm,
      },
    ]);

    setMeasurementStart(null);
    setMeasurementEnd(null);
    setViewerError("");
  }

  function handleAreaPoint(point: Point) {
    const category =
      getCurrentAreaCategory();

    if (
      !category ||
      !currentCalibration
    ) {
      return;
    }

    if (!areaLineStart) {
      setAreaLineStart(point);
      setAreaLineEnd(null);
      setViewerError("");

      return;
    }

    const completedLine: Line = {
      start: areaLineStart,
      end: point,
    };

    if (
      areaDrawingStep === "first-line"
    ) {
      setFirstAreaLine(completedLine);
      setAreaDrawingStep("second-line");
      setAreaLineStart(null);
      setAreaLineEnd(null);

      return;
    }

    if (!firstAreaLine) {
      resetAreaDrawing();

      setViewerError(
        "The first area line is missing. Draw the box again.",
      );

      return;
    }

    createAreaBox(
      category,
      firstAreaLine,
      completedLine,
    );
  }

  function createAreaBox(
    category: AreaCategory,
    firstLine: Line,
    secondLine: Line,
  ) {
    if (!currentCalibration) {
      return;
    }

    const pageAspectRatio =
      getPageAspectRatio();

    if (!pageAspectRatio) {
      setViewerError(
        "Unable to read the PDF page dimensions.",
      );

      return;
    }

    const lengthMm =
      calculateCalibratedDistance(
        firstLine.start,
        firstLine.end,
        pageAspectRatio,
        currentCalibration,
      );

    const widthMm =
      calculateCalibratedDistance(
        secondLine.start,
        secondLine.end,
        pageAspectRatio,
        currentCalibration,
      );

    if (
      lengthMm === null ||
      widthMm === null ||
      lengthMm <= 0 ||
      widthMm <= 0
    ) {
      setViewerError(
        "Both box sides must have a measurable length.",
      );

      return;
    }

    const secondVector = {
      x:
        secondLine.end.x -
        secondLine.start.x,

      y:
        secondLine.end.y -
        secondLine.start.y,
    };

    const cornerOne = firstLine.start;
    const cornerTwo = firstLine.end;

    const cornerThree = {
      x:
        cornerTwo.x +
        secondVector.x,

      y:
        cornerTwo.y +
        secondVector.y,
    };

    const cornerFour = {
      x:
        cornerOne.x +
        secondVector.x,

      y:
        cornerOne.y +
        secondVector.y,
    };

    const areaM2 =
      (lengthMm * widthMm) /
      1_000_000;

    setAreaBoxes((current) => [
      ...current,

      {
        id: createId(),
        pageNumber,
        category,
        firstLine,
        secondLine,

        corners: [
          cornerOne,
          cornerTwo,
          cornerThree,
          cornerFour,
        ],

        lengthMm,
        widthMm,
        areaM2,
      },
    ]);

    resetAreaDrawing();
    setViewerError("");
  }

  function handleOverlayMouseMove(
    event: ReactMouseEvent<SVGSVGElement>,
  ) {
    const point =
      getRelativePoint(event);

    if (!point) {
      return;
    }

    if (
      activeTool === "calibrate" &&
      calibrationStart
    ) {
      setCalibrationEnd(point);
    }

    if (
      activeTool === "measure-walls" &&
      measurementStart
    ) {
      setMeasurementEnd(point);
    }

    if (
      (
        activeTool === "measure-floor" ||
        activeTool === "measure-roof"
      ) &&
      areaLineStart
    ) {
      setAreaLineEnd(point);
    }
  }

  function assignWallTotal() {
    if (
      currentMeasurements.length === 0
    ) {
      setViewerError(
        "Add at least one wall measurement first.",
      );

      return;
    }

    setAssignedPageWallTotals(
      (current) => ({
        ...current,

        [pageNumber]: {
          pageNumber,
          category:
            selectedWallCategory,
          totalMm:
            currentWallTotalMm,
          measurementCount:
            currentMeasurements.length,
        },
      }),
    );

    setViewerError("");
  }

  function assignAreaTotal(
    category: AreaCategory,
  ) {
    const boxes =
      category === "floor"
        ? currentFloorBoxes
        : currentRoofBoxes;

    const totalM2 =
      category === "floor"
        ? currentFloorTotalM2
        : currentRoofTotalM2;

    if (boxes.length === 0) {
      setViewerError(
        `Add at least one ${category} box first.`,
      );

      return;
    }

    const key =
      getAreaAssignmentKey(
        pageNumber,
        category,
      );

    setAssignedPageAreaTotals(
      (current) => ({
        ...current,

        [key]: {
          pageNumber,
          category,
          totalM2,
          boxCount: boxes.length,
        },
      }),
    );

    setViewerError("");
  }

  function removeWallAssignment() {
    setAssignedPageWallTotals(
      (current) => {
        const next = {
          ...current,
        };

        delete next[pageNumber];

        return next;
      },
    );
  }

  function removeAreaAssignment(
    category: AreaCategory,
  ) {
    const key =
      getAreaAssignmentKey(
        pageNumber,
        category,
      );

    setAssignedPageAreaTotals(
      (current) => {
        const next = {
          ...current,
        };

        delete next[key];

        return next;
      },
    );
  }

  function deleteMeasurement(id: string) {
    setMeasurements((current) =>
      current.filter(
        (measurement) =>
          measurement.id !== id,
      ),
    );
  }

  function deleteAreaBox(id: string) {
    setAreaBoxes((current) =>
      current.filter(
        (box) => box.id !== id,
      ),
    );
  }

  function undoLastWall() {
    setMeasurements((current) => {
      let index = -1;

      for (
        let itemIndex =
          current.length - 1;
        itemIndex >= 0;
        itemIndex -= 1
      ) {
        if (
          current[itemIndex].pageNumber ===
          pageNumber
        ) {
          index = itemIndex;
          break;
        }
      }

      if (index === -1) {
        return current;
      }

      return current.filter(
        (_, itemIndex) =>
          itemIndex !== index,
      );
    });

    setMeasurementStart(null);
    setMeasurementEnd(null);
  }

  function undoLastArea(
    category: AreaCategory,
  ) {
    setAreaBoxes((current) => {
      let index = -1;

      for (
        let itemIndex =
          current.length - 1;
        itemIndex >= 0;
        itemIndex -= 1
      ) {
        const box =
          current[itemIndex];

        if (
          box.pageNumber ===
            pageNumber &&
          box.category === category
        ) {
          index = itemIndex;
          break;
        }
      }

      if (index === -1) {
        return current;
      }

      return current.filter(
        (_, itemIndex) =>
          itemIndex !== index,
      );
    });

    resetAreaDrawing();
  }

  function clearWalls() {
    setMeasurements((current) =>
      current.filter(
        (measurement) =>
          measurement.pageNumber !==
          pageNumber,
      ),
    );

    removeWallAssignment();

    setMeasurementStart(null);
    setMeasurementEnd(null);
  }

  function clearArea(
    category: AreaCategory,
  ) {
    setAreaBoxes((current) =>
      current.filter(
        (box) =>
          !(
            box.pageNumber ===
              pageNumber &&
            box.category === category
          ),
      ),
    );

    removeAreaAssignment(category);
    resetAreaDrawing();
  }

  function resetCurrentScale() {
    setCalibrations((current) => {
      const next = {
        ...current,
      };

      delete next[pageNumber];

      return next;
    });

    setCalibrationDrafts(
      (current) => {
        const next = {
          ...current,
        };

        delete next[pageNumber];

        return next;
      },
    );

    clearWalls();
    clearArea("floor");
    clearArea("roof");

    setActiveTool("pan");
    activeToolRef.current = "pan";
  }

  const displayedScale =
    pageWidth ? 1 : scale;

  const activeAreaCategory =
    getCurrentAreaCategory();

  const interactiveOverlay =
    activeTool !== "pan";

  const primaryAxisToDisplay =
    activeTool === "calibrate"
      ? currentCalibrationDraft.primaryAxis
      : currentCalibration?.primaryAxis;

  const secondaryAxisToDisplay =
    activeTool === "calibrate"
      ? currentCalibrationDraft.secondaryAxis
      : currentCalibration?.secondaryAxis;

  const floorColour = "#16a34a";
  const floorDarkColour = "#15803d";

  const roofColour = "#dc2626";
  const roofDarkColour = "#b91c1c";

  return (
    <div className="flex h-[calc(100vh-2rem)] min-h-[650px] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <header className="relative z-40 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Back
            </button>
          )}

          <span className="text-sm font-semibold text-slate-800">
            PDF Takeoff
          </span>

          {currentCalibration && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Scale set
            </span>
          )}

          {isLoadingTakeoff && (
            <span className="text-xs text-slate-500">
              Loading takeoff…
            </span>
          )}

          {!isLoadingTakeoff &&
            isSaving && (
              <span className="text-xs text-blue-600">
                Saving…
              </span>
            )}

          {!isLoadingTakeoff &&
            !isSaving &&
            lastSavedAt && (
              <span className="text-xs text-emerald-600">
                Saved
              </span>
            )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setPageNumber(
                (current) =>
                  Math.max(
                    current - 1,
                    1,
                  ),
              )
            }
            disabled={pageNumber <= 1}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <span className="min-w-24 text-center text-sm text-slate-700">
            Page {pageNumber} of{" "}
            {numberOfPages || "—"}
          </span>

          <button
            type="button"
            onClick={() =>
              setPageNumber(
                (current) =>
                  Math.min(
                    current + 1,
                    numberOfPages,
                  ),
              )
            }
            disabled={
              !numberOfPages ||
              pageNumber >=
                numberOfPages
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>

          <div className="mx-1 h-6 w-px bg-slate-200" />

          <button
            type="button"
            onClick={zoomOut}
            disabled={
              displayedScale <= MIN_SCALE
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>

          <span className="min-w-16 text-center text-sm text-slate-700">
            {pageWidth
              ? "Fit"
              : `${Math.round(
                  scale * 100,
                )}%`}
          </span>

          <button
            type="button"
            onClick={zoomIn}
            disabled={
              displayedScale >= MAX_SCALE
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>

          <button
            type="button"
            onClick={fitToWidth}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Fit width
          </button>

          <button
            type="button"
            onClick={resetView}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Reset view
          </button>
        </div>
      </header>

      <div className="relative z-40 flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() =>
            selectTool("pan")
          }
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeTool === "pan"
              ? "bg-slate-800 text-white"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Pan
        </button>

        <button
          type="button"
          onClick={() =>
            selectTool("calibrate")
          }
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeTool === "calibrate"
              ? "bg-amber-500 text-white"
              : "border border-amber-300 bg-white text-amber-700 hover:bg-amber-50"
          }`}
        >
          {currentCalibration
            ? "Recalibrate"
            : "Set Scale"}
        </button>

        <button
          type="button"
          onClick={() =>
            selectTool("measure-walls")
          }
          disabled={!currentCalibration}
          className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
            activeTool ===
            "measure-walls"
              ? "bg-blue-600 text-white"
              : "border border-blue-300 bg-white text-blue-700 hover:bg-blue-50"
          }`}
        >
          Measure Walls
        </button>

        <button
          type="button"
          onClick={() =>
            selectTool("measure-floor")
          }
          disabled={!currentCalibration}
          className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
            activeTool ===
            "measure-floor"
              ? "bg-green-600 text-white"
              : "border border-green-300 bg-white text-green-700 hover:bg-green-50"
          }`}
        >
          Measure Floor
        </button>

        <button
          type="button"
          onClick={() =>
            selectTool("measure-roof")
          }
          disabled={!currentCalibration}
          className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
            activeTool ===
            "measure-roof"
              ? "bg-red-600 text-white"
              : "border border-red-300 bg-white text-red-700 hover:bg-red-50"
          }`}
        >
          Measure Roof
        </button>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={undoLastWall}
            disabled={
              currentMeasurements.length ===
              0
            }
            className="rounded-md border border-blue-300 px-3 py-2 text-sm text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo Wall
          </button>

          <button
            type="button"
            onClick={() =>
              undoLastArea("floor")
            }
            disabled={
              currentFloorBoxes.length ===
              0
            }
            className="rounded-md border border-green-300 px-3 py-2 text-sm text-green-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo Floor
          </button>

          <button
            type="button"
            onClick={() =>
              undoLastArea("roof")
            }
            disabled={
              currentRoofBoxes.length ===
              0
            }
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo Roof
          </button>

          {currentCalibration && (
            <button
              type="button"
              onClick={resetCurrentScale}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Reset Scale
            </button>
          )}
        </div>
      </div>

      <div className="relative z-40 grid shrink-0 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Wall Total
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-700">
                {formatTotalDistance(
                  currentWallTotalMm,
                )}
              </p>
            </div>

            {currentWallAssignment && (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {currentWallAssignment.category.toUpperCase()}
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            {currentMeasurements.length} line
            {currentMeasurements.length === 1
              ? ""
              : "s"}
          </p>

          <div className="mt-3 flex gap-2">
            <select
              value={selectedWallCategory}
              onChange={(event) =>
                setSelectedWallCategory(
                  event.target
                    .value as MeasurementCategory,
                )
              }
              className="min-w-0 flex-1 rounded-md border border-blue-300 bg-white px-3 py-2 text-sm"
            >
              <option value="gfw">
                GFW
              </option>

              <option value="ffw">
                FFW
              </option>
            </select>

            <button
              type="button"
              onClick={assignWallTotal}
              disabled={
                currentMeasurements.length ===
                0
              }
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Set As
            </button>
          </div>

          {currentWallAssignment && (
            <div className="mt-3 flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <span>
                Assigned as{" "}
                <strong>
                  {currentWallAssignment.category.toUpperCase()}
                </strong>
              </span>

              <button
                type="button"
                onClick={
                  removeWallAssignment
                }
                className="font-semibold text-red-600"
              >
                Remove
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={clearWalls}
            disabled={
              currentMeasurements.length ===
              0
            }
            className="mt-3 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear page walls
          </button>
        </div>

        <div className="rounded-lg border border-green-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Floor Total
              </p>

              <p className="mt-1 text-2xl font-bold text-green-700">
                {formatArea(
                  currentFloorTotalM2,
                )}
              </p>
            </div>

            {currentFloorAssignment && (
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                Assigned
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            {currentFloorBoxes.length} box
            {currentFloorBoxes.length === 1
              ? ""
              : "es"}
          </p>

          <button
            type="button"
            onClick={() =>
              assignAreaTotal("floor")
            }
            disabled={
              currentFloorBoxes.length ===
              0
            }
            className="mt-3 w-full rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Set As Floor
          </button>

          {currentFloorAssignment && (
            <div className="mt-3 flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
              <span>
                Floor total assigned
              </span>

              <button
                type="button"
                onClick={() =>
                  removeAreaAssignment(
                    "floor",
                  )
                }
                className="font-semibold text-red-600"
              >
                Remove
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              clearArea("floor")
            }
            disabled={
              currentFloorBoxes.length ===
              0
            }
            className="mt-3 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear page floor
          </button>
        </div>

        <div className="rounded-lg border border-red-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Roof Total
              </p>

              <p className="mt-1 text-2xl font-bold text-red-700">
                {formatArea(
                  currentRoofTotalM2,
                )}
              </p>
            </div>

            {currentRoofAssignment && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                Assigned
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            {currentRoofBoxes.length} box
            {currentRoofBoxes.length === 1
              ? ""
              : "es"}
          </p>

          <button
            type="button"
            onClick={() =>
              assignAreaTotal("roof")
            }
            disabled={
              currentRoofBoxes.length ===
              0
            }
            className="mt-3 w-full rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Set As Roof
          </button>

          {currentRoofAssignment && (
            <div className="mt-3 flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
              <span>
                Roof total assigned
              </span>

              <button
                type="button"
                onClick={() =>
                  removeAreaAssignment(
                    "roof",
                  )
                }
                className="font-semibold text-red-700"
              >
                Remove
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              clearArea("roof")
            }
            disabled={
              currentRoofBoxes.length ===
              0
            }
            className="mt-3 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear page roof
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Assigned Job Totals
          </p>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-slate-600">
              GFW
            </span>

            <strong className="text-right">
              {formatTotalDistance(
                assignedTotals.gfw,
              )}
            </strong>

            <span className="text-slate-600">
              FFW
            </span>

            <strong className="text-right">
              {formatTotalDistance(
                assignedTotals.ffw,
              )}
            </strong>

            <span className="text-slate-600">
              Floor
            </span>

            <strong className="text-right text-green-700">
              {formatArea(
                assignedTotals.floor,
              )}
            </strong>

            <span className="text-slate-600">
              Roof
            </span>

            <strong className="text-right text-red-700">
              {formatArea(
                assignedTotals.roof,
              )}
            </strong>
          </div>
        </div>
      </div>

      {currentCalibration && (
        <div className="relative z-40 flex shrink-0 flex-wrap gap-4 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
          <span>
            Axis 1:{" "}
            {formatCalibrationDistance(
              currentCalibration.primaryAxis
                .realDistanceMm,
            )}
          </span>

          <span>
            Axis 2:{" "}
            {formatCalibrationDistance(
              currentCalibration.secondaryAxis
                .realDistanceMm,
            )}
          </span>
        </div>
      )}

      {(viewerError || saveError) && (
        <div className="relative z-40 shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-medium text-red-700">
          {viewerError || saveError}
        </div>
      )}

      <main
        ref={viewportRef}
        onMouseDown={handlePanStart}
        className={`relative min-h-0 flex-1 touch-none overflow-hidden bg-slate-200 ${
          interactiveOverlay
            ? "cursor-crosshair"
            : isPanning
              ? "cursor-grabbing"
              : "cursor-grab"
        }`}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 top-1/2 select-none"
            style={{
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
            }}
          >
            <Document
              file={file}
              loading={
                <div className="rounded-lg bg-white px-8 py-6 shadow-sm">
                  Loading PDF…
                </div>
              }
              error={
                <div className="rounded-lg border border-red-200 bg-red-50 px-8 py-6 text-red-700">
                  This PDF could not be opened.
                </div>
              }
              onLoadSuccess={({
                numPages,
              }) => {
                setNumberOfPages(
                  numPages,
                );

                setPageNumber(1);
              }}
              onLoadError={(error) => {
                console.error(
                  "Unable to load PDF:",
                  error,
                );
              }}
            >
              <div
                ref={pageWrapperRef}
                className="relative isolate inline-block overflow-hidden rounded-md bg-white shadow-xl"
              >
                <Page
                  pageNumber={pageNumber}
                  scale={
                    pageWidth
                      ? undefined
                      : scale
                  }
                  width={pageWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />

                <svg
                  className={`absolute inset-0 z-50 h-full w-full ${
                    interactiveOverlay
                      ? "pointer-events-auto"
                      : "pointer-events-none"
                  }`}
                  onMouseDown={(event) => {
                    if (!interactiveOverlay) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onMouseMove={
                    handleOverlayMouseMove
                  }
                  onClick={handleOverlayClick}
                >
                  {currentFloorBoxes.map(
                    (box) => (
                      <AreaBoxOverlay
                        key={box.id}
                        box={box}
                        fillColour={
                          floorColour
                        }
                        borderColour={
                          floorDarkColour
                        }
                        activeTool={
                          activeTool
                        }
                        onDelete={() =>
                          deleteAreaBox(
                            box.id,
                          )
                        }
                      />
                    ),
                  )}

                  {currentRoofBoxes.map(
                    (box) => (
                      <AreaBoxOverlay
                        key={box.id}
                        box={box}
                        fillColour={
                          roofColour
                        }
                        borderColour={
                          roofDarkColour
                        }
                        activeTool={
                          activeTool
                        }
                        onDelete={() =>
                          deleteAreaBox(
                            box.id,
                          )
                        }
                      />
                    ),
                  )}

                  {currentMeasurements.map(
                    (measurement) => {
                      const midpointX =
                        (measurement.start.x +
                          measurement.end.x) /
                        2;

                      const midpointY =
                        (measurement.start.y +
                          measurement.end.y) /
                        2;

                      return (
                        <g
                          key={
                            measurement.id
                          }
                        >
                          <line
                            x1={`${measurement.start.x * 100}%`}
                            y1={`${measurement.start.y * 100}%`}
                            x2={`${measurement.end.x * 100}%`}
                            y2={`${measurement.end.y * 100}%`}
                            stroke="#2563eb"
                            strokeWidth="4"
                            vectorEffect="non-scaling-stroke"
                            pointerEvents="none"
                          />

                          <circle
                            cx={`${measurement.start.x * 100}%`}
                            cy={`${measurement.start.y * 100}%`}
                            r="5"
                            fill="#2563eb"
                            stroke="#ffffff"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                            pointerEvents="none"
                          />

                          <circle
                            cx={`${measurement.end.x * 100}%`}
                            cy={`${measurement.end.y * 100}%`}
                            r="5"
                            fill="#2563eb"
                            stroke="#ffffff"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                            pointerEvents="none"
                          />

                          <g
                            className={
                              activeTool ===
                              "pan"
                                ? "pointer-events-auto cursor-pointer"
                                : "pointer-events-none"
                            }
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();

                              deleteMeasurement(
                                measurement.id,
                              );
                            }}
                          >
                            <rect
                              x={`${midpointX * 100}%`}
                              y={`${midpointY * 100}%`}
                              width="92"
                              height="28"
                              rx="6"
                              fill="#2563eb"
                              transform="translate(-46 -14)"
                            />

                            <text
                              x={`${midpointX * 100}%`}
                              y={`${midpointY * 100}%`}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#ffffff"
                              fontSize="13"
                              fontWeight="600"
                            >
                              {formatDistance(
                                measurement.distanceMm,
                              )}
                            </text>
                          </g>
                        </g>
                      );
                    },
                  )}

                  {primaryAxisToDisplay && (
                    <CalibrationLine
                      axis={
                        primaryAxisToDisplay
                      }
                      colour="#d97706"
                    />
                  )}

                  {secondaryAxisToDisplay && (
                    <CalibrationLine
                      axis={
                        secondaryAxisToDisplay
                      }
                      colour="#7c3aed"
                    />
                  )}

                  {activeTool ===
                    "calibrate" &&
                    calibrationStart &&
                    calibrationEnd && (
                      <PreviewLine
                        start={
                          calibrationStart
                        }
                        end={calibrationEnd}
                        colour={
                          calibrationAxis ===
                          "primary"
                            ? "#d97706"
                            : "#7c3aed"
                        }
                      />
                    )}

                  {measurementStart &&
                    measurementEnd && (
                      <PreviewLine
                        start={
                          measurementStart
                        }
                        end={measurementEnd}
                        colour="#2563eb"
                      />
                    )}

                  {firstAreaLine &&
                    activeAreaCategory && (
                      <PreviewLine
                        start={
                          firstAreaLine.start
                        }
                        end={
                          firstAreaLine.end
                        }
                        colour={
                          activeAreaCategory ===
                          "floor"
                            ? floorColour
                            : roofColour
                        }
                        solid
                      />
                    )}

                  {areaLineStart &&
                    areaLineEnd &&
                    activeAreaCategory && (
                      <PreviewLine
                        start={
                          areaLineStart
                        }
                        end={areaLineEnd}
                        colour={
                          activeAreaCategory ===
                          "floor"
                            ? floorColour
                            : roofColour
                        }
                      />
                    )}
                </svg>
              </div>
            </Document>
          </div>
        </div>
      </main>

      {isDistanceModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">
              {calibrationAxis === "primary"
                ? "Enter First Axis Distance"
                : "Enter Second Axis Distance"}
            </h2>

            <div className="mt-5 flex gap-3">
              <input
                type="number"
                min="0"
                step="any"
                autoFocus
                value={distanceInput}
                onChange={(event) => {
                  setDistanceInput(
                    event.target.value,
                  );

                  setViewerError("");
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter"
                  ) {
                    saveCalibrationAxis();
                  }
                }}
                placeholder={
                  distanceUnit === "mm"
                    ? "e.g. 6500"
                    : "e.g. 6.5"
                }
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
              />

              <select
                value={distanceUnit}
                onChange={(event) =>
                  setDistanceUnit(
                    event.target
                      .value as CalibrationUnit,
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="mm">
                  Millimetres
                </option>

                <option value="m">
                  Metres
                </option>
              </select>
            </div>

            {viewerError && (
              <p className="mt-3 text-sm font-medium text-red-600">
                {viewerError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDistanceModalOpen(
                    false,
                  );

                  setCalibrationEnd(null);
                  setDistanceInput("");
                  setViewerError("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
              >
                Choose Points Again
              </button>

              <button
                type="button"
                onClick={
                  saveCalibrationAxis
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                {calibrationAxis ===
                "primary"
                  ? "Save and Set Axis 2"
                  : "Save Scale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type AreaBoxOverlayProps = {
  box: AreaBox;
  fillColour: string;
  borderColour: string;
  activeTool: ViewerTool;
  onDelete: () => void;
};

function AreaBoxOverlay({
  box,
  fillColour,
  borderColour,
  activeTool,
  onDelete,
}: AreaBoxOverlayProps) {
  const centreX =
    box.corners.reduce(
      (total, corner) =>
        total + corner.x,
      0,
    ) / box.corners.length;

  const centreY =
    box.corners.reduce(
      (total, corner) =>
        total + corner.y,
      0,
    ) / box.corners.length;

  return (
    <g>
      <foreignObject
        x="0"
        y="0"
        width="100%"
        height="100%"
        pointerEvents="none"
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor:
              fillColour,
            opacity: 0.5,

            clipPath: `polygon(${box.corners
              .map(
                (corner) =>
                  `${corner.x * 100}% ${corner.y * 100}%`,
              )
              .join(", ")})`,
          }}
        />
      </foreignObject>

      {box.corners.map(
        (corner, index) => {
          const nextCorner =
            box.corners[
              (index + 1) %
                box.corners.length
            ];

          return (
            <line
              key={`${box.id}-border-${index}`}
              x1={`${corner.x * 100}%`}
              y1={`${corner.y * 100}%`}
              x2={`${nextCorner.x * 100}%`}
              y2={`${nextCorner.y * 100}%`}
              stroke={borderColour}
              strokeWidth="6"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              pointerEvents="none"
            />
          );
        },
      )}

      <g
        className={
          activeTool === "pan"
            ? "pointer-events-auto cursor-pointer"
            : "pointer-events-none"
        }
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          onDelete();
        }}
      >
        <rect
          x={`${centreX * 100}%`}
          y={`${centreY * 100}%`}
          width="100"
          height="30"
          rx="6"
          fill={borderColour}
          transform="translate(-50 -15)"
        />

        <text
          x={`${centreX * 100}%`}
          y={`${centreY * 100}%`}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize="13"
          fontWeight="600"
        >
          {formatArea(box.areaM2)}
        </text>
      </g>
    </g>
  );
}

type CalibrationLineProps = {
  axis: AxisCalibration;
  colour: string;
};

function CalibrationLine({
  axis,
  colour,
}: CalibrationLineProps) {
  return (
    <>
      <line
        x1={`${axis.start.x * 100}%`}
        y1={`${axis.start.y * 100}%`}
        x2={`${axis.end.x * 100}%`}
        y2={`${axis.end.y * 100}%`}
        stroke={colour}
        strokeWidth="4"
        strokeDasharray="9 5"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />

      <circle
        cx={`${axis.start.x * 100}%`}
        cy={`${axis.start.y * 100}%`}
        r="5"
        fill={colour}
        stroke="#ffffff"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />

      <circle
        cx={`${axis.end.x * 100}%`}
        cy={`${axis.end.y * 100}%`}
        r="5"
        fill={colour}
        stroke="#ffffff"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    </>
  );
}

type PreviewLineProps = {
  start: Point;
  end: Point;
  colour: string;
  solid?: boolean;
};

function PreviewLine({
  start,
  end,
  colour,
  solid = false,
}: PreviewLineProps) {
  return (
    <line
      x1={`${start.x * 100}%`}
      y1={`${start.y * 100}%`}
      x2={`${end.x * 100}%`}
      y2={`${end.y * 100}%`}
      stroke={colour}
      strokeWidth="4"
      strokeDasharray={
        solid ? undefined : "8 5"
      }
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}