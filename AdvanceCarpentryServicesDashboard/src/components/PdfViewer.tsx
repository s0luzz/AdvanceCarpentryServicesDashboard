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
  fileId: string;
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

type ViewerMode = "architectural" | "structural";

type BeamType = {
  id: string;
  name: string;
  kgPerMetre: number;
};

type SteelBeam = {
  id: string;
  pageNumber: number;
  start: Point;
  end: Point;
  lengthMm: number;
  beamTypeId: string;
};

type SteelPost = {
  id: string;
  pageNumber: number;
  point: Point;
  costDollars: number;
};

type ScalePreset = {
  id: string;
  name: string;
  primaryAxis: AxisCalibration;
  secondaryAxis: AxisCalibration;
};

type AssignedPageAreaTotal = {
  pageNumber: number;
  category: AreaCategory;
  totalM2: number;
  boxCount: number;
};

type SavedTakeoff = {
  mode: ViewerMode | null;
  calibrations: Record<number, Calibration>;
  measurements: Measurement[];
  areaBoxes: AreaBox[];
  beams: SteelBeam[];
  posts: SteelPost[];

  assignedPageWallTotals: Record<
    number,
    AssignedPageWallTotal
  >;

  assignedPageAreaTotals: Record<
    string,
    AssignedPageAreaTotal
  >;

  retainScaleAcrossPages: boolean;
};

type CalibrationUnit = "mm" | "m";

type CalibrationAxis =
  | "primary"
  | "secondary";

type ViewerTool =
  | "pan"
  | "calibrate"
  | "measure-walls"
  | "measure-floor"
  | "measure-roof"
  | "measure-beams"
  | "select-posts";

type AreaDrawingStep =
  | "first-line"
  | "second-line";

const API_URL =
  "http://localhost:3001";

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
const SCALE_STEP = 0.2;

const MIN_LINE_LENGTH = 0.002;

const MIN_AXIS_DETERMINANT = 0.1;

const SAVE_DELAY_MS = 600;

function createEmptyTakeoff(): SavedTakeoff {
  return {
    mode: null,
    calibrations: {},
    measurements: [],
    areaBoxes: [],
    beams: [],
    posts: [],
    assignedPageWallTotals: {},
    assignedPageAreaTotals: {},
    retainScaleAcrossPages: false,
  };
}

const STEEL_RATE_PER_KG = 5.5;
const STEEL_BEAM_DOUBLING_FACTOR = 2;

function computeSteelTotal(
  beamsList: SteelBeam[],
  postsList: SteelPost[],
  beamTypesList: BeamType[],
) {
  const beamWeightKg = beamsList.reduce(
    (sum, beam) => {
      const beamType = beamTypesList.find(
        (type) => type.id === beam.beamTypeId,
      );

      if (!beamType) {
        return sum;
      }

      const lengthM = beam.lengthMm / 1000;

      return (
        sum +
        beamType.kgPerMetre *
          lengthM *
          STEEL_BEAM_DOUBLING_FACTOR
      );
    },
    0,
  );

  const postCostTotal = postsList.reduce(
    (sum, post) => sum + post.costDollars,
    0,
  );

  return (
    postCostTotal +
    beamWeightKg * STEEL_RATE_PER_KG
  );
}

function sumWallAndAreaTotals(
  wallTotals: Record<
    number,
    AssignedPageWallTotal
  >,
  areaTotals: Record<
    string,
    AssignedPageAreaTotal
  >,
) {
  const walls = Object.values(
    wallTotals,
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

  const areas = Object.values(
    areaTotals,
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

  return { ...walls, ...areas };
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
    typeof crypto.randomUUID ===
      "function"
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
    x:
      (end.x - start.x) *
      pageAspectRatio,

    y: end.y - start.y,
  };
}

function getVectorLength(
  vector: Vector,
) {
  return Math.sqrt(
    vector.x ** 2 +
      vector.y ** 2,
  );
}

function normaliseVector(
  vector: Vector,
): Vector {
  const length =
    getVectorLength(vector);

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
    (Math.acos(clampedDotProduct) *
      180) /
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
    calibration.primaryAxis
      .unitVector;

  const secondary =
    calibration.secondaryAxis
      .unitVector;

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
    (measurementVector.x *
      secondary.y -
      measurementVector.y *
        secondary.x) /
    determinant;

  const secondaryComponent =
    (primary.x *
      measurementVector.y -
      primary.y *
        measurementVector.x) /
    determinant;

  const primaryDistanceMm =
    primaryComponent *
    calibration.primaryAxis
      .mmPerPageUnit;

  const secondaryDistanceMm =
    secondaryComponent *
    calibration.secondaryAxis
      .mmPerPageUnit;

  return Math.sqrt(
    primaryDistanceMm ** 2 +
      secondaryDistanceMm ** 2,
  );
}

function formatDistance(
  distanceMm: number,
) {
  if (distanceMm >= 1000) {
    return `${(
      distanceMm / 1000
    ).toFixed(2)} m`;
  }

  return `${Math.round(
    distanceMm,
  )} mm`;
}

function formatTotalDistance(
  distanceMm: number,
) {
  return `${(
    distanceMm / 1000
  ).toFixed(2)} m`;
}

function formatArea(
  areaM2: number,
) {
  return `${areaM2.toFixed(
    2,
  )} m²`;
}

function formatCalibrationDistance(
  distanceMm: number,
) {
  if (
    distanceMm >= 1000 &&
    distanceMm % 1000 === 0
  ) {
    return `${
      distanceMm / 1000
    } m`;
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
    mode:
      takeoff.mode === "architectural" ||
      takeoff.mode === "structural"
        ? takeoff.mode
        : null,

    calibrations:
      takeoff.calibrations &&
      typeof takeoff.calibrations ===
        "object"
        ? takeoff.calibrations
        : {},

    measurements:
      Array.isArray(
        takeoff.measurements,
      )
        ? takeoff.measurements
        : [],

    areaBoxes:
      Array.isArray(
        takeoff.areaBoxes,
      )
        ? takeoff.areaBoxes
        : [],

    beams:
      Array.isArray(takeoff.beams)
        ? takeoff.beams
        : [],

    posts:
      Array.isArray(takeoff.posts)
        ? takeoff.posts
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

    retainScaleAcrossPages:
      takeoff.retainScaleAcrossPages ===
      true,
  };
}

async function readJsonResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const contentType =
    response.headers.get(
      "content-type",
    );

  if (
    !contentType
      ?.toLowerCase()
      .includes(
        "application/json",
      )
  ) {
    const responseText =
      await response.text();

    if (
      responseText
        .trim()
        .toLowerCase()
        .startsWith(
          "<!doctype",
        )
    ) {
      throw new Error(
        "The request reached the frontend instead of the backend. Confirm the backend is running on port 3001.",
      );
    }

    throw new Error(
      `${fallbackMessage} The server returned a non-JSON response.`,
    );
  }

  const result =
    (await response.json()) as T;

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
  fileId,
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

  const scaleRef =
    useRef(1);

  const pageWidthRef =
    useRef<number | undefined>(
      undefined,
    );

  const panRef =
    useRef<PanPosition>({
      x: 0,
      y: 0,
    });

  const activeToolRef =
    useRef<ViewerTool>(
      "pan",
    );

  const modalOpenRef =
    useRef(false);

  const hasLoadedTakeoffRef =
    useRef(false);

  const otherFilesTakeoffRef =
    useRef<
      Record<string, SavedTakeoff>
    >({});

  const [
    viewerMode,
    setViewerMode,
  ] = useState<ViewerMode | null>(
    null,
  );

  const [
    beamTypes,
    setBeamTypes,
  ] = useState<BeamType[]>([]);

  const [
    beamTypesError,
    setBeamTypesError,
  ] = useState("");

  const [
    scalePresets,
    setScalePresets,
  ] = useState<ScalePreset[]>([]);

  const [
    selectedScalePresetId,
    setSelectedScalePresetId,
  ] = useState("");

  const [
    isSavingScalePreset,
    setIsSavingScalePreset,
  ] = useState(false);

  const [
    newScalePresetName,
    setNewScalePresetName,
  ] = useState("");

  const [
    scalePresetError,
    setScalePresetError,
  ] = useState("");

  const [
    lastPostCost,
    setLastPostCost,
  ] = useState("");

  const [
    beams,
    setBeams,
  ] = useState<SteelBeam[]>([]);

  const [
    posts,
    setPosts,
  ] = useState<SteelPost[]>([]);

  const [
    beamDrawStart,
    setBeamDrawStart,
  ] = useState<Point | null>(null);

  const [
    beamDrawEnd,
    setBeamDrawEnd,
  ] = useState<Point | null>(null);

  const [
    pendingBeam,
    setPendingBeam,
  ] = useState<{
    start: Point;
    end: Point;
    lengthMm: number;
  } | null>(null);

  const [
    selectedBeamTypeId,
    setSelectedBeamTypeId,
  ] = useState("");

  const [
    isCreatingBeamType,
    setIsCreatingBeamType,
  ] = useState(false);

  const [
    newBeamTypeName,
    setNewBeamTypeName,
  ] = useState("");

  const [
    newBeamTypeKgPerMetre,
    setNewBeamTypeKgPerMetre,
  ] = useState("");

  const [
    pendingPostPoint,
    setPendingPostPoint,
  ] = useState<Point | null>(null);

  const [
    postCostInput,
    setPostCostInput,
  ] = useState("");

  const [
    numberOfPages,
    setNumberOfPages,
  ] = useState(0);

  const [
    pageNumber,
    setPageNumber,
  ] = useState(1);

  const [scale, setScale] =
    useState(1);

  const [
    pageWidth,
    setPageWidth,
  ] =
    useState<number | undefined>();

  const [pan, setPan] =
    useState<PanPosition>({
      x: 0,
      y: 0,
    });

  const [
    isLoadingTakeoff,
    setIsLoadingTakeoff,
  ] = useState(true);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    saveError,
    setSaveError,
  ] = useState("");

  const [
    lastSavedAt,
    setLastSavedAt,
  ] =
    useState<Date | null>(
      null,
    );

  const [
    isPanning,
    setIsPanning,
  ] = useState(false);

  const [
    activeTool,
    setActiveTool,
  ] =
    useState<ViewerTool>(
      "pan",
    );

  const [
    calibrationAxis,
    setCalibrationAxis,
  ] =
    useState<CalibrationAxis>(
      "primary",
    );

  const [
    calibrationStart,
    setCalibrationStart,
  ] =
    useState<Point | null>(
      null,
    );

  const [
    calibrationEnd,
    setCalibrationEnd,
  ] =
    useState<Point | null>(
      null,
    );

  const [
    calibrationDrafts,
    setCalibrationDrafts,
  ] = useState<
    Record<
      number,
      CalibrationDraft
    >
  >({});

  const [
    calibrations,
    setCalibrations,
  ] = useState<
    Record<
      number,
      Calibration
    >
  >({});

  const [
    retainScaleAcrossPages,
    setRetainScaleAcrossPages,
  ] =
    useState(false);

  const [
    measurementStart,
    setMeasurementStart,
  ] =
    useState<Point | null>(
      null,
    );

  const [
    measurementEnd,
    setMeasurementEnd,
  ] =
    useState<Point | null>(
      null,
    );

  const [
    measurements,
    setMeasurements,
  ] =
    useState<Measurement[]>(
      [],
    );

  const [
    areaBoxes,
    setAreaBoxes,
  ] =
    useState<AreaBox[]>(
      [],
    );

  const [
    areaDrawingStep,
    setAreaDrawingStep,
  ] =
    useState<AreaDrawingStep>(
      "first-line",
    );

  const [
    areaLineStart,
    setAreaLineStart,
  ] =
    useState<Point | null>(
      null,
    );

  const [
    areaLineEnd,
    setAreaLineEnd,
  ] =
    useState<Point | null>(
      null,
    );

  const [
    firstAreaLine,
    setFirstAreaLine,
  ] =
    useState<Line | null>(
      null,
    );

  const [
    isDistanceModalOpen,
    setIsDistanceModalOpen,
  ] =
    useState(false);

  const [
    distanceInput,
    setDistanceInput,
  ] = useState("");

  const [
    distanceUnit,
    setDistanceUnit,
  ] =
    useState<CalibrationUnit>(
      "mm",
    );

  const [
    viewerError,
    setViewerError,
  ] = useState("");

  const [
    selectedWallCategory,
    setSelectedWallCategory,
  ] =
    useState<MeasurementCategory>(
      "gfw",
    );

  const [
    assignedPageWallTotals,
    setAssignedPageWallTotals,
  ] = useState<
    Record<
      number,
      AssignedPageWallTotal
    >
  >({});

  const [
    assignedPageAreaTotals,
    setAssignedPageAreaTotals,
  ] = useState<
    Record<
      string,
      AssignedPageAreaTotal
    >
  >({});

  /*
   * -------------------------------------------------------
   * SCALE RETENTION
   * -------------------------------------------------------
   *
   * pageCalibration:
   * The scale specifically saved for the current page.
   *
   * retainedScale:
   * If Retain Scale is enabled and the current page does
   * not have its own calibration, find the most recently
   * calibrated page before it.
   *
   * If there is no earlier calibrated page, use the first
   * calibrated page in the PDF.
   *
   * A page-specific calibration always has priority.
   */

  const pageCalibration =
    calibrations[pageNumber];

  const retainedScale =
    useMemo(() => {
      if (
        !retainScaleAcrossPages
      ) {
        return null;
      }

      const calibratedPages =
        Object.keys(
          calibrations,
        )
          .map(Number)
          .filter(
            (page) =>
              Number.isFinite(
                page,
              ),
          )
          .sort(
            (a, b) =>
              a - b,
          );

      if (
        calibratedPages.length ===
        0
      ) {
        return null;
      }

      const previousPages =
        calibratedPages.filter(
          (page) =>
            page <
            pageNumber,
        );

      const sourcePage =
        previousPages.length >
        0
          ? previousPages[
              previousPages.length -
                1
            ]
          : calibratedPages[0];

      const calibration =
        calibrations[
          sourcePage
        ];

      if (!calibration) {
        return null;
      }

      return {
        sourcePage,
        calibration,
      };
    }, [
      calibrations,
      pageNumber,
      retainScaleAcrossPages,
    ]);

  const currentCalibration =
    pageCalibration ??
    retainedScale?.calibration;

  const isUsingRetainedScale =
    retainScaleAcrossPages &&
    !pageCalibration &&
    Boolean(
      retainedScale?.calibration,
    );

  const currentCalibrationDraft =
    calibrationDrafts[
      pageNumber
    ] ?? {};

  const currentWallAssignment =
    assignedPageWallTotals[
      pageNumber
    ];

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

  const currentMeasurements =
    useMemo(
      () =>
        measurements.filter(
          (
            measurement,
          ) =>
            measurement.pageNumber ===
            pageNumber,
        ),
      [
        measurements,
        pageNumber,
      ],
    );

  const currentBeams =
    useMemo(
      () =>
        beams.filter(
          (beam) =>
            beam.pageNumber ===
            pageNumber,
        ),
      [beams, pageNumber],
    );

  const currentPosts =
    useMemo(
      () =>
        posts.filter(
          (post) =>
            post.pageNumber ===
            pageNumber,
        ),
      [posts, pageNumber],
    );

  const steelTotal = useMemo(
    () =>
      computeSteelTotal(
        beams,
        posts,
        beamTypes,
      ),
    [beams, posts, beamTypes],
  );

  const sortedBeamTypes = useMemo(
    () =>
      [...beamTypes].sort(
        (a, b) =>
          a.kgPerMetre -
          b.kgPerMetre,
      ),
    [beamTypes],
  );

  const currentFloorBoxes =
    useMemo(
      () =>
        areaBoxes.filter(
          (box) =>
            box.pageNumber ===
              pageNumber &&
            box.category ===
              "floor",
        ),
      [
        areaBoxes,
        pageNumber,
      ],
    );

  const currentRoofBoxes =
    useMemo(
      () =>
        areaBoxes.filter(
          (box) =>
            box.pageNumber ===
              pageNumber &&
            box.category ===
              "roof",
        ),
      [
        areaBoxes,
        pageNumber,
      ],
    );

  const currentWallTotalMm =
    useMemo(
      () =>
        currentMeasurements.reduce(
          (
            total,
            measurement,
          ) =>
            total +
            measurement.distanceMm,
          0,
        ),
      [
        currentMeasurements,
      ],
    );

  const currentFloorTotalM2 =
    useMemo(
      () =>
        currentFloorBoxes.reduce(
          (
            total,
            box,
          ) =>
            total +
            box.areaM2,
          0,
        ),
      [
        currentFloorBoxes,
      ],
    );

  const currentRoofTotalM2 =
    useMemo(
      () =>
        currentRoofBoxes.reduce(
          (
            total,
            box,
          ) =>
            total +
            box.areaM2,
          0,
        ),
      [
        currentRoofBoxes,
      ],
    );

  const assignedTotals =
    useMemo(
      () =>
        sumWallAndAreaTotals(
          assignedPageWallTotals,
          assignedPageAreaTotals,
        ),
      [
        assignedPageWallTotals,
        assignedPageAreaTotals,
      ],
    );

  useEffect(() => {
    scaleRef.current =
      scale;
  }, [scale]);

  useEffect(() => {
    pageWidthRef.current =
      pageWidth;
  }, [pageWidth]);

  useEffect(() => {
    panRef.current =
      pan;
  }, [pan]);

  useEffect(() => {
    activeToolRef.current =
      activeTool;
  }, [activeTool]);

  useEffect(() => {
    modalOpenRef.current =
      isDistanceModalOpen;
  }, [
    isDistanceModalOpen,
  ]);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/api/beam-types`)
      .then((response) =>
        response.json(),
      )
      .then((data) => {
        if (
          !cancelled &&
          Array.isArray(data)
        ) {
          setBeamTypes(data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(
      `${API_URL}/api/scale-presets`,
    )
      .then((response) =>
        response.json(),
      )
      .then((data) => {
        if (
          !cancelled &&
          Array.isArray(data)
        ) {
          setScalePresets(data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTakeoff() {
      hasLoadedTakeoffRef.current =
        false;

      setIsLoadingTakeoff(
        true,
      );

      setSaveError("");
      setLastSavedAt(null);

      try {
        const response =
          await fetch(
            `${API_URL}/api/quoted-jobs/${jobId}`,
          );

        const job =
          await readJsonResponse<{
            takeoff?: unknown;
            takeoffByFile?: Record<
              string,
              unknown
            >;
          }>(
            response,
            "Unable to load quote",
          );

        if (cancelled) {
          return;
        }

        const takeoffByFile =
          job.takeoffByFile &&
          typeof job.takeoffByFile ===
            "object"
            ? job.takeoffByFile
            : {};

        otherFilesTakeoffRef.current =
          Object.fromEntries(
            Object.entries(
              takeoffByFile,
            )
              .filter(
                ([
                  entryFileId,
                ]) =>
                  entryFileId !==
                  fileId,
              )
              .map(
                ([
                  entryFileId,
                  value,
                ]) => [
                  entryFileId,
                  parseSavedTakeoff(
                    value,
                  ),
                ],
              ),
          );

        const saved =
          parseSavedTakeoff(
            takeoffByFile[fileId] ??
              job.takeoff,
          );

        // Jobs measured before structural mode existed have no
        // "mode" saved, but already have architectural data — infer
        // the mode rather than interrupting them with the prompt.
        const hasExistingArchitecturalData =
          saved.measurements.length >
            0 ||
          saved.areaBoxes.length >
            0 ||
          Object.keys(
            saved.assignedPageWallTotals,
          ).length > 0;

        setViewerMode(
          saved.mode ??
            (hasExistingArchitecturalData
              ? "architectural"
              : null),
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

        setBeams(saved.beams);

        setPosts(saved.posts);

        setAssignedPageWallTotals(
          saved.assignedPageWallTotals,
        );

        setAssignedPageAreaTotals(
          saved.assignedPageAreaTotals,
        );

        setRetainScaleAcrossPages(
          saved.retainScaleAcrossPages,
        );

        setCalibrationDrafts(
          {},
        );
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
          setIsLoadingTakeoff(
            false,
          );

          hasLoadedTakeoffRef.current =
            true;
        }
      }
    }

    void loadTakeoff();

    return () => {
      cancelled = true;
    };
  }, [
    jobId,
    fileId,
    file,
  ]);

  useEffect(() => {
    if (
      !hasLoadedTakeoffRef.current ||
      viewerMode === null
    ) {
      return;
    }

    const timeoutId =
      window.setTimeout(
        async () => {
          const takeoff: SavedTakeoff =
            {
              mode: viewerMode,
              calibrations,
              measurements,
              areaBoxes,
              beams,
              posts,
              assignedPageWallTotals,
              assignedPageAreaTotals,
              retainScaleAcrossPages,
            };

          const takeoffByFile = {
            ...otherFilesTakeoffRef.current,
            [fileId]: takeoff,
          };

          // The job's overall wall/floor/roof/steel totals are the
          // sum across every attached file's measurements, not just
          // the one currently open.
          const combinedTotals =
            Object.values(
              otherFilesTakeoffRef.current,
            ).reduce(
              (totals, other) => {
                const otherTotals =
                  sumWallAndAreaTotals(
                    other.assignedPageWallTotals,
                    other.assignedPageAreaTotals,
                  );

                return {
                  gfw:
                    totals.gfw +
                    otherTotals.gfw,
                  ffw:
                    totals.ffw +
                    otherTotals.ffw,
                  floor:
                    totals.floor +
                    otherTotals.floor,
                  roof:
                    totals.roof +
                    otherTotals.roof,
                };
              },
              { ...assignedTotals },
            );

          // Only touch job.steel if a structural file has actually
          // been used for this job — otherwise this would silently
          // overwrite a manually-typed Steel Cost with $0 every time
          // an unrelated architectural file is saved.
          const hasStructuralFile =
            viewerMode ===
              "structural" ||
            Object.values(
              otherFilesTakeoffRef.current,
            ).some(
              (other) =>
                other.mode ===
                "structural",
            );

          const combinedSteelTotal =
            steelTotal +
            Object.values(
              otherFilesTakeoffRef.current,
            ).reduce(
              (sum, other) =>
                sum +
                computeSteelTotal(
                  other.beams,
                  other.posts,
                  beamTypes,
                ),
              0,
            );

          const patchBody: Record<
            string,
            unknown
          > = {
            takeoffByFile,
            gfw: combinedTotals.gfw / 1000,
            ffw: combinedTotals.ffw / 1000,
            floor: combinedTotals.floor,
            roof: combinedTotals.roof,
          };

          if (hasStructuralFile) {
            patchBody.steel =
              combinedSteelTotal;
          }

          setIsSaving(true);
          setSaveError("");

          try {
            const response =
              await fetch(
                `${API_URL}/api/quoted-jobs/${jobId}`,
                {
                  method:
                    "PATCH",

                  headers: {
                    "Content-Type":
                      "application/json",
                  },

                  body:
                    JSON.stringify(
                      patchBody,
                    ),
                },
              );

            await readJsonResponse(
              response,
              "Unable to save takeoff",
            );

            setLastSavedAt(
              new Date(),
            );
          } catch (error) {
            console.error(
              "Unable to save takeoff:",
              error,
            );

            setSaveError(
              error instanceof
                Error
                ? error.message
                : "Unable to save takeoff.",
            );
          } finally {
            setIsSaving(
              false,
            );
          }
        },
        SAVE_DELAY_MS,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    jobId,
    fileId,
    viewerMode,
    calibrations,
    measurements,
    areaBoxes,
    beams,
    posts,
    assignedPageWallTotals,
    assignedPageAreaTotals,
    retainScaleAcrossPages,
    assignedTotals.gfw,
    assignedTotals.ffw,
    assignedTotals.floor,
    assignedTotals.roof,
    steelTotal,
    beamTypes,
  ]);

  useEffect(() => {
    setNumberOfPages(0);
    setPageNumber(1);

    setScale(1);
    scaleRef.current = 1;

    setPageWidth(
      undefined,
    );

    pageWidthRef.current =
      undefined;

    const initialPan = {
      x: 0,
      y: 0,
    };

    setPan(initialPan);

    panRef.current =
      initialPan;

    setIsPanning(false);

    setActiveTool("pan");

    activeToolRef.current =
      "pan";

    resetDrawingState();

    setViewerError("");

    dragStartRef.current =
      null;
  }, [file]);

  useEffect(() => {
    setActiveTool("pan");

    activeToolRef.current =
      "pan";

    resetDrawingState();

    const assignment =
      assignedPageWallTotals[
        pageNumber
      ];

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

    panRef.current =
      nextPan;

    dragStartRef.current =
      null;

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

      panRef.current =
        nextPan;

      setPan(nextPan);
    }

    function handleMouseUp() {
      dragStartRef.current =
        null;

      setIsPanning(
        false,
      );
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
    const viewport =
      viewportRef.current;

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

      if (
        modalOpenRef.current
      ) {
        return;
      }

      const bounds =
        currentViewport.getBoundingClientRect();

      const cursorX =
        event.clientX -
        bounds.left;

      const cursorY =
        event.clientY -
        bounds.top;

      const currentScale =
        pageWidthRef.current
          ? 1
          : scaleRef.current;

      const direction =
        event.deltaY < 0
          ? 1
          : -1;

      const nextScale =
        clamp(
          Number(
            (
              currentScale +
              direction *
                SCALE_STEP
            ).toFixed(2),
          ),
          MIN_SCALE,
          MAX_SCALE,
        );

      if (
        nextScale ===
          currentScale &&
        pageWidthRef.current ===
          undefined
      ) {
        return;
      }

      const ratio =
        nextScale /
        currentScale;

      const centredCursorX =
        cursorX -
        bounds.width / 2;

      const centredCursorY =
        cursorY -
        bounds.height / 2;

      const nextPan = {
        x:
          centredCursorX -
          (centredCursorX -
            panRef.current
              .x) *
            ratio,

        y:
          centredCursorY -
          (centredCursorY -
            panRef.current
              .y) *
            ratio,
      };

      pageWidthRef.current =
        undefined;

      scaleRef.current =
        nextScale;

      panRef.current =
        nextPan;

      setPageWidth(
        undefined,
      );

      setScale(
        nextScale,
      );

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

  function chooseMode(
    mode: ViewerMode,
  ) {
    setViewerMode(mode);

    if (
      mode === "structural" &&
      Object.keys(calibrations)
        .length === 0
    ) {
      const architecturalFile =
        Object.values(
          otherFilesTakeoffRef.current,
        ).find(
          (other) =>
            other.mode ===
              "architectural" &&
            Object.keys(
              other.calibrations,
            ).length > 0,
        );

      if (architecturalFile) {
        setCalibrations(
          architecturalFile.calibrations,
        );

        setRetainScaleAcrossPages(
          architecturalFile.retainScaleAcrossPages,
        );
      }
    }
  }

  function applyScalePreset(
    presetId: string,
  ) {
    setSelectedScalePresetId(
      presetId,
    );

    const preset = scalePresets.find(
      (item) => item.id === presetId,
    );

    if (!preset) {
      return;
    }

    setCalibrations((current) => ({
      ...current,
      [pageNumber]: {
        pageNumber,
        primaryAxis:
          preset.primaryAxis,
        secondaryAxis:
          preset.secondaryAxis,
      },
    }));

    setViewerError("");
  }

  async function saveScalePreset() {
    if (!currentCalibration) {
      return;
    }

    if (!newScalePresetName.trim()) {
      setScalePresetError(
        "Enter a name for this scale.",
      );

      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/scale-presets`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: newScalePresetName.trim(),
            primaryAxis:
              currentCalibration.primaryAxis,
            secondaryAxis:
              currentCalibration.secondaryAxis,
          }),
        },
      );

      const created =
        await readJsonResponse<ScalePreset>(
          response,
          "Unable to save scale preset",
        );

      setScalePresets((current) => [
        ...current,
        created,
      ]);

      setSelectedScalePresetId(
        created.id,
      );

      setNewScalePresetName("");
      setIsSavingScalePreset(false);
      setScalePresetError("");
    } catch (error) {
      setScalePresetError(
        error instanceof Error
          ? error.message
          : "Unable to save scale preset.",
      );
    }
  }

  function resetDrawingState() {
    setCalibrationAxis(
      "primary",
    );

    setCalibrationStart(
      null,
    );

    setCalibrationEnd(
      null,
    );

    setMeasurementStart(
      null,
    );

    setMeasurementEnd(
      null,
    );

    setBeamDrawStart(null);
    setBeamDrawEnd(null);

    resetAreaDrawing();

    setIsDistanceModalOpen(
      false,
    );

    setDistanceInput("");
  }

  function resetAreaDrawing() {
    setAreaDrawingStep(
      "first-line",
    );

    setAreaLineStart(
      null,
    );

    setAreaLineEnd(
      null,
    );

    setFirstAreaLine(
      null,
    );
  }

  function getCurrentAreaCategory():
    | AreaCategory
    | null {
    if (
      activeTool ===
      "measure-floor"
    ) {
      return "floor";
    }

    if (
      activeTool ===
      "measure-roof"
    ) {
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

    return (
      bounds.width /
      bounds.height
    );
  }

  function updateScale(
    nextScale: number,
  ) {
    scaleRef.current =
      nextScale;

    setScale(
      nextScale,
    );
  }

  function updatePan(
    nextPan: PanPosition,
  ) {
    panRef.current =
      nextPan;

    setPan(
      nextPan,
    );
  }

  function applyButtonZoom(
    nextScale: number,
  ) {
    const currentScale =
      pageWidth
        ? 1
        : scale;

    const clampedScale =
      clamp(
        nextScale,
        MIN_SCALE,
        MAX_SCALE,
      );

    const ratio =
      clampedScale /
      currentScale;

    pageWidthRef.current =
      undefined;

    setPageWidth(
      undefined,
    );

    updateScale(
      clampedScale,
    );

    updatePan({
      x:
        panRef.current.x *
        ratio,

      y:
        panRef.current.y *
        ratio,
    });
  }

  function zoomIn() {
    const currentScale =
      pageWidth
        ? 1
        : scale;

    applyButtonZoom(
      currentScale +
        SCALE_STEP,
    );
  }

  function zoomOut() {
    const currentScale =
      pageWidth
        ? 1
        : scale;

    applyButtonZoom(
      currentScale -
        SCALE_STEP,
    );
  }

  function resetView() {
    pageWidthRef.current =
      undefined;

    setPageWidth(
      undefined,
    );

    updateScale(1);

    updatePan({
      x: 0,
      y: 0,
    });
  }

  function fitToWidth() {
    const viewportWidth =
      viewportRef.current
        ?.clientWidth;

    if (!viewportWidth) {
      return;
    }

    const fittedWidth =
      Math.max(
        viewportWidth - 64,
        300,
      );

    pageWidthRef.current =
      fittedWidth;

    setPageWidth(
      fittedWidth,
    );

    updateScale(1);

    updatePan({
      x: 0,
      y: 0,
    });
  }

  function selectTool(
    tool: ViewerTool,
  ) {
    dragStartRef.current =
      null;

    setIsPanning(
      false,
    );

    setViewerError("");

    setCalibrationStart(
      null,
    );

    setCalibrationEnd(
      null,
    );

    setMeasurementStart(
      null,
    );

    setMeasurementEnd(
      null,
    );

    resetAreaDrawing();

    if (
      tool !== "pan" &&
      tool !== "calibrate" &&
      !currentCalibration
    ) {
      setViewerError(
        "Complete both scale directions before measuring.",
      );

      setActiveTool(
        "pan",
      );

      activeToolRef.current =
        "pan";

      return;
    }

    if (
      tool === "calibrate"
    ) {
      setCalibrationAxis(
        "primary",
      );

      setCalibrationDrafts(
        (current) => ({
          ...current,

          [pageNumber]: {},
        }),
      );
    }

    setActiveTool(tool);

    activeToolRef.current =
      tool;
  }

  function handlePanStart(
    event: ReactMouseEvent<HTMLDivElement>,
  ) {
    if (
      activeToolRef.current !==
        "pan" ||
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
      mouseX:
        event.clientX,

      mouseY:
        event.clientY,

      panX:
        panRef.current.x,

      panY:
        panRef.current.y,
    };

    setIsPanning(
      true,
    );
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
        (event.clientX -
          bounds.left) /
          bounds.width,
        0,
        1,
      ),

      y: clamp(
        (event.clientY -
          bounds.top) /
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
      getRelativePoint(
        event,
      );

    if (!point) {
      return;
    }

    if (
      activeTool ===
      "calibrate"
    ) {
      handleCalibrationPoint(
        point,
      );

      return;
    }

    if (
      activeTool ===
      "measure-walls"
    ) {
      handleWallMeasurementPoint(
        point,
      );

      return;
    }

    if (
      activeTool ===
        "measure-floor" ||
      activeTool ===
        "measure-roof"
    ) {
      handleAreaPoint(
        point,
      );

      return;
    }

    if (
      activeTool ===
      "measure-beams"
    ) {
      handleBeamPoint(point);

      return;
    }

    if (
      activeTool ===
      "select-posts"
    ) {
      handlePostPoint(point);
    }
  }

  function handleCalibrationPoint(
    point: Point,
  ) {
    if (!calibrationStart) {
      setCalibrationStart(
        point,
      );

      setCalibrationEnd(
        null,
      );

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

    const vector =
      getPageSpaceVector(
        calibrationStart,
        point,
        pageAspectRatio,
      );

    const pageSpaceLength =
      getVectorLength(
        vector,
      );

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
      calibrationAxis ===
        "secondary" &&
      currentCalibrationDraft.primaryAxis
    ) {
      const angleDifference =
        calculateAxisAngleDifference(
          currentCalibrationDraft
            .primaryAxis
            .unitVector,

          normaliseVector(
            vector,
          ),
        );

      if (
        angleDifference <
        20
      ) {
        setViewerError(
          "The second scale direction is too close to the first.",
        );

        return;
      }
    }

    setCalibrationEnd(
      point,
    );

    setDistanceInput("");

    setIsDistanceModalOpen(
      true,
    );
  }

  function saveCalibrationAxis() {
    if (
      !calibrationStart ||
      !calibrationEnd
    ) {
      return;
    }

    const enteredDistance =
      Number(
        distanceInput,
      );

    if (
      !Number.isFinite(
        enteredDistance,
      ) ||
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
        ? enteredDistance *
          1000
        : enteredDistance;

    const vector =
      getPageSpaceVector(
        calibrationStart,
        calibrationEnd,
        pageAspectRatio,
      );

    const pageSpaceLength =
      getVectorLength(
        vector,
      );

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
        start:
          calibrationStart,

        end:
          calibrationEnd,

        realDistanceMm,

        pageSpaceLength,

        unitVector:
          normaliseVector(
            vector,
          ),

        mmPerPageUnit:
          realDistanceMm /
          pageSpaceLength,
      };

    if (
      calibrationAxis ===
      "primary"
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

      setCalibrationAxis(
        "secondary",
      );

      setCalibrationStart(
        null,
      );

      setCalibrationEnd(
        null,
      );

      setIsDistanceModalOpen(
        false,
      );

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
      primaryAxis
        .unitVector.x *
        axisCalibration
          .unitVector.y -
      primaryAxis
        .unitVector.y *
        axisCalibration
          .unitVector.x;

    if (
      Math.abs(
        determinant,
      ) <
      MIN_AXIS_DETERMINANT
    ) {
      setViewerError(
        "The calibration directions are too similar.",
      );

      return;
    }

    setCalibrations(
      (current) => ({
        ...current,

        [pageNumber]: {
          pageNumber,
          primaryAxis,

          secondaryAxis:
            axisCalibration,
        },
      }),
    );

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

    setCalibrationStart(
      null,
    );

    setCalibrationEnd(
      null,
    );

    setIsDistanceModalOpen(
      false,
    );

    setDistanceInput("");

    setViewerError("");

    setActiveTool(
      "pan",
    );

    activeToolRef.current =
      "pan";
  }

  function handleWallMeasurementPoint(
    point: Point,
  ) {
    if (
      !currentCalibration
    ) {
      return;
    }

    if (
      !measurementStart
    ) {
      setMeasurementStart(
        point,
      );

      setMeasurementEnd(
        null,
      );

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

    setMeasurements(
      (current) => [
        ...current,

        {
          id: createId(),

          pageNumber,

          start:
            measurementStart,

          end: point,

          distanceMm,
        },
      ],
    );

    setMeasurementStart(
      null,
    );

    setMeasurementEnd(
      null,
    );

    setViewerError("");
  }

  function handleBeamPoint(
    point: Point,
  ) {
    if (!currentCalibration) {
      return;
    }

    if (!beamDrawStart) {
      setBeamDrawStart(point);
      setBeamDrawEnd(point);
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

    const lengthMm =
      calculateCalibratedDistance(
        beamDrawStart,
        point,
        pageAspectRatio,
        currentCalibration,
      );

    if (
      lengthMm === null ||
      lengthMm <= 0
    ) {
      setViewerError(
        "Unable to calculate that beam length.",
      );

      return;
    }

    setPendingBeam({
      start: beamDrawStart,
      end: point,
      lengthMm,
    });

    setSelectedBeamTypeId(
      sortedBeamTypes[0]?.id ?? "",
    );

    setBeamDrawStart(null);
    setBeamDrawEnd(null);
    setViewerError("");
  }

  function saveBeam() {
    if (
      !pendingBeam ||
      !selectedBeamTypeId
    ) {
      return;
    }

    setBeams((current) => [
      ...current,
      {
        id: createId(),
        pageNumber,
        start: pendingBeam.start,
        end: pendingBeam.end,
        lengthMm:
          pendingBeam.lengthMm,
        beamTypeId:
          selectedBeamTypeId,
      },
    ]);

    setPendingBeam(null);
  }

  function cancelBeam() {
    setPendingBeam(null);
  }

  async function createBeamType() {
    const kgPerMetre = Number(
      newBeamTypeKgPerMetre,
    );

    if (
      !newBeamTypeName.trim() ||
      !Number.isFinite(
        kgPerMetre,
      ) ||
      kgPerMetre <= 0
    ) {
      setBeamTypesError(
        "Enter a name and a positive kg/m value.",
      );

      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/beam-types`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: newBeamTypeName.trim(),
            kgPerMetre,
          }),
        },
      );

      const created =
        await readJsonResponse<BeamType>(
          response,
          "Unable to create beam type",
        );

      setBeamTypes((current) => [
        ...current,
        created,
      ]);

      setSelectedBeamTypeId(
        created.id,
      );

      setNewBeamTypeName("");
      setNewBeamTypeKgPerMetre("");
      setIsCreatingBeamType(false);
      setBeamTypesError("");
    } catch (error) {
      setBeamTypesError(
        error instanceof Error
          ? error.message
          : "Unable to create beam type.",
      );
    }
  }

  function handlePostPoint(
    point: Point,
  ) {
    setPendingPostPoint(point);

    // Post price stays the same throughout a set of plans, so
    // default to whatever was last entered instead of blank.
    setPostCostInput(
      lastPostCost,
    );
  }

  function savePost() {
    const cost = Number(
      postCostInput,
    );

    if (
      !pendingPostPoint ||
      !Number.isFinite(cost) ||
      cost < 0
    ) {
      return;
    }

    setPosts((current) => [
      ...current,
      {
        id: createId(),
        pageNumber,
        point: pendingPostPoint,
        costDollars: cost,
      },
    ]);

    setLastPostCost(
      postCostInput,
    );

    setPendingPostPoint(null);
  }

  function cancelPost() {
    setPendingPostPoint(null);
  }

  function undoLastBeam() {
    setBeams((current) =>
      current.slice(0, -1),
    );
  }

  function undoLastPost() {
    setPosts((current) =>
      current.slice(0, -1),
    );
  }

  function deleteBeam(id: string) {
    setBeams((current) =>
      current.filter(
        (beam) => beam.id !== id,
      ),
    );
  }

  function deletePost(id: string) {
    setPosts((current) =>
      current.filter(
        (post) => post.id !== id,
      ),
    );
  }

  function handleAreaPoint(
    point: Point,
  ) {
    const category =
      getCurrentAreaCategory();

    if (
      !category ||
      !currentCalibration
    ) {
      return;
    }

    if (!areaLineStart) {
      setAreaLineStart(
        point,
      );

      setAreaLineEnd(
        null,
      );

      setViewerError("");

      return;
    }

    const completedLine: Line =
      {
        start:
          areaLineStart,

        end: point,
      };

    if (
      areaDrawingStep ===
      "first-line"
    ) {
      setFirstAreaLine(
        completedLine,
      );

      setAreaDrawingStep(
        "second-line",
      );

      setAreaLineStart(
        null,
      );

      setAreaLineEnd(
        null,
      );

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
    if (
      !currentCalibration
    ) {
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

    const cornerOne =
      firstLine.start;

    const cornerTwo =
      firstLine.end;

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
      (lengthMm *
        widthMm) /
      1_000_000;

    setAreaBoxes(
      (current) => [
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
      ],
    );

    resetAreaDrawing();

    setViewerError("");
  }

  function handleOverlayMouseMove(
    event: ReactMouseEvent<SVGSVGElement>,
  ) {
    const point =
      getRelativePoint(
        event,
      );

    if (!point) {
      return;
    }

    if (
      activeTool ===
        "calibrate" &&
      calibrationStart
    ) {
      setCalibrationEnd(
        point,
      );
    }

    if (
      activeTool ===
        "measure-walls" &&
      measurementStart
    ) {
      setMeasurementEnd(
        point,
      );
    }

    if (
      (activeTool ===
        "measure-floor" ||
        activeTool ===
          "measure-roof") &&
      areaLineStart
    ) {
      setAreaLineEnd(
        point,
      );
    }

    if (
      activeTool ===
        "measure-beams" &&
      beamDrawStart
    ) {
      setBeamDrawEnd(point);
    }
  }

  function assignWallTotal() {
    if (
      currentMeasurements.length ===
      0
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

    if (
      boxes.length === 0
    ) {
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

          boxCount:
            boxes.length,
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

        delete next[
          pageNumber
        ];

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

  function deleteMeasurement(
    id: string,
  ) {
    setMeasurements(
      (current) =>
        current.filter(
          (
            measurement,
          ) =>
            measurement.id !==
            id,
        ),
    );
  }

  function deleteAreaBox(
    id: string,
  ) {
    setAreaBoxes(
      (current) =>
        current.filter(
          (box) =>
            box.id !== id,
        ),
    );
  }

  function undoLastWall() {
    setMeasurements(
      (current) => {
        let index = -1;

        for (
          let itemIndex =
            current.length -
            1;
          itemIndex >= 0;
          itemIndex -= 1
        ) {
          if (
            current[
              itemIndex
            ].pageNumber ===
            pageNumber
          ) {
            index =
              itemIndex;

            break;
          }
        }

        if (
          index === -1
        ) {
          return current;
        }

        return current.filter(
          (
            _,
            itemIndex,
          ) =>
            itemIndex !==
            index,
        );
      },
    );

    setMeasurementStart(
      null,
    );

    setMeasurementEnd(
      null,
    );
  }

  function undoLastArea(
    category: AreaCategory,
  ) {
    setAreaBoxes(
      (current) => {
        let index = -1;

        for (
          let itemIndex =
            current.length -
            1;
          itemIndex >= 0;
          itemIndex -= 1
        ) {
          const box =
            current[
              itemIndex
            ];

          if (
            box.pageNumber ===
              pageNumber &&
            box.category ===
              category
          ) {
            index =
              itemIndex;

            break;
          }
        }

        if (
          index === -1
        ) {
          return current;
        }

        return current.filter(
          (
            _,
            itemIndex,
          ) =>
            itemIndex !==
            index,
        );
      },
    );

    resetAreaDrawing();
  }

  function clearWalls() {
    setMeasurements(
      (current) =>
        current.filter(
          (
            measurement,
          ) =>
            measurement.pageNumber !==
            pageNumber,
        ),
    );

    removeWallAssignment();

    setMeasurementStart(
      null,
    );

    setMeasurementEnd(
      null,
    );
  }

  function clearArea(
    category: AreaCategory,
  ) {
    setAreaBoxes(
      (current) =>
        current.filter(
          (box) =>
            !(
              box.pageNumber ===
                pageNumber &&
              box.category ===
                category
            ),
        ),
    );

    removeAreaAssignment(
      category,
    );

    resetAreaDrawing();
  }

  function resetCurrentScale() {
    if (
      !pageCalibration
    ) {
      return;
    }

    setCalibrations(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          pageNumber
        ];

        return next;
      },
    );

    setCalibrationDrafts(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          pageNumber
        ];

        return next;
      },
    );

    clearWalls();

    clearArea(
      "floor",
    );

    clearArea(
      "roof",
    );

    setActiveTool(
      "pan",
    );

    activeToolRef.current =
      "pan";
  }

  const displayedScale =
    pageWidth
      ? 1
      : scale;

  const activeAreaCategory =
    getCurrentAreaCategory();

  const interactiveOverlay =
    activeTool !== "pan";

  const primaryAxisToDisplay =
    activeTool ===
    "calibrate"
      ? currentCalibrationDraft.primaryAxis
      : currentCalibration?.primaryAxis;

  const secondaryAxisToDisplay =
    activeTool ===
    "calibrate"
      ? currentCalibrationDraft.secondaryAxis
      : currentCalibration?.secondaryAxis;

  const floorColour =
    "#16a34a";

  const floorDarkColour =
    "#15803d";

  const roofColour =
    "#dc2626";

  const roofDarkColour =
    "#b91c1c";

  if (
    !isLoadingTakeoff &&
    viewerMode === null
  ) {
    return (
      <div className="flex h-[calc(100vh-2rem)] min-h-[650px] w-full flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-slate-100 p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">
          What are you measuring?
        </h2>

        <p className="max-w-md text-sm text-slate-600">
          Architectural plans use the
          wall, floor and roof takeoff
          tools. Structural plans
          measure steel beams and
          posts instead.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              chooseMode(
                "architectural",
              )
            }
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Architectural
          </button>

          <button
            type="button"
            onClick={() =>
              chooseMode(
                "structural",
              )
            }
            className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Structural
          </button>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-2 text-sm text-slate-500 hover:underline"
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

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

          {viewerMode && (
            <button
              type="button"
              onClick={() =>
                setViewerMode(null)
              }
              title="Switch between architectural and structural"
              className={`rounded-full px-2.5 py-1 text-xs font-medium hover:opacity-80 ${
                viewerMode ===
                "structural"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {viewerMode ===
              "structural"
                ? "Structural"
                : "Architectural"}
            </button>
          )}

          {pageCalibration && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Scale set
            </span>
          )}

          {isUsingRetainedScale &&
            retainedScale && (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                Retained from page{" "}
                {
                  retainedScale.sourcePage
                }
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
                    current -
                      1,
                    1,
                  ),
              )
            }
            disabled={
              pageNumber <= 1
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <span className="min-w-24 text-center text-sm text-slate-700">
            Page{" "}
            {pageNumber} of{" "}
            {numberOfPages ||
              "—"}
          </span>

          <button
            type="button"
            onClick={() =>
              setPageNumber(
                (current) =>
                  Math.min(
                    current +
                      1,
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
            onClick={
              zoomOut
            }
            disabled={
              displayedScale <=
              MIN_SCALE
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>

          <span className="min-w-16 text-center text-sm text-slate-700">
            {pageWidth
              ? "Fit"
              : `${Math.round(
                  scale *
                    100,
                )}%`}
          </span>

          <button
            type="button"
            onClick={
              zoomIn
            }
            disabled={
              displayedScale >=
              MAX_SCALE
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>

          <button
            type="button"
            onClick={
              fitToWidth
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Fit width
          </button>

          <button
            type="button"
            onClick={
              resetView
            }
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
            selectTool(
              "pan",
            )
          }
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeTool ===
            "pan"
              ? "bg-slate-800 text-white"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Pan
        </button>

        <button
          type="button"
          onClick={() =>
            selectTool(
              "calibrate",
            )
          }
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeTool ===
            "calibrate"
              ? "bg-amber-500 text-white"
              : "border border-amber-300 bg-white text-amber-700 hover:bg-amber-50"
          }`}
        >
          {pageCalibration
            ? "Recalibrate"
            : isUsingRetainedScale
              ? "Set Page Scale"
              : "Set Scale"}
        </button>

        <button
          type="button"
          onClick={() =>
            setRetainScaleAcrossPages(
              (current) =>
                !current,
            )
          }
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            retainScaleAcrossPages
              ? "bg-emerald-600 text-white"
              : "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
          }`}
          title="Use the most recently calibrated page on pages that do not have their own scale."
        >
          Retain Scale
        </button>

        <select
          value={
            selectedScalePresetId
          }
          onChange={(event) =>
            applyScalePreset(
              event.target.value,
            )
          }
          disabled={
            scalePresets.length ===
            0
          }
          title="Apply a saved scale to this page"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <option value="">
            {scalePresets.length ===
            0
              ? "No saved scales"
              : "Use saved scale…"}
          </option>

          {scalePresets.map(
            (preset) => (
              <option
                key={preset.id}
                value={preset.id}
              >
                {preset.name}
              </option>
            ),
          )}
        </select>

        <button
          type="button"
          onClick={() => {
            setNewScalePresetName(
              "",
            );

            setScalePresetError(
              "",
            );

            setIsSavingScalePreset(
              true,
            );
          }}
          disabled={
            !currentCalibration
          }
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save Scale as Preset
        </button>

        {viewerMode ===
          "architectural" && (
          <>
            <button
              type="button"
              onClick={() =>
                selectTool(
                  "measure-walls",
                )
              }
              disabled={
                !currentCalibration
              }
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
                selectTool(
                  "measure-floor",
                )
              }
              disabled={
                !currentCalibration
              }
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
                selectTool(
                  "measure-roof",
                )
              }
              disabled={
                !currentCalibration
              }
              className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                activeTool ===
                "measure-roof"
                  ? "bg-red-600 text-white"
                  : "border border-red-300 bg-white text-red-700 hover:bg-red-50"
              }`}
            >
              Measure Roof
            </button>
          </>
        )}

        {viewerMode ===
          "structural" && (
          <>
            <button
              type="button"
              onClick={() =>
                selectTool(
                  "measure-beams",
                )
              }
              disabled={
                !currentCalibration
              }
              className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                activeTool ===
                "measure-beams"
                  ? "bg-orange-600 text-white"
                  : "border border-orange-300 bg-white text-orange-700 hover:bg-orange-50"
              }`}
            >
              Measure Beams
            </button>

            <button
              type="button"
              onClick={() =>
                selectTool(
                  "select-posts",
                )
              }
              disabled={
                !currentCalibration
              }
              className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                activeTool ===
                "select-posts"
                  ? "bg-purple-600 text-white"
                  : "border border-purple-300 bg-white text-purple-700 hover:bg-purple-50"
              }`}
            >
              Select Posts
            </button>
          </>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          {viewerMode ===
            "architectural" && (
            <>
              <button
                type="button"
                onClick={
                  undoLastWall
                }
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
                  undoLastArea(
                    "floor",
                  )
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
                  undoLastArea(
                    "roof",
                  )
                }
                disabled={
                  currentRoofBoxes.length ===
                  0
                }
                className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Undo Roof
              </button>
            </>
          )}

          {viewerMode ===
            "structural" && (
            <>
              <button
                type="button"
                onClick={
                  undoLastBeam
                }
                disabled={
                  currentBeams.length ===
                  0
                }
                className="rounded-md border border-orange-300 px-3 py-2 text-sm text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Undo Beam
              </button>

              <button
                type="button"
                onClick={
                  undoLastPost
                }
                disabled={
                  currentPosts.length ===
                  0
                }
                className="rounded-md border border-purple-300 px-3 py-2 text-sm text-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Undo Post
              </button>
            </>
          )}

          {pageCalibration && (
            <button
              type="button"
              onClick={
                resetCurrentScale
              }
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Reset Scale
            </button>
          )}
        </div>
      </div>

      {viewerMode ===
        "architectural" && (
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
            {
              currentMeasurements.length
            }{" "}
            line
            {currentMeasurements.length ===
            1
              ? ""
              : "s"}
          </p>

          <div className="mt-3 flex gap-2">
            <select
              value={
                selectedWallCategory
              }
              onChange={(
                event,
              ) =>
                setSelectedWallCategory(
                  event
                    .target
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
              onClick={
                assignWallTotal
              }
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
            onClick={
              clearWalls
            }
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
            {
              currentFloorBoxes.length
            }{" "}
            box
            {currentFloorBoxes.length ===
            1
              ? ""
              : "es"}
          </p>

          <button
            type="button"
            onClick={() =>
              assignAreaTotal(
                "floor",
              )
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
              clearArea(
                "floor",
              )
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
            {
              currentRoofBoxes.length
            }{" "}
            box
            {currentRoofBoxes.length ===
            1
              ? ""
              : "es"}
          </p>

          <button
            type="button"
            onClick={() =>
              assignAreaTotal(
                "roof",
              )
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
              clearArea(
                "roof",
              )
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
      )}

      {viewerMode ===
        "structural" && (
        <div className="relative z-40 grid shrink-0 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 md:grid-cols-3">
          <div className="rounded-lg border border-orange-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Beams (this page)
            </p>

            <p className="mt-1 text-2xl font-bold text-orange-700">
              {
                currentBeams.length
              }
            </p>
          </div>

          <div className="rounded-lg border border-purple-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Posts (this page)
            </p>

            <p className="mt-1 text-2xl font-bold text-purple-700">
              {
                currentPosts.length
              }
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Steel Total (whole job)
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              $
              {steelTotal.toLocaleString(
                "en-AU",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                },
              )}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {beams.length} beam
              {beams.length === 1
                ? ""
                : "s"}{" "}
              +{" "}
              {posts.length} post
              {posts.length === 1
                ? ""
                : "s"}{" "}
              across all pages
            </p>
          </div>
        </div>
      )}

      {currentCalibration && (
        <div className="relative z-40 flex shrink-0 flex-wrap items-center gap-4 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
          {isUsingRetainedScale &&
            retainedScale && (
              <span className="font-semibold text-blue-700">
                Using scale from
                page{" "}
                {
                  retainedScale.sourcePage
                }
              </span>
            )}

          <span>
            Axis 1:{" "}
            {formatCalibrationDistance(
              currentCalibration
                .primaryAxis
                .realDistanceMm,
            )}
          </span>

          <span>
            Axis 2:{" "}
            {formatCalibrationDistance(
              currentCalibration
                .secondaryAxis
                .realDistanceMm,
            )}
          </span>
        </div>
      )}

      {(viewerError ||
        saveError) && (
        <div className="relative z-40 shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-medium text-red-700">
          {viewerError ||
            saveError}
        </div>
      )}

      <main
        ref={viewportRef}
        onMouseDown={
          handlePanStart
        }
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
                  This PDF could
                  not be opened.
                </div>
              }
              onLoadSuccess={({
                numPages,
              }) => {
                setNumberOfPages(
                  numPages,
                );

                setPageNumber(
                  1,
                );
              }}
              onLoadError={(
                error,
              ) => {
                console.error(
                  "Unable to load PDF:",
                  error,
                );
              }}
            >
              <div
                ref={
                  pageWrapperRef
                }
                className="relative isolate inline-block overflow-hidden rounded-md bg-white shadow-xl"
              >
                <Page
                  pageNumber={
                    pageNumber
                  }
                  scale={
                    pageWidth
                      ? undefined
                      : scale
                  }
                  width={
                    pageWidth
                  }
                  renderAnnotationLayer={
                    false
                  }
                  renderTextLayer={
                    false
                  }
                />

                <svg
                  className={`absolute inset-0 z-50 h-full w-full ${
                    interactiveOverlay
                      ? "pointer-events-auto"
                      : "pointer-events-none"
                  }`}
                  onMouseDown={(
                    event,
                  ) => {
                    if (
                      !interactiveOverlay
                    ) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onMouseMove={
                    handleOverlayMouseMove
                  }
                  onClick={
                    handleOverlayClick
                  }
                >
                  {viewerMode ===
                    "architectural" && (
                  <>
                  {currentFloorBoxes.map(
                    (box) => (
                      <AreaBoxOverlay
                        key={
                          box.id
                        }
                        box={
                          box
                        }
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
                        key={
                          box.id
                        }
                        box={
                          box
                        }
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
                    (
                      measurement,
                    ) => {
                      const midpointX =
                        (measurement
                          .start.x +
                          measurement
                            .end.x) /
                        2;

                      const midpointY =
                        (measurement
                          .start.y +
                          measurement
                            .end.y) /
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
                            onClick={(
                              event,
                            ) => {
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
                  </>
                  )}

                  {viewerMode ===
                    "structural" && (
                  <>
                  {currentBeams.map(
                    (beam) => {
                      const midpointX =
                        (beam.start
                          .x +
                          beam.end
                            .x) /
                        2;

                      const midpointY =
                        (beam.start
                          .y +
                          beam.end
                            .y) /
                        2;

                      const beamType =
                        beamTypes.find(
                          (type) =>
                            type.id ===
                            beam.beamTypeId,
                        );

                      return (
                        <g
                          key={
                            beam.id
                          }
                        >
                          <line
                            x1={`${beam.start.x * 100}%`}
                            y1={`${beam.start.y * 100}%`}
                            x2={`${beam.end.x * 100}%`}
                            y2={`${beam.end.y * 100}%`}
                            stroke="#ea580c"
                            strokeWidth="4"
                            vectorEffect="non-scaling-stroke"
                            pointerEvents="none"
                          />

                          <circle
                            cx={`${beam.start.x * 100}%`}
                            cy={`${beam.start.y * 100}%`}
                            r="5"
                            fill="#ea580c"
                            stroke="#ffffff"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                            pointerEvents="none"
                          />

                          <circle
                            cx={`${beam.end.x * 100}%`}
                            cy={`${beam.end.y * 100}%`}
                            r="5"
                            fill="#ea580c"
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
                            onClick={(
                              event,
                            ) => {
                              event.preventDefault();
                              event.stopPropagation();

                              deleteBeam(
                                beam.id,
                              );
                            }}
                          >
                            <rect
                              x={`${midpointX * 100}%`}
                              y={`${midpointY * 100}%`}
                              width="110"
                              height="28"
                              rx="6"
                              fill="#ea580c"
                              transform="translate(-55 -14)"
                            />

                            <text
                              x={`${midpointX * 100}%`}
                              y={`${midpointY * 100}%`}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#ffffff"
                              fontSize="12"
                              fontWeight="600"
                            >
                              {beamType?.name ??
                                "Unknown"}
                            </text>
                          </g>
                        </g>
                      );
                    },
                  )}

                  {currentPosts.map(
                    (post) => (
                      <g
                        key={
                          post.id
                        }
                        className={
                          activeTool ===
                          "pan"
                            ? "pointer-events-auto cursor-pointer"
                            : "pointer-events-none"
                        }
                        onClick={(
                          event,
                        ) => {
                          event.preventDefault();
                          event.stopPropagation();

                          deletePost(
                            post.id,
                          );
                        }}
                      >
                        <circle
                          cx={`${post.point.x * 100}%`}
                          cy={`${post.point.y * 100}%`}
                          r="9"
                          fill="#9333ea"
                          stroke="#ffffff"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                        />

                        <text
                          x={`${post.point.x * 100}%`}
                          y={`${post.point.y * 100}%`}
                          textAnchor="middle"
                          dominantBaseline="central"
                          dy="-16"
                          fill="#9333ea"
                          fontSize="12"
                          fontWeight="700"
                        >
                          $
                          {post.costDollars.toLocaleString(
                            "en-AU",
                          )}
                        </text>
                      </g>
                    ),
                  )}

                  {beamDrawStart && (
                    <circle
                      cx={`${beamDrawStart.x * 100}%`}
                      cy={`${beamDrawStart.y * 100}%`}
                      r="5"
                      fill="#ea580c"
                      stroke="#ffffff"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  )}
                  </>
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
                        end={
                          calibrationEnd
                        }
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
                        end={
                          measurementEnd
                        }
                        colour="#2563eb"
                      />
                    )}

                  {beamDrawStart &&
                    beamDrawEnd && (
                      <PreviewLine
                        start={
                          beamDrawStart
                        }
                        end={
                          beamDrawEnd
                        }
                        colour="#ea580c"
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
                        end={
                          areaLineEnd
                        }
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
              {calibrationAxis ===
              "primary"
                ? "Enter First Axis Distance"
                : "Enter Second Axis Distance"}
            </h2>

            <div className="mt-5 flex gap-3">
              <input
                type="number"
                min="0"
                step="any"
                autoFocus
                value={
                  distanceInput
                }
                onChange={(
                  event,
                ) => {
                  setDistanceInput(
                    event
                      .target
                      .value,
                  );

                  setViewerError(
                    "",
                  );
                }}
                onKeyDown={(
                  event,
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    saveCalibrationAxis();
                  }
                }}
                placeholder={
                  distanceUnit ===
                  "mm"
                    ? "e.g. 6500"
                    : "e.g. 6.5"
                }
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
              />

              <select
                value={
                  distanceUnit
                }
                onChange={(
                  event,
                ) =>
                  setDistanceUnit(
                    event
                      .target
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
                {
                  viewerError
                }
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDistanceModalOpen(
                    false,
                  );

                  setCalibrationEnd(
                    null,
                  );

                  setDistanceInput(
                    "",
                  );

                  setViewerError(
                    "",
                  );
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
              >
                Choose Points
                Again
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

      {pendingBeam && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">
              What type of beam is
              this?
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {formatDistance(
                pendingBeam.lengthMm,
              )}{" "}
              measured
            </p>

            {!isCreatingBeamType ? (
              <>
                <select
                  autoFocus
                  value={
                    selectedBeamTypeId
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedBeamTypeId(
                      event.target
                        .value,
                    )
                  }
                  className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  {sortedBeamTypes.length ===
                    0 && (
                    <option value="">
                      No beam types
                      yet
                    </option>
                  )}

                  {sortedBeamTypes.map(
                    (type) => (
                      <option
                        key={
                          type.id
                        }
                        value={
                          type.id
                        }
                      >
                        {type.name}{" "}
                        (
                        {
                          type.kgPerMetre
                        }{" "}
                        kg/m)
                      </option>
                    ),
                  )}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    setIsCreatingBeamType(
                      true,
                    )
                  }
                  className="mt-3 text-sm font-semibold text-orange-700 hover:underline"
                >
                  + New beam type
                </button>
              </>
            ) : (
              <div className="mt-5 space-y-3">
                <input
                  type="text"
                  autoFocus
                  value={
                    newBeamTypeName
                  }
                  onChange={(
                    event,
                  ) =>
                    setNewBeamTypeName(
                      event.target
                        .value,
                    )
                  }
                  placeholder="e.g. 150UB18"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={
                    newBeamTypeKgPerMetre
                  }
                  onChange={(
                    event,
                  ) =>
                    setNewBeamTypeKgPerMetre(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Weight, kg/m e.g. 18"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingBeamType(
                        false,
                      );

                      setBeamTypesError(
                        "",
                      );
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      createBeamType
                    }
                    className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    Add Beam Type
                  </button>
                </div>
              </div>
            )}

            {beamTypesError && (
              <p className="mt-3 text-sm font-medium text-red-600">
                {beamTypesError}
              </p>
            )}

            {!isCreatingBeamType && (
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={
                    cancelBeam
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    !selectedBeamTypeId
                  }
                  onClick={
                    saveBeam
                  }
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add Beam
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {pendingPostPoint && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Post Cost
            </h2>

            <div className="mt-5">
              <input
                type="number"
                min="0"
                step="any"
                autoFocus
                value={
                  postCostInput
                }
                onChange={(
                  event,
                ) =>
                  setPostCostInput(
                    event.target
                      .value,
                  )
                }
                onKeyDown={(
                  event,
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    savePost();
                  }
                }}
                placeholder="e.g. 250"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={
                  cancelPost
                }
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  !postCostInput
                }
                onClick={
                  savePost
                }
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add Post
              </button>
            </div>
          </div>
        </div>
      )}

      {isSavingScalePreset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Save Scale as Preset
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Save this page's scale
              so you can apply it to
              any other plan without
              recalibrating.
            </p>

            <input
              type="text"
              autoFocus
              value={
                newScalePresetName
              }
              onChange={(event) =>
                setNewScalePresetName(
                  event.target
                    .value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  void saveScalePreset();
                }
              }}
              placeholder="e.g. 1:100 A3"
              className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2"
            />

            {scalePresetError && (
              <p className="mt-3 text-sm font-medium text-red-600">
                {scalePresetError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsSavingScalePreset(
                    false,
                  );

                  setScalePresetError(
                    "",
                  );
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  !newScalePresetName.trim()
                }
                onClick={() =>
                  void saveScalePreset()
                }
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save
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
      (
        total,
        corner,
      ) =>
        total +
        corner.x,
      0,
    ) /
    box.corners.length;

  const centreY =
    box.corners.reduce(
      (
        total,
        corner,
      ) =>
        total +
        corner.y,
      0,
    ) /
    box.corners.length;

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
            width:
              "100%",

            height:
              "100%",

            backgroundColor:
              fillColour,

            opacity: 0.5,

            clipPath: `polygon(${box.corners
              .map(
                (
                  corner,
                ) =>
                  `${
                    corner.x *
                    100
                  }% ${
                    corner.y *
                    100
                  }%`,
              )
              .join(
                ", ",
              )})`,
          }}
        />
      </foreignObject>

      {box.corners.map(
        (
          corner,
          index,
        ) => {
          const nextCorner =
            box.corners[
              (index + 1) %
                box.corners
                  .length
            ];

          return (
            <line
              key={`${box.id}-border-${index}`}
              x1={`${corner.x * 100}%`}
              y1={`${corner.y * 100}%`}
              x2={`${nextCorner.x * 100}%`}
              y2={`${nextCorner.y * 100}%`}
              stroke={
                borderColour
              }
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
          activeTool ===
          "pan"
            ? "pointer-events-auto cursor-pointer"
            : "pointer-events-none"
        }
        onClick={(
          event,
        ) => {
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
          fill={
            borderColour
          }
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
          {formatArea(
            box.areaM2,
          )}
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
        solid
          ? undefined
          : "8 5"
      }
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}