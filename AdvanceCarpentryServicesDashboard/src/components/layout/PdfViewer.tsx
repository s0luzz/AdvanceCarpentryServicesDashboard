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

type CalibrationUnit = "mm" | "m";

type ViewerTool = "pan" | "calibrate" | "measure";

type CalibrationAxis = "primary" | "secondary";

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
const SCALE_STEP = 0.2;
const MIN_LINE_LENGTH = 0.002;
const MIN_AXIS_DETERMINANT = 0.1;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(Math.max(value, minimum), maximum);
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
  const measurementVector = getPageSpaceVector(
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

function formatCalibrationDistance(
  realDistanceMm: number,
) {
  if (
    realDistanceMm >= 1000 &&
    realDistanceMm % 1000 === 0
  ) {
    return `${realDistanceMm / 1000} m`;
  }

  return `${realDistanceMm.toLocaleString(
    "en-AU",
  )} mm`;
}

export default function PdfViewer({
  file,
  onClose,
}: PdfViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
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

  const isDistanceModalOpenRef =
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

  const [isLoading, setIsLoading] =
    useState(true);

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
    useState<Record<number, Calibration>>({});

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

  const currentCalibration =
    calibrations[pageNumber];

  const currentCalibrationDraft =
    calibrationDrafts[pageNumber] ?? {};

  const currentMeasurements = useMemo(
    () =>
      measurements.filter(
        (measurement) =>
          measurement.pageNumber === pageNumber,
      ),
    [measurements, pageNumber],
  );

  const currentMeasurementTotalMm = useMemo(
    () =>
      currentMeasurements.reduce(
        (total, measurement) =>
          total + measurement.distanceMm,
        0,
      ),
    [currentMeasurements],
  );

  const allPagesMeasurementTotalMm = useMemo(
    () =>
      measurements.reduce(
        (total, measurement) =>
          total + measurement.distanceMm,
        0,
      ),
    [measurements],
  );

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
    isDistanceModalOpenRef.current =
      isDistanceModalOpen;
  }, [isDistanceModalOpen]);

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

    setIsLoading(true);
    setIsPanning(false);

    setActiveTool("pan");
    activeToolRef.current = "pan";

    setCalibrationAxis("primary");
    setCalibrationStart(null);
    setCalibrationEnd(null);

    setCalibrationDrafts({});
    setCalibrations({});

    setMeasurementStart(null);
    setMeasurementEnd(null);
    setMeasurements([]);

    setIsDistanceModalOpen(false);
    setDistanceInput("");
    setDistanceUnit("mm");

    setViewerError("");

    dragStartRef.current = null;
  }, [file]);

  useEffect(() => {
    setActiveTool("pan");
    activeToolRef.current = "pan";

    setCalibrationAxis("primary");
    setCalibrationStart(null);
    setCalibrationEnd(null);

    setMeasurementStart(null);
    setMeasurementEnd(null);

    setIsDistanceModalOpen(false);
    setDistanceInput("");
    setViewerError("");

    const nextPan = {
      x: 0,
      y: 0,
    };

    setPan(nextPan);
    panRef.current = nextPan;

    dragStartRef.current = null;
    setIsPanning(false);
  }, [pageNumber]);

  useEffect(() => {
    function handleMouseMove(
      event: globalThis.MouseEvent,
    ) {
      const dragStart = dragStartRef.current;

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

    function handleNativeWheel(
      event: globalThis.WheelEvent,
    ) {
      event.preventDefault();
      event.stopPropagation();

      if (isDistanceModalOpenRef.current) {
        return;
      }

      const viewportBounds =
        (viewport as HTMLElement).getBoundingClientRect();

      const cursorX =
        event.clientX - viewportBounds.left;

      const cursorY =
        event.clientY - viewportBounds.top;

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

      const currentPan = panRef.current;

      const centredCursorX =
        cursorX -
        viewportBounds.width / 2;

      const centredCursorY =
        cursorY -
        viewportBounds.height / 2;

      const nextPan = {
        x:
          centredCursorX -
          (centredCursorX -
            currentPan.x) *
            ratio,

        y:
          centredCursorY -
          (centredCursorY -
            currentPan.y) *
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
      handleNativeWheel,
      {
        passive: false,
      },
    );

    return () => {
      viewport.removeEventListener(
        "wheel",
        handleNativeWheel,
      );
    };
  }, []);

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

  function updatePan(nextPan: PanPosition) {
    panRef.current = nextPan;
    setPan(nextPan);
  }

  function updateScale(nextScale: number) {
    scaleRef.current = nextScale;
    setScale(nextScale);
  }

  function applyButtonZoom(nextScale: number) {
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
      Number(
        (
          currentScale + SCALE_STEP
        ).toFixed(2),
      ),
    );
  }

  function zoomOut() {
    const currentScale =
      pageWidth ? 1 : scale;

    applyButtonZoom(
      Number(
        (
          currentScale - SCALE_STEP
        ).toFixed(2),
      ),
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

  function startCalibration() {
    setViewerError("");

    setCalibrationAxis("primary");
    setCalibrationStart(null);
    setCalibrationEnd(null);

    setMeasurementStart(null);
    setMeasurementEnd(null);

    setCalibrationDrafts((current) => ({
      ...current,
      [pageNumber]: {},
    }));

    setActiveTool("calibrate");
    activeToolRef.current = "calibrate";
  }

  function selectTool(tool: ViewerTool) {
    dragStartRef.current = null;

    setIsPanning(false);
    setViewerError("");

    setCalibrationStart(null);
    setCalibrationEnd(null);

    setMeasurementStart(null);
    setMeasurementEnd(null);

    if (tool === "calibrate") {
      startCalibration();
      return;
    }

    if (
      tool === "measure" &&
      !currentCalibration
    ) {
      setViewerError(
        "Complete both scale directions before measuring.",
      );

      setActiveTool("pan");
      activeToolRef.current = "pan";
      return;
    }

    setActiveTool(tool);
    activeToolRef.current = tool;
  }

  function handlePanStart(
    event: ReactMouseEvent<HTMLDivElement>,
  ) {
    if (
      activeToolRef.current !== "pan" ||
      isDistanceModalOpenRef.current ||
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

  function previousPage() {
    setPageNumber((current) =>
      Math.max(current - 1, 1),
    );
  }

  function nextPage() {
    setPageNumber((current) =>
      Math.min(
        current + 1,
        numberOfPages,
      ),
    );
  }

  function getRelativePoint(
    event: ReactMouseEvent<SVGSVGElement>,
  ): Point | null {
    const pageBounds =
      pageWrapperRef.current?.getBoundingClientRect();

    if (
      !pageBounds ||
      pageBounds.width === 0 ||
      pageBounds.height === 0
    ) {
      return null;
    }

    return {
      x: clamp(
        (event.clientX -
          pageBounds.left) /
          pageBounds.width,
        0,
        1,
      ),

      y: clamp(
        (event.clientY -
          pageBounds.top) /
          pageBounds.height,
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

    if (activeTool === "measure") {
      handleMeasurementPoint(point);
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
        "The calibration line is too short. Select two points further apart.",
      );
      return;
    }

    if (
      calibrationAxis === "secondary" &&
      currentCalibrationDraft.primaryAxis
    ) {
      const proposedUnitVector =
        normaliseVector(vector);

      const angleDifference =
        calculateAxisAngleDifference(
          currentCalibrationDraft.primaryAxis
            .unitVector,
          proposedUnitVector,
        );

      if (angleDifference < 20) {
        setViewerError(
          "The second calibration direction is too close to the first. Select a dimension running in the other building direction.",
        );
        return;
      }
    }

    setCalibrationEnd(point);
    setViewerError("");
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

    const axisCalibration: AxisCalibration = {
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

    if (calibrationAxis === "primary") {
      setCalibrationDrafts((current) => ({
        ...current,

        [pageNumber]: {
          primaryAxis: axisCalibration,
        },
      }));

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
        "The first calibration direction is missing. Start the calibration again.",
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
        "The two calibration directions are too similar. Select a second line running in the other building direction.",
      );
      return;
    }

    const completedCalibration: Calibration = {
      pageNumber,
      primaryAxis,
      secondaryAxis: axisCalibration,
    };

    setCalibrations((current) => ({
      ...current,
      [pageNumber]:
        completedCalibration,
    }));

    setCalibrationDrafts((current) => ({
      ...current,

      [pageNumber]: {
        primaryAxis,
        secondaryAxis:
          axisCalibration,
      },
    }));

    setCalibrationStart(null);
    setCalibrationEnd(null);

    setIsDistanceModalOpen(false);
    setDistanceInput("");
    setViewerError("");

    setActiveTool("pan");
    activeToolRef.current = "pan";
  }

  function chooseCalibrationPointsAgain() {
    setIsDistanceModalOpen(false);
    setCalibrationEnd(null);
    setDistanceInput("");
    setViewerError("");
  }

  function cancelCalibration() {
    setIsDistanceModalOpen(false);
    setDistanceInput("");

    setCalibrationAxis("primary");
    setCalibrationStart(null);
    setCalibrationEnd(null);

    setCalibrationDrafts((current) => {
      const nextDrafts = {
        ...current,
      };

      delete nextDrafts[pageNumber];

      return nextDrafts;
    });

    setActiveTool("pan");
    activeToolRef.current = "pan";

    setViewerError("");
  }

  function resetCurrentCalibration() {
    setCalibrations((current) => {
      const nextCalibrations = {
        ...current,
      };

      delete nextCalibrations[
        pageNumber
      ];

      return nextCalibrations;
    });

    setCalibrationDrafts((current) => {
      const nextDrafts = {
        ...current,
      };

      delete nextDrafts[pageNumber];

      return nextDrafts;
    });

    setMeasurements((current) =>
      current.filter(
        (measurement) =>
          measurement.pageNumber !==
          pageNumber,
      ),
    );

    setCalibrationAxis("primary");
    setCalibrationStart(null);
    setCalibrationEnd(null);

    setMeasurementStart(null);
    setMeasurementEnd(null);

    setActiveTool("pan");
    activeToolRef.current = "pan";

    setViewerError("");
  }

  function handleMeasurementPoint(
    point: Point,
  ) {
    if (!currentCalibration) {
      setViewerError(
        "Complete both scale directions before measuring.",
      );

      setActiveTool("pan");
      activeToolRef.current = "pan";
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

    const measurementVector =
      getPageSpaceVector(
        measurementStart,
        point,
        pageAspectRatio,
      );

    if (
      getVectorLength(
        measurementVector,
      ) < MIN_LINE_LENGTH
    ) {
      setViewerError(
        "The measurement line is too short. Select two points further apart.",
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

    if (distanceMm === null) {
      setViewerError(
        "The two calibration directions are invalid. Reset the scale and select two different building directions.",
      );
      return;
    }

    const measurement: Measurement = {
      id: createId(),
      pageNumber,
      start: measurementStart,
      end: point,
      distanceMm,
    };

    setMeasurements((current) => [
      ...current,
      measurement,
    ]);

    setMeasurementStart(null);
    setMeasurementEnd(null);
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
      activeTool === "measure" &&
      measurementStart
    ) {
      setMeasurementEnd(point);
    }
  }

  function undoLastMeasurement() {
    setMeasurements((current) => {
      const currentPageIndexes =
        current
          .map(
            (
              measurement,
              index,
            ) => ({
              measurement,
              index,
            }),
          )
          .filter(
            ({ measurement }) =>
              measurement.pageNumber ===
              pageNumber,
          );

      const lastMeasurement =
        currentPageIndexes[
          currentPageIndexes.length - 1
        ];

      if (!lastMeasurement) {
        return current;
      }

      return current.filter(
        (_, index) =>
          index !==
          lastMeasurement.index,
      );
    });

    setMeasurementStart(null);
    setMeasurementEnd(null);
  }

  function deleteMeasurement(
    measurementId: string,
  ) {
    setMeasurements((current) =>
      current.filter(
        (measurement) =>
          measurement.id !==
          measurementId,
      ),
    );
  }

  function clearCurrentMeasurements() {
    setMeasurements((current) =>
      current.filter(
        (measurement) =>
          measurement.pageNumber !==
          pageNumber,
      ),
    );

    setMeasurementStart(null);
    setMeasurementEnd(null);
  }

  const primaryAxisToDisplay =
    activeTool === "calibrate"
      ? currentCalibrationDraft.primaryAxis
      : currentCalibration?.primaryAxis;

  const secondaryAxisToDisplay =
    activeTool === "calibrate"
      ? currentCalibrationDraft.secondaryAxis
      : currentCalibration?.secondaryAxis;

  const displayedScale =
    pageWidth ? 1 : scale;

  const interactiveOverlay =
    activeTool === "calibrate" ||
    activeTool === "measure";

  const calibrationInstruction =
    calibrationAxis === "primary"
      ? calibrationStart
        ? "Click the second point of the first known dimension."
        : "Select the first known building direction."
      : calibrationStart
        ? "Click the second point of the perpendicular dimension."
        : "Select a known dimension running in the other building direction.";

  return (
    <div className="flex h-[calc(100vh-2rem)] min-h-[600px] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
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
            PDF Viewer
          </span>

          {currentCalibration && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Two-axis scale set
            </span>
          )}

          {activeTool === "calibrate" && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              {calibrationAxis === "primary"
                ? "Step 1 of 2"
                : "Step 2 of 2"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={previousPage}
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
            onClick={nextPage}
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
                  scale * 100,
                )}%`}
          </span>

          <button
            type="button"
            onClick={zoomIn}
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
          onClick={startCalibration}
          disabled={isLoading}
          className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
            activeTool ===
            "calibrate"
              ? "bg-amber-500 text-white"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {currentCalibration
            ? "Recalibrate"
            : "Set Scale"}
        </button>

        <button
          type="button"
          onClick={() =>
            selectTool("measure")
          }
          disabled={
            isLoading ||
            !currentCalibration
          }
          className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
            activeTool === "measure"
              ? "bg-blue-600 text-white"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Measure
        </button>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={
            undoLastMeasurement
          }
          disabled={
            currentMeasurements.length ===
            0
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Undo
        </button>

        <button
          type="button"
          onClick={
            clearCurrentMeasurements
          }
          disabled={
            currentMeasurements.length ===
            0
          }
          className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear Measurements
        </button>

        {activeTool === "calibrate" && (
          <button
            type="button"
            onClick={cancelCalibration}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel Scale
          </button>
        )}

        {currentCalibration && (
          <button
            type="button"
            onClick={
              resetCurrentCalibration
            }
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            Reset Scale
          </button>
        )}

        <div className="ml-auto text-sm text-slate-600">
          {activeTool === "pan" &&
            "Drag the plan to move around."}

          {activeTool === "calibrate" &&
            calibrationInstruction}

          {activeTool ===
            "measure" &&
            !measurementStart &&
            "Click the start of the measurement."}

          {activeTool ===
            "measure" &&
            measurementStart &&
            "Click the end of the measurement."}
        </div>
      </div>

      <div className="relative z-40 grid shrink-0 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-blue-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Page Total
          </p>

          <p className="mt-1 text-2xl font-bold text-blue-700">
            {formatTotalDistance(
              currentMeasurementTotalMm,
            )}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {currentMeasurements.length} measurement
            {currentMeasurements.length === 1
              ? ""
              : "s"}{" "}
            on page {pageNumber}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            All Pages Total
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-800">
            {formatTotalDistance(
              allPagesMeasurementTotalMm,
            )}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {measurements.length} total measurement
            {measurements.length === 1
              ? ""
              : "s"}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Scale Status
          </p>

          <p className="mt-1 text-base font-semibold text-slate-800">
            {currentCalibration
              ? "Calibrated"
              : "Not calibrated"}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {currentCalibration
              ? "Two-axis scale active"
              : "Set both axes to measure"}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current Page
          </p>

          <p className="mt-1 text-base font-semibold text-slate-800">
            Page {pageNumber}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {numberOfPages || 0} page
            {numberOfPages === 1
              ? ""
              : "s"}{" "}
            in document
          </p>
        </div>
      </div>

      {currentCalibration && (
        <div className="relative z-40 flex shrink-0 flex-wrap gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
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

      {viewerError && (
        <div className="relative z-40 shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-medium text-red-700">
          {viewerError}
        </div>
      )}

      <main
        ref={viewportRef}
        onMouseDown={handlePanStart}
        className={`relative min-h-0 flex-1 touch-none overflow-hidden overscroll-none bg-slate-200 ${
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
                setIsLoading(false);
              }}
              onLoadError={(
                error,
              ) => {
                console.error(
                  "Unable to load PDF:",
                  error,
                );

                setIsLoading(false);
              }}
            >
              <div
                ref={pageWrapperRef}
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
                  width={pageWidth}
                  renderAnnotationLayer={
                    false
                  }
                  renderTextLayer={
                    false
                  }
                  loading={
                    <div className="rounded-lg bg-white px-8 py-6 shadow-sm">
                      Loading page…
                    </div>
                  }
                />

                <svg
                  className={`absolute inset-0 z-30 h-full w-full ${
                    interactiveOverlay
                      ? "pointer-events-auto cursor-crosshair"
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
                            strokeWidth="3"
                            pointerEvents="none"
                          />

                          <circle
                            cx={`${measurement.start.x * 100}%`}
                            cy={`${measurement.start.y * 100}%`}
                            r="4"
                            fill="#2563eb"
                            stroke="#ffffff"
                            strokeWidth="2"
                            pointerEvents="none"
                          />

                          <circle
                            cx={`${measurement.end.x * 100}%`}
                            cy={`${measurement.end.y * 100}%`}
                            r="4"
                            fill="#2563eb"
                            stroke="#ffffff"
                            strokeWidth="2"
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
                              width="88"
                              height="26"
                              rx="6"
                              fill="#2563eb"
                              transform="translate(-44 -13)"
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
                    <>
                      <line
                        x1={`${primaryAxisToDisplay.start.x * 100}%`}
                        y1={`${primaryAxisToDisplay.start.y * 100}%`}
                        x2={`${primaryAxisToDisplay.end.x * 100}%`}
                        y2={`${primaryAxisToDisplay.end.y * 100}%`}
                        stroke="#d97706"
                        strokeWidth="4"
                        strokeDasharray="9 5"
                        pointerEvents="none"
                      />

                      <circle
                        cx={`${primaryAxisToDisplay.start.x * 100}%`}
                        cy={`${primaryAxisToDisplay.start.y * 100}%`}
                        r="5"
                        fill="#d97706"
                        stroke="#ffffff"
                        strokeWidth="2"
                        pointerEvents="none"
                      />

                      <circle
                        cx={`${primaryAxisToDisplay.end.x * 100}%`}
                        cy={`${primaryAxisToDisplay.end.y * 100}%`}
                        r="5"
                        fill="#d97706"
                        stroke="#ffffff"
                        strokeWidth="2"
                        pointerEvents="none"
                      />
                    </>
                  )}

                  {secondaryAxisToDisplay && (
                    <>
                      <line
                        x1={`${secondaryAxisToDisplay.start.x * 100}%`}
                        y1={`${secondaryAxisToDisplay.start.y * 100}%`}
                        x2={`${secondaryAxisToDisplay.end.x * 100}%`}
                        y2={`${secondaryAxisToDisplay.end.y * 100}%`}
                        stroke="#7c3aed"
                        strokeWidth="4"
                        strokeDasharray="9 5"
                        pointerEvents="none"
                      />

                      <circle
                        cx={`${secondaryAxisToDisplay.start.x * 100}%`}
                        cy={`${secondaryAxisToDisplay.start.y * 100}%`}
                        r="5"
                        fill="#7c3aed"
                        stroke="#ffffff"
                        strokeWidth="2"
                        pointerEvents="none"
                      />

                      <circle
                        cx={`${secondaryAxisToDisplay.end.x * 100}%`}
                        cy={`${secondaryAxisToDisplay.end.y * 100}%`}
                        r="5"
                        fill="#7c3aed"
                        stroke="#ffffff"
                        strokeWidth="2"
                        pointerEvents="none"
                      />
                    </>
                  )}

                  {activeTool ===
                    "calibrate" &&
                    calibrationStart &&
                    calibrationEnd && (
                      <>
                        <line
                          x1={`${calibrationStart.x * 100}%`}
                          y1={`${calibrationStart.y * 100}%`}
                          x2={`${calibrationEnd.x * 100}%`}
                          y2={`${calibrationEnd.y * 100}%`}
                          stroke={
                            calibrationAxis ===
                            "primary"
                              ? "#d97706"
                              : "#7c3aed"
                          }
                          strokeWidth="4"
                          strokeDasharray="8 5"
                          pointerEvents="none"
                        />

                        <circle
                          cx={`${calibrationStart.x * 100}%`}
                          cy={`${calibrationStart.y * 100}%`}
                          r="5"
                          fill={
                            calibrationAxis ===
                            "primary"
                              ? "#d97706"
                              : "#7c3aed"
                          }
                          stroke="#ffffff"
                          strokeWidth="2"
                          pointerEvents="none"
                        />
                      </>
                    )}

                  {measurementStart &&
                    measurementEnd && (
                      <>
                        <line
                          x1={`${measurementStart.x * 100}%`}
                          y1={`${measurementStart.y * 100}%`}
                          x2={`${measurementEnd.x * 100}%`}
                          y2={`${measurementEnd.y * 100}%`}
                          stroke="#2563eb"
                          strokeWidth="3"
                          strokeDasharray="7 5"
                          pointerEvents="none"
                        />

                        <circle
                          cx={`${measurementStart.x * 100}%`}
                          cy={`${measurementStart.y * 100}%`}
                          r="5"
                          fill="#2563eb"
                          stroke="#ffffff"
                          strokeWidth="2"
                          pointerEvents="none"
                        />
                      </>
                    )}
                </svg>
              </div>
            </Document>
          </div>
        </div>
      </main>

      {isDistanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">
              {calibrationAxis ===
              "primary"
                ? "Enter First Axis Distance"
                : "Enter Second Axis Distance"}
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              {calibrationAxis ===
              "primary"
                ? "Enter the real distance of the first known building dimension."
                : "Enter the real distance of the known dimension running in the other building direction."}
            </p>

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
                    event.target
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
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <select
                value={distanceUnit}
                onChange={(
                  event,
                ) =>
                  setDistanceUnit(
                    event.target
                      .value as CalibrationUnit,
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
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
                onClick={
                  chooseCalibrationPointsAgain
                }
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Choose Points Again
              </button>

              <button
                type="button"
                onClick={
                  saveCalibrationAxis
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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