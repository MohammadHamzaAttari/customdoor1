// client/src/components/door/Door2D.tsx
import {
  useDoorConfig,
  HINGE_CUP_DIAMETER_MM,
  HINGE_CENTER_OFFSET_MM,
  DoorConfig,
} from "@/lib/stores/useDoorConfig";
import {
  getOuterEdgesAtY,
  getInnerEdgesAtY,
  getHoleSections,
  createRoofPoints,
  HoleSection,
  RoofPoint,
} from "@/lib/doorUtils";

/** Safe toFixed — never crashes on undefined/NaN/null */
function safeFix(val: unknown, decimals: number = 0): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(decimals);
}

/** Safe number — always returns a finite number */
function safeNum(val: unknown, fallback: number = 0): number {
  if (val === undefined || val === null) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

interface Door2DProps {
  face?: "front" | "back";
  configOverride?: Partial<DoorConfig>;
}

export function Door2D({ face = "front", configOverride }: Door2DProps) {
  const storeConfig = useDoorConfig();
  const config = configOverride ? { ...storeConfig, ...configOverride } : storeConfig;

  const {
    width: rawWidth,
    height: rawHeight,
    panelType,
    panelCount,
    panelOrientation,
    angledLeft,
    angledRight,
    leftTriangleCutoutWidth: rawLCW,
    leftTriangleCutoutHeight: rawLCH,
    rightTriangleCutoutWidth: rawRCW,
    rightTriangleCutoutHeight: rawRCH,
    leftStile: rawLeftStile,
    rightStile: rawRightStile,
    bottomRail: rawBottomRail,
    topRail: rawTopRail,
    midRailsEnabled,
    midRails,
    showDimensions,
    hingeDrilling,
    hinges,
    customBorders,
    borderWidth: rawBorderWidth,
    leftAngleDegrees: rawLeftAngleDeg,
    rightAngleDegrees: rawRightAngleDeg,
    rebateWidthMm: rawRebateWidth,
    leftAngledRailWidth: rawLeftAngledRailW,
    rightAngledRailWidth: rawRightAngledRailW,
    rearCornerRadiusMm: rawRearCornerRadius,
    angleValidationIssues,
  } = config;

  // Ensure every number is safe
  const width = safeNum(rawWidth, 600);
  const height = safeNum(rawHeight, 720);
  const leftTriangleCutoutWidth = safeNum(rawLCW, 0);
  const leftTriangleCutoutHeight = safeNum(rawLCH, 0);
  const rightTriangleCutoutWidth = safeNum(rawRCW, 0);
  const rightTriangleCutoutHeight = safeNum(rawRCH, 0);
  const borderWidth = safeNum(rawBorderWidth, 90);
  const leftStile = safeNum(rawLeftStile, 90);
  const rightStile = safeNum(rawRightStile, 90);
  const topRail = safeNum(rawTopRail, 90);
  const bottomRail = safeNum(rawBottomRail, 90);
  const leftAngleDegrees = safeNum(rawLeftAngleDeg, 0);
  const rightAngleDegrees = safeNum(rawRightAngleDeg, 0);
  const rebateWidthMm = safeNum(rawRebateWidth, 11);
  const leftAngledRailWidth = safeNum(rawLeftAngledRailW, 90);
  const rightAngledRailWidth = safeNum(rawRightAngledRailW, 90);
  const rearCornerRadiusMm = safeNum(rawRearCornerRadius, 2.5);

  const isBack = face === "back";

  const effectiveLeftStile = customBorders ? leftStile : borderWidth;
  const effectiveRightStile = customBorders ? rightStile : borderWidth;
  const effectiveTopRail = customBorders ? topRail : borderWidth;
  const effectiveBottomRail = customBorders ? bottomRail : borderWidth;

  const padding = 100;
  const maxWidth = 520;
  const maxHeight = 700;

  const scaleX = (maxWidth - padding * 2) / (width || 600);
  const scaleY = (maxHeight - padding * 2) / (height || 720);
  const scale =
    isNaN(scaleX) || isNaN(scaleY) || !isFinite(scaleX) || !isFinite(scaleY)
      ? 0.5
      : Math.min(scaleX, scaleY);

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  const offsetX = (maxWidth - scaledWidth) / 2;
  const offsetY = (maxHeight - scaledHeight) / 2;

  const isMDFModel = panelType === "MELAMINE_18MM";

  const strokeColor = isMDFModel ? "#5d4037" : "#44403c";
  const fillColor = isMDFModel ? "#d7ccc8" : "#fafaf9";
  const panelFillColor = isMDFModel ? "#c19a6b" : "#e7e5e4";
  const railFillColor = isMDFModel ? "#d7ccc8" : "#fafaf9";
  const dimensionColor = strokeColor;
  const hingeFillColor = isMDFModel ? "#bcaaa4" : "#a1a1aa";
  const hingeStrokeColor = strokeColor;
  const borderDimColor = isMDFModel ? "#1e40af" : "#3b82f6";

  const issues = angleValidationIssues ?? [];
  const hasErrors = issues.some((i) => i.type === "error");
  const outlineStrokeColor = hasErrors ? "#ef4444" : strokeColor;
  const outlineStrokeWidth = hasErrors ? 3 : 2;

  const mirrorTransform = isBack
    ? `translate(${maxWidth}, 0) scale(-1, 1)`
    : undefined;

  const toX = (x: number) => offsetX + safeNum(x) * scale;
  const toY = (y: number) => offsetY + (height - safeNum(y)) * scale;

  // Safe geometry check
  const isGeometryValid = () => {
    if (width <= 0 || height <= 0) return false;
    if (angledLeft) {
      if (leftTriangleCutoutWidth > width) return false;
      if (leftTriangleCutoutHeight > height) return false;
    }
    if (angledRight) {
      if (rightTriangleCutoutWidth > width) return false;
      if (rightTriangleCutoutHeight > height) return false;
    }
    if (angledLeft && angledRight) {
      if (leftTriangleCutoutWidth + rightTriangleCutoutWidth > width) return false;
    }
    return true;
  };

  if (!isGeometryValid()) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white p-4">
        <div className="text-center space-y-2">
          <div className="text-red-500 text-lg font-bold">⚠️ Invalid Geometry</div>
          <p className="text-sm text-gray-600 max-w-xs">
            The current door configuration has invalid dimensions. Please adjust
            the angled corner settings in the sidebar.
          </p>
          {issues
            .filter((i) => i.type === "error")
            .map((issue, idx) => (
              <p key={idx} className="text-xs text-red-600">
                • {issue.message}
              </p>
            ))}
        </div>
      </div>
    );
  }

  const getDoorOutline = () => {
    const points: string[] = [];

    points.push(`${toX(0)},${toY(0)}`);

    if (angledLeft) {
      points.push(`${toX(0)},${toY(height - leftTriangleCutoutHeight)}`);
      points.push(`${toX(leftTriangleCutoutWidth)},${toY(height)}`);
    } else {
      points.push(`${toX(0)},${toY(height)}`);
    }

    if (angledRight) {
      points.push(`${toX(width - rightTriangleCutoutWidth)},${toY(height)}`);
      points.push(`${toX(width)},${toY(height - rightTriangleCutoutHeight)}`);
    } else {
      points.push(`${toX(width)},${toY(height)}`);
    }

    points.push(`${toX(width)},${toY(0)}`);

    return points.join(" ");
  };

  // Utilities converted to meters
  const w = width / 1000;
  const h = height / 1000;
  const ls = effectiveLeftStile / 1000;
  const rs = effectiveRightStile / 1000;
  const ts = effectiveTopRail / 1000;
  const bs = effectiveBottomRail / 1000;
  const arwL = leftAngledRailWidth / 1000;
  const arwR = rightAngledRailWidth / 1000;
  const lcw = leftTriangleCutoutWidth / 1000;
  const lch = leftTriangleCutoutHeight / 1000;
  const rcw = rightTriangleCutoutWidth / 1000;
  const rch = rightTriangleCutoutHeight / 1000;

  const holeSections = getHoleSections(
    midRailsEnabled ? midRails : [],
    h,
    bs,
    ts,
    midRailsEnabled ? (panelCount || 1) : 1
  );

  const renderFrameLines = () => {
    if (panelType === "NONE") return null;

    const lines: JSX.Element[] = [];
    const frameStroke = "#78716c";
    const frameStrokeWidth = 0.5;
    const frameDash = "4 2";

    const visibleFrameStyle = isBack ? { strokeDasharray: frameDash } : {};
    const scaledInnerRadius = rearCornerRadiusMm * scale;

    if (!angledLeft && !angledRight) {
      const vx = toX(effectiveLeftStile);
      const vy = toY(height - effectiveTopRail);
      const vw = toX(width - effectiveRightStile) - toX(effectiveLeftStile);
      const vh = toY(effectiveBottomRail) - toY(height - effectiveTopRail);
      lines.push(
        <rect
          key="visible-frame-rect"
          x={vx} y={vy} width={Math.max(0, vw)} height={Math.max(0, vh)}
          rx={scaledInnerRadius} ry={scaledInnerRadius}
          fill="none" stroke={frameStroke} strokeWidth={frameStrokeWidth}
          {...visibleFrameStyle}
        />
      );
    } else {
      lines.push(
        <line key="left-stile-vis"
          x1={toX(effectiveLeftStile)} y1={toY(effectiveBottomRail)}
          x2={toX(effectiveLeftStile)} y2={toY(height - effectiveTopRail)}
          stroke={frameStroke} strokeWidth={frameStrokeWidth} {...visibleFrameStyle}
        />
      );
      lines.push(
        <line key="right-stile-vis"
          x1={toX(width - effectiveRightStile)} y1={toY(effectiveBottomRail)}
          x2={toX(width - effectiveRightStile)} y2={toY(height - effectiveTopRail)}
          stroke={frameStroke} strokeWidth={frameStrokeWidth} {...visibleFrameStyle}
        />
      );
      lines.push(
        <line key="bottom-rail-vis"
          x1={toX(effectiveLeftStile)} y1={toY(effectiveBottomRail)}
          x2={toX(width - effectiveRightStile)} y2={toY(effectiveBottomRail)}
          stroke={frameStroke} strokeWidth={frameStrokeWidth} {...visibleFrameStyle}
        />
      );
      const visibleRoof = createRoofPoints(
        w / 2 - rs, -w / 2 + ls, ts, arwL, arwR, w, h,
        angledLeft, angledRight, lcw, lch, rcw, rch
      );
      const vPoints = visibleRoof.map(p => `${toX((p.x + w / 2) * 1000)},${toY((p.y + h / 2) * 1000)}`).join(" ");
      lines.push(
        <polyline key="top-rail-vis-angled"
          points={vPoints}
          fill="none" stroke={frameStroke} strokeWidth={frameStrokeWidth} {...visibleFrameStyle}
        />
      );
    }

    const rebateStyle = isBack ? {} : { strokeDasharray: frameDash };
    const rL = effectiveLeftStile - rebateWidthMm;
    const rR = width - (effectiveRightStile - rebateWidthMm);
    const rB = effectiveBottomRail - rebateWidthMm;
    const rT = height - (effectiveTopRail - rebateWidthMm);
    const rStroke = isBack ? "#78716c" : "#a8a29e";

    if (!angledLeft && !angledRight) {
      const rx = toX(rL);
      const ry2 = toY(rT);
      const rw = toX(rR) - toX(rL);
      const rh = toY(rB) - toY(rT);
      lines.push(
        <rect key="rebate-frame-rect"
          x={rx} y={ry2} width={Math.max(0, rw)} height={Math.max(0, rh)}
          rx={scaledInnerRadius} ry={scaledInnerRadius}
          fill="none" stroke={rStroke} strokeWidth={frameStrokeWidth}
          {...rebateStyle}
        />
      );
    } else {
      lines.push(
        <line key="left-stile-rebate"
          x1={toX(rL)} y1={toY(rB)} x2={toX(rL)} y2={toY(rT)}
          stroke={rStroke} strokeWidth={frameStrokeWidth} {...rebateStyle}
        />
      );
      lines.push(
        <line key="right-stile-rebate"
          x1={toX(rR)} y1={toY(rB)} x2={toX(rR)} y2={toY(rT)}
          stroke={rStroke} strokeWidth={frameStrokeWidth} {...rebateStyle}
        />
      );
      lines.push(
        <line key="bottom-rail-rebate"
          x1={toX(rL)} y1={toY(rB)} x2={toX(rR)} y2={toY(rB)}
          stroke={rStroke} strokeWidth={frameStrokeWidth} {...rebateStyle}
        />
      );
      const rM = rebateWidthMm / 1000;
      const rebateRoof = createRoofPoints(
        w / 2 - (rs - rM), -w / 2 + (ls - rM), ts - rM, arwL - rM, arwR - rM, w, h,
        angledLeft, angledRight, lcw, lch, rcw, rch
      );
      const rPoints = rebateRoof.map(p => `${toX((p.x + w / 2) * 1000)},${toY((p.y + h / 2) * 1000)}`).join(" ");
      lines.push(
        <polyline key="top-rail-rebate-angled"
          points={rPoints}
          fill="none" stroke={rStroke} strokeWidth={frameStrokeWidth} {...rebateStyle}
        />
      );
    }

    return lines;
  };

  const renderMidRails = () => {
    if (!midRailsEnabled || midRails.length === 0) return null;

    // rM adjusts inner edges for rebate offset on back view (X-axis only)
    const rM = isBack ? -(rebateWidthMm / 1000) : 0;

    return midRails.map((rail) => {
      const railBottom = safeNum(rail.positionFromBottom, 0) / 1000;
      const railTop = railBottom + safeNum(rail.dimension, 70) / 1000;
      // Y positions are the same for front and back — only X edges differ
      const yBottomM = -h / 2 + railBottom;
      const yTopM = -h / 2 + railTop;

      const isInAngledZone =
        (angledLeft && yTopM > h / 2 - lch) ||
        (angledRight && yTopM > h / 2 - rch);

      const transitionY_L = h / 2 - lch;
      const transitionY_R = h / 2 - rch;

      const steps = 4;
      const ySamples: number[] = [];
      for (let i = 0; i <= steps; i++) {
        ySamples.push(yBottomM + (yTopM - yBottomM) * (i / steps));
      }
      if (angledLeft && transitionY_L > yBottomM && transitionY_L < yTopM) ySamples.push(transitionY_L);
      if (angledRight && transitionY_R > yBottomM && transitionY_R < yTopM) ySamples.push(transitionY_R);

      ySamples.sort((a, b) => a - b);
      const uniqueYSamples = Array.from(new Set(ySamples));

      const points: string[] = [];
      uniqueYSamples.forEach(y => {
        const { leftInner: xL } = getInnerEdgesAtY(y, w, h, ls + rM, rs + rM, ts + rM, bs + rM, arwL + rM, arwR + rM, angledLeft, angledRight, lcw, lch, rcw, rch);
        points.push(`${toX((xL + w / 2) * 1000)},${toY((y + h / 2) * 1000)}`);
      });
      [...uniqueYSamples].reverse().forEach(y => {
        const { rightInner: xR } = getInnerEdgesAtY(y, w, h, ls + rM, rs + rM, ts + rM, bs + rM, arwL + rM, arwR + rM, angledLeft, angledRight, lcw, lch, rcw, rch);
        points.push(`${toX((xR + w / 2) * 1000)},${toY((y + h / 2) * 1000)}`);
      });

      return (
        <polygon
          key={rail.id}
          points={points.join(" ")}
          fill={railFillColor}
          stroke={"#78716c"}
          strokeWidth={0.5}
        />
      );
    });
  };

  const getPanelPoints = (sec: HoleSection, pPadM: number, rM: number) => {
    const pBottom = sec.bottom + rM + pPadM;
    const pTop = sec.top - rM - pPadM;
    if (pTop <= pBottom) return [];

    // 1. Get bottom limits (max bounds for this section)
    const { leftInner: bL, rightInner: bR } = getInnerEdgesAtY(pBottom, w, h, ls, rs, ts, bs, arwL, arwR, angledLeft, angledRight, lcw, lch, rcw, rch, pPadM + rM);
    
    // Panel collapsed horizontally
    if (bL >= bR - 0.001) return [];

    // 2. Get top profile 
    // Traces the upper boundary bounded by the bottom X-limits.
    const flatTopInset = h / 2 - pTop;
    const roof = createRoofPoints(bR, bL, flatTopInset, arwL + rM + pPadM, arwR + rM + pPadM, w, h, angledLeft, angledRight, lcw, lch, rcw, rch);

    const points: string[] = [];
    const addedPoints = new Set<string>();

    const addPoint = (x: number, y: number) => {
      // Clamp y strictly to prevent float inaccuracies from slipping below pBottom
      const clampedY = Math.max(y, pBottom);
      const ps = `${toX((x + w / 2) * 1000).toFixed(2)},${toY((clampedY + h / 2) * 1000).toFixed(2)}`;
      if (!addedPoints.has(ps)) {
        points.push(ps);
        addedPoints.add(ps);
      }
    };

    // 3. Assemble Polygon
    // Start at Bottom-Left
    addPoint(bL, pBottom);

    // Roof points (Left to Right)
    // createRoofPoints returns sorted descending (Right to Left), so we reverse it
    roof.slice().reverse().forEach(pt => {
      addPoint(pt.x, pt.y);
    });

    // End at Bottom-Right
    addPoint(bR, pBottom);

    return points;
  };

  const renderPanels = () => {
    if (panelType === "NONE" || holeSections.length === 0) return null;
    const pPadM = 0;
    const rM = isBack ? -(rebateWidthMm / 1000) : 0;

    return holeSections.map((sec, idx) => {
      const points = getPanelPoints(sec, pPadM, rM);
      if (points.length === 0) return null;

      const panelHeightMm = Math.round((sec.top - sec.bottom) * 1000);
      const textY = (sec.top + sec.bottom) / 2;

      return (
        <g key={`panel-group-${idx}`}>
          <polygon
            points={points.join(" ")}
            fill={panelFillColor}
            stroke="none"
          />
          {showDimensions && panelHeightMm > 30 && (
            <g transform={`translate(${toX(width / 2)}, ${toY((textY + h / 2) * 1000)})`}>
              <rect x={-28} y={-9} width={56} height={18} rx={9} fill="#dcfce7" stroke="#16a34a" strokeWidth={0.5} opacity={0.9} />
              <text
                transform={isBack ? "scale(-1, 1)" : undefined}
                textAnchor="middle" dominantBaseline="middle"
                fill="#16a34a" fontSize="11" fontFamily="Arial, sans-serif" fontWeight="700"
              >
                {panelHeightMm}mm
              </text>
            </g>
          )}
        </g>
      );
    });
  };

  const renderReededLines = () => {
    if (panelType !== "REEDED_19MM" || holeSections.length === 0) return null;

    const reedSpacingMm = 12;
    const reedStrokeWidth = 0.4;
    const pPadM = 0;
    const rM = isBack ? -(rebateWidthMm / 1000) : 0;
    const result: JSX.Element[] = [];

    holeSections.forEach((sec, secIdx) => {
      const pBottom = sec.bottom + rM + pPadM;
      const pTop = sec.top - rM - pPadM;
      if (pTop <= pBottom) return;

      const points = getPanelPoints(sec, pPadM, rM);
      if (points.length === 0) return;

      const { leftInner: liB, rightInner: riB } = getInnerEdgesAtY(pBottom, w, h, ls + rM, rs + rM, ts + rM, bs + rM, arwL + rM, arwR + rM, angledLeft, angledRight, lcw, lch, rcw, rch, pPadM);
      const leftMm = (liB + w / 2) * 1000;
      const rightMm = (riB + w / 2) * 1000;
      const spanMm = rightMm - leftMm;
      if (spanMm <= 0) return;

      const count = Math.max(2, Math.round(spanMm / reedSpacingMm));
      const step = spanMm / count;
      const clipId = `reed-clip-${secIdx}-${isBack ? "back" : "front"}`;

      const lines: JSX.Element[] = [];
      for (let i = 0; i <= count; i++) {
        const xMm = leftMm + step * i;
        lines.push(
          <line key={`reed-${secIdx}-${i}`}
            x1={toX(xMm)} y1={toY((pBottom + h / 2) * 1000)}
            x2={toX(xMm)} y2={toY((pTop + h / 2) * 1000 + 100)}
            stroke={strokeColor} strokeWidth={reedStrokeWidth} opacity={0.4}
          />
        );
      }

      result.push(
        <g key={`reed-group-${secIdx}`}>
          <defs>
            <clipPath id={clipId}>
              <polygon points={points.join(" ")} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>{lines}</g>
        </g>
      );
    });

    return result;
  };

  const renderHinges = () => {
    if (!hingeDrilling || hinges.length === 0) return null;
    const cupRadiusMm = HINGE_CUP_DIAMETER_MM / 2;
    const cupRadiusSvg = cupRadiusMm * scale;

    const topHinges = hinges.filter(h => h.reference === "TOP").sort((a, b) => a.positionMm - b.positionMm);
    const bottomHinges = hinges.filter(h => h.reference === "BOTTOM").sort((a, b) => a.positionMm - b.positionMm);

    const effectiveAngledLeft = isBack ? angledRight : angledLeft;
    const effectiveAngledRight = isBack ? angledLeft : angledRight;
    const effectiveLeftCutoutW = isBack ? rightTriangleCutoutWidth : leftTriangleCutoutWidth;
    const effectiveLeftCutoutH = isBack ? rightTriangleCutoutHeight : leftTriangleCutoutHeight;
    const effectiveRightCutoutW = isBack ? leftTriangleCutoutWidth : rightTriangleCutoutWidth;
    const effectiveRightCutoutH = isBack ? leftTriangleCutoutHeight : rightTriangleCutoutHeight;

    return hinges.map((hinge) => {
      const hingeSide = hinge.side;
      const effectiveSide = isBack ? (hingeSide === "LEFT" ? "RIGHT" : "LEFT") : hingeSide;
      let xCenter = effectiveSide === "LEFT" ? HINGE_CENTER_OFFSET_MM : width - HINGE_CENTER_OFFSET_MM;
      let angleCutoutH = 0;
      if (hinge.side === "LEFT" && angledLeft) {
        angleCutoutH = leftTriangleCutoutHeight;
      } else if (hinge.side === "RIGHT" && angledRight) {
        angleCutoutH = rightTriangleCutoutHeight;
      }

      const yCenter = hinge.reference === "BOTTOM"
        ? hinge.positionMm
        : (height - angleCutoutH) - hinge.positionMm;

      if (effectiveSide === "LEFT" && effectiveAngledLeft && effectiveLeftCutoutH > 0) {
        const heightFromTop = height - yCenter;
        if (heightFromTop < effectiveLeftCutoutH) {
          const edgeX = effectiveLeftCutoutW * (1 - heightFromTop / effectiveLeftCutoutH);
          xCenter = Math.max(xCenter, edgeX + cupRadiusMm + 2);
        }
      }
      if (effectiveSide === "RIGHT" && effectiveAngledRight && effectiveRightCutoutH > 0) {
        const heightFromTop = height - yCenter;
        if (heightFromTop < effectiveRightCutoutH) {
          const edgeX = width - effectiveRightCutoutW * (1 - heightFromTop / effectiveRightCutoutH);
          xCenter = Math.min(xCenter, edgeX - cupRadiusMm - 2);
        }
      }

      let label: string;
      if (hinge.reference === "TOP") {
        const idx = topHinges.indexOf(hinge) + 1;
        label = `T${idx}`;
      } else {
        const idx = bottomHinges.indexOf(hinge) + 1;
        label = `B${idx}`;
      }

      const hasIssue = issues.some(
        (i) =>
          (i.code === "HINGE_IN_LEFT_CUTOUT" || i.code === "HINGE_IN_RIGHT_CUTOUT") &&
          i.message.includes(`${hinge.positionMm}mm`) &&
          i.message.includes(hinge.reference.toLowerCase())
      );

      const baseStrokeCol = hasIssue ? "#ef4444" : isBack ? "#000" : "#9ca3af";
      const dashArray = hasIssue ? "none" : isBack ? "none" : "4 2";
      const hingeStrokeW = hasIssue ? 3 : isBack ? 3.5 : 1.5;

      return (
        <g key={`hinge-${hinge.id}`}>
          <circle cx={toX(xCenter)} cy={toY(yCenter)} r={cupRadiusSvg}
            fill={hasIssue ? "rgba(239, 68, 68, 0.1)" : "none"}
            stroke={baseStrokeCol} strokeWidth={hingeStrokeW} strokeDasharray={dashArray}
          />
          <line x1={toX(xCenter) - 4} y1={toY(yCenter)} x2={toX(xCenter) + 4} y2={toY(yCenter)} stroke={baseStrokeCol} strokeWidth={1} strokeDasharray={dashArray} />
          <line x1={toX(xCenter)} y1={toY(yCenter) - 4} x2={toX(xCenter)} y2={toY(yCenter) + 4} stroke={baseStrokeCol} strokeWidth={1} strokeDasharray={dashArray} />
          <text
            x={effectiveSide === "LEFT" ? toX(xCenter) - cupRadiusSvg - 16 : toX(xCenter) + cupRadiusSvg + 16}
            y={toY(yCenter) + 4}
            textAnchor={effectiveSide === "LEFT" ? "end" : "start"}
            fill={baseStrokeCol} fontSize="9" fontFamily="Arial, sans-serif" fontWeight="700"
          >
            {label} — {hinge.positionMm}mm{hasIssue ? " ⚠" : ""}
          </text>
        </g>
      );
    });
  };

  const renderLiveGeo = () => {
    if (!angledLeft && !angledRight) return null;

    const flatTopWidth = width
      - (angledLeft ? leftTriangleCutoutWidth : 0)
      - (angledRight ? rightTriangleCutoutWidth : 0);

    const flatTopStartX = angledLeft ? leftTriangleCutoutWidth : 0;
    const flatTopEndX   = angledRight ? (width - rightTriangleCutoutWidth) : width;
    const flatTopMidX   = (flatTopStartX + flatTopEndX) / 2;

    // SVG y-axis: toY(height) is the TOP of the door (small SVG y).
    // Go ABOVE the door with negative y offsets.
    const topEdgeSvgY  = toY(height);
    const tickTopSvgY  = topEdgeSvgY - 36;   // top of tick / bottom of pill
    const tickMidSvgY  = topEdgeSvgY - 20;   // horizontal dimension line
    const pillCenterSvgY = topEdgeSvgY - 54; // pill center

    const sx = toX(flatTopStartX);
    const ex = toX(flatTopEndX);
    const mx = toX(flatTopMidX);

    const isTooNarrow = flatTopWidth <= 0;
    const valueText = isTooNarrow ? "Peak" : `${safeFix(flatTopWidth, 1)}mm`;
    const subText   = isTooNarrow ? "Pointed" : null;
    const bgFill    = "#fff7ed";
    const border    = "#fdba74";
    const textColor = isTooNarrow ? "#ef4444" : "#9a3412";

    const pw = 76; const ph = subText ? 42 : 32;
    const px = mx - pw / 2;
    const py = pillCenterSvgY - ph / 2;

    return (
      <g>
        {/* Tick lines — drop from pill down to door top edge */}
        <line x1={sx} y1={topEdgeSvgY - 2} x2={sx} y2={tickTopSvgY} stroke="#f97316" strokeWidth={0.8} strokeDasharray="3 2" />
        <line x1={ex} y1={topEdgeSvgY - 2} x2={ex} y2={tickTopSvgY} stroke="#f97316" strokeWidth={0.8} strokeDasharray="3 2" />
        {/* Horizontal span line */}
        <line x1={sx} y1={tickMidSvgY} x2={ex} y2={tickMidSvgY} stroke="#f97316" strokeWidth={0.9} />
        {/* End nubs */}
        <line x1={sx} y1={tickMidSvgY - 4} x2={sx} y2={tickMidSvgY + 4} stroke="#f97316" strokeWidth={1.5} />
        <line x1={ex} y1={tickMidSvgY - 4} x2={ex} y2={tickMidSvgY + 4} stroke="#f97316" strokeWidth={1.5} />

        {/* Pill label */}
        <g transform={`translate(${px}, ${py})`}>
          <rect width={pw} height={ph} rx={10} fill={bgFill} stroke={border} strokeWidth={1.2} />
          <text x={pw / 2} y={12} textAnchor="middle" fill="#78716c" fontSize="8" fontWeight="700" letterSpacing="0.6">FLAT TOP</text>
          <text x={pw / 2} y={26} textAnchor="middle" fill={textColor} fontSize="13" fontWeight="900" fontFamily="Arial, sans-serif">{valueText}</text>
          {subText && <text x={pw / 2} y={38} textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="700">{subText}</text>}
        </g>
      </g>
    );
  };

  const renderHingeSideIndicator = () => {
    if (!hingeDrilling || hinges.length === 0) return null;
    const isLeft = hinges[0].side === "LEFT";
    const effectiveIsLeft = isBack ? !isLeft : isLeft;
    const arrowX = effectiveIsLeft ? toX(0) - 40 : toX(width) + 40;
    const midY = height / 2;
    return (
      <g>
        <text
          x={arrowX} y={toY(midY)} textAnchor="middle" dominantBaseline="middle"
          fill={hingeStrokeColor} fontSize="9" fontFamily="Arial, sans-serif" fontWeight="700" letterSpacing="1"
          transform={`rotate(-90, ${arrowX}, ${toY(midY)})`}
        >
          HINGE SIDE
        </text>
      </g>
    );
  };

  const renderDimensions = () => {
    if (!showDimensions) return null;
    const dimOffset = 65;
    const elements: JSX.Element[] = [];

    const tx = (x: number) => toX(isBack ? width - x : x);
    const anchorStart = isBack ? "end" : "start";
    const anchorEnd = isBack ? "start" : "end";

    const formatDim = (val: unknown): string => {
      const n = safeNum(val, 0);
      return Number.isInteger(n) ? n.toString() : safeFix(n, 2);
    };

    elements.push(
      <g key="dim-width">
        <line x1={tx(0)} y1={toY(0) + dimOffset} x2={tx(width)} y2={toY(0) + dimOffset} stroke={dimensionColor} strokeWidth={1} />
        <line x1={tx(0)} y1={toY(0) + dimOffset - 5} x2={tx(0)} y2={toY(0) + dimOffset + 5} stroke={dimensionColor} strokeWidth={1} />
        <line x1={tx(width)} y1={toY(0) + dimOffset - 5} x2={tx(width)} y2={toY(0) + dimOffset + 5} stroke={dimensionColor} strokeWidth={1} />
        {/* Width Pill */}
        <rect x={tx(width / 2) - 30} y={toY(0) + dimOffset + 5} width={60} height={18} rx={9} fill="white" stroke={dimensionColor} strokeWidth={0.5} opacity={0.9} />
        <text x={tx(width / 2)} y={toY(0) + dimOffset + 18} textAnchor="middle" fill={dimensionColor} fontSize="11" fontFamily="Arial, sans-serif" fontWeight="800">{formatDim(width)}mm</text>
      </g>
    );

    const hingesAreLeft = hingeDrilling && hinges.length > 0 && hinges[0].side === "LEFT";
    const dimSideIsLeft = hingeDrilling ? !hingesAreLeft : false;
    const overallHeightOffset = dimOffset + 35;
    const dimXOffset = dimSideIsLeft ? -overallHeightOffset : width + overallHeightOffset;
    const dimX = tx(dimXOffset);
    const isVisuallyLeft = isBack ? !dimSideIsLeft : dimSideIsLeft;
    const hAnchor = isVisuallyLeft ? "end" : "start";
    const hTextX = dimX + (isVisuallyLeft ? -8 : 8);

    elements.push(
      <g key="dim-height">
        <line x1={dimX} y1={toY(0)} x2={dimX} y2={toY(height)} stroke={dimensionColor} strokeWidth={1} />
        <line x1={dimX - 5} y1={toY(0)} x2={dimX + 5} y2={toY(0)} stroke={dimensionColor} strokeWidth={1} />
        <line x1={dimX - 5} y1={toY(height)} x2={dimX + 5} y2={toY(height)} stroke={dimensionColor} strokeWidth={1} />
        {/* Height Pill */}
        <rect x={hTextX - (isVisuallyLeft ? 65 : 5)} y={toY(height / 2) - 10} width={70} height={20} rx={10} fill="white" stroke={dimensionColor} strokeWidth={0.5} opacity={0.9} />
        <text x={hTextX + (isVisuallyLeft ? -35 : 30)} y={toY(height / 2) + 1} textAnchor="middle" dominantBaseline="middle" fill={dimensionColor} fontSize="11" fontFamily="Arial, sans-serif" fontWeight="800">{formatDim(height)}mm</text>
      </g>
    );

    if (panelType !== "NONE") {
      const leftBorderDimY = angledLeft && leftTriangleCutoutHeight > 0
        ? (height - leftTriangleCutoutHeight) / 2 : height / 2;
      const rightBorderDimY = angledRight && rightTriangleCutoutHeight > 0
        ? (height - rightTriangleCutoutHeight) / 2 : height / 2;

      elements.push(
        <g key="dim-left-stile">
          <line x1={tx(0)} y1={toY(leftBorderDimY)} x2={tx(effectiveLeftStile)} y2={toY(leftBorderDimY)} stroke={borderDimColor} strokeWidth={1} />
          <rect x={tx(effectiveLeftStile / 2) - 20} y={toY(leftBorderDimY) - 14} width={40} height={12} rx={6} fill="white" stroke={borderDimColor} strokeWidth={0.5} opacity={0.8} />
          <text x={tx(effectiveLeftStile / 2)} y={toY(leftBorderDimY) - 5} textAnchor="middle" fill={borderDimColor} fontSize="9" fontFamily="Arial, sans-serif" fontWeight="800">{formatDim(effectiveLeftStile)}</text>
        </g>
      );
      elements.push(
        <g key="dim-right-stile">
          <line x1={tx(width - effectiveRightStile)} y1={toY(rightBorderDimY)} x2={tx(width)} y2={toY(rightBorderDimY)} stroke={borderDimColor} strokeWidth={1} />
          <rect x={tx(width - effectiveRightStile / 2) - 20} y={toY(rightBorderDimY) - 14} width={40} height={12} rx={6} fill="white" stroke={borderDimColor} strokeWidth={0.5} opacity={0.8} />
          <text x={tx(width - effectiveRightStile / 2)} y={toY(rightBorderDimY) - 5} textAnchor="middle" fill={borderDimColor} fontSize="9" fontFamily="Arial, sans-serif" fontWeight="800">{formatDim(effectiveRightStile)}</text>
        </g>
      );

      const borderDimX = width / 2;
      elements.push(
        <g key="dim-bottom-rail">
          <line x1={tx(borderDimX)} y1={toY(0)} x2={tx(borderDimX)} y2={toY(effectiveBottomRail)} stroke={borderDimColor} strokeWidth={1} />
          <rect x={tx(borderDimX) + 5} y={toY(effectiveBottomRail / 2) - 7} width={36} height={14} rx={7} fill="white" stroke={borderDimColor} strokeWidth={0.5} opacity={0.8} />
          <text x={tx(borderDimX) + 23} y={toY(effectiveBottomRail / 2) + 1} textAnchor="middle" dominantBaseline="middle" fill={borderDimColor} fontSize="9" fontFamily="Arial, sans-serif" fontWeight="800">{formatDim(effectiveBottomRail)}</text>
        </g>
      );
      if (!angledLeft && !angledRight) {
        elements.push(
          <g key="dim-top-rail">
            <line x1={tx(borderDimX)} y1={toY(height - effectiveTopRail)} x2={tx(borderDimX)} y2={toY(height)} stroke={borderDimColor} strokeWidth={1} />
            <rect x={tx(borderDimX) + 5} y={toY(height - effectiveTopRail / 2) - 7} width={36} height={14} rx={7} fill="white" stroke={borderDimColor} strokeWidth={0.5} opacity={0.8} />
            <text x={tx(borderDimX) + 23} y={toY(height - effectiveTopRail / 2) + 1} textAnchor="middle" dominantBaseline="middle" fill={borderDimColor} fontSize="9" fontFamily="Arial, sans-serif" fontWeight="800">{formatDim(effectiveTopRail)}</text>
          </g>
        );
      }
    }

    if (angledLeft && leftTriangleCutoutHeight > 0) {
      const shortSideHeight = height - leftTriangleCutoutHeight;
      const dimLX = tx(0 - dimOffset);

      elements.push(
        <g key="dim-angle-left-short">
          <line x1={dimLX} y1={toY(0)} x2={dimLX} y2={toY(shortSideHeight)} stroke="#ea580c" strokeWidth={1} />
          <line x1={dimLX - 5} y1={toY(0)} x2={dimLX + 5} y2={toY(0)} stroke="#ea580c" strokeWidth={1} />
          <line x1={dimLX - 5} y1={toY(shortSideHeight)} x2={dimLX + 5} y2={toY(shortSideHeight)} stroke="#ea580c" strokeWidth={1} />
          <rect x={dimLX - (isBack ? 5 : 65)} y={toY(shortSideHeight / 2) - 10} width={60} height={20} rx={10} fill="#fff7ed" stroke="#ea580c" strokeWidth={0.5} opacity={0.9} />
          <text x={dimLX + (isBack ? 25 : -35)} y={toY(shortSideHeight / 2) + 1} textAnchor="middle" dominantBaseline="middle" fill="#ea580c" fontSize="10" fontFamily="Arial, sans-serif" fontWeight="800">
            {formatDim(shortSideHeight)}mm
          </text>
        </g>
      );
      if (leftTriangleCutoutWidth > 0) {
        elements.push(
          <g key="dim-angle-left-width">
            <line x1={tx(0)} y1={toY(height) - dimOffset} x2={tx(leftTriangleCutoutWidth)} y2={toY(height) - dimOffset} stroke="#ea580c" strokeWidth={1} />
            <rect x={tx(leftTriangleCutoutWidth / 2) - 30} y={toY(height) - dimOffset - 22} width={60} height={18} rx={9} fill="#fff7ed" stroke="#ea580c" strokeWidth={0.5} opacity={0.9} />
            <text x={tx(leftTriangleCutoutWidth / 2)} y={toY(height) - dimOffset - 10} textAnchor="middle" fill="#ea580c" fontSize="10" fontFamily="Arial, sans-serif" fontWeight="800">{formatDim(leftTriangleCutoutWidth)}mm</text>
          </g>
        );
        elements.push(
          <g key="dim-angle-left-degrees">
            <rect x={tx(leftTriangleCutoutWidth / 3) - 25} y={toY(height - leftTriangleCutoutHeight) - 32} width={50} height={18} rx={9} fill="#fff7ed" stroke="#ea580c" strokeWidth={0.5} opacity={0.9} />
            <text x={tx(leftTriangleCutoutWidth / 3)} y={toY(height - leftTriangleCutoutHeight) - 20} textAnchor="middle" fill="#ea580c" fontSize="10" fontFamily="Arial, sans-serif" fontWeight="900">{safeFix(leftAngleDegrees, 2)}°</text>
          </g>
        );
      }
    }

    const angleLabelColor = isBack ? "#000" : "#9ca3af";
    if (panelType === "NONE") {
      if (angledLeft && leftAngleDegrees > 0) {
        elements.push(
          <text key="left-angle-deg" x={tx(20)} y={toY(height / 2 + height / 2 - 20)} textAnchor={anchorStart} fill={angleLabelColor} fontSize="14" fontFamily="Arial, sans-serif" fontWeight="800">
            {safeFix(leftAngleDegrees, 2)}°
          </text>
        );
      }
      if (angledRight && rightAngleDegrees > 0) {
        elements.push(
          <text key="right-angle-deg" x={tx(width - 20)} y={toY(height / 2 + height / 2 - 20)} textAnchor={anchorEnd} fill={angleLabelColor} fontSize="14" fontFamily="Arial, sans-serif" fontWeight="800">
            {safeFix(rightAngleDegrees, 2)}°
          </text>
        );
      }
    }

    if (angledRight && rightTriangleCutoutHeight > 0) {
      const shortSideHeight = height - rightTriangleCutoutHeight;
      const dimRX = tx(width + dimOffset);

      elements.push(
        <g key="dim-angle-right-short">
          <line x1={dimRX} y1={toY(0)} x2={dimRX} y2={toY(shortSideHeight)} stroke="#9333ea" strokeWidth={1} />
          <line x1={dimRX - 5} y1={toY(0)} x2={dimRX + 5} y2={toY(0)} stroke="#9333ea" strokeWidth={1} />
          <line x1={dimRX - 5} y1={toY(shortSideHeight)} x2={dimRX + 5} y2={toY(shortSideHeight)} stroke="#9333ea" strokeWidth={1} />
          <rect x={dimRX + (isBack ? -65 : 5)} y={toY(shortSideHeight / 2) - 10} width={60} height={20} rx={10} fill="#f3e8ff" stroke="#9333ea" strokeWidth={0.5} opacity={0.9} />
          <text x={dimRX + (isBack ? -35 : 35)} y={toY(shortSideHeight / 2) + 1} textAnchor="middle" dominantBaseline="middle" fill="#9333ea" fontSize="10" fontFamily="Arial, sans-serif" fontWeight="800">
            {formatDim(shortSideHeight)}mm
          </text>
        </g>
      );
      if (rightTriangleCutoutWidth > 0) {
        elements.push(
          <g key="dim-angle-right-width">
            <line x1={tx(width - rightTriangleCutoutWidth)} y1={toY(height) - dimOffset} x2={tx(width)} y2={toY(height) - dimOffset} stroke="#9333ea" strokeWidth={1} />
            <rect x={tx(width - rightTriangleCutoutWidth / 2) - 30} y={toY(height) - dimOffset - 22} width={60} height={18} rx={9} fill="#f3e8ff" stroke="#9333ea" strokeWidth={0.5} opacity={0.9} />
            <text x={tx(width - rightTriangleCutoutWidth / 2)} y={toY(height) - dimOffset - 10} textAnchor="middle" fill="#9333ea" fontSize="10" fontFamily="Arial, sans-serif" fontWeight="800">{formatDim(rightTriangleCutoutWidth)}mm</text>
          </g>
        );
        elements.push(
          <g key="dim-angle-right-degrees">
            <rect x={tx(width - rightTriangleCutoutWidth / 3) - 25} y={toY(height - rightTriangleCutoutHeight) - 32} width={50} height={18} rx={9} fill="#f3e8ff" stroke="#9333ea" strokeWidth={0.5} opacity={0.9} />
            <text x={tx(width - rightTriangleCutoutWidth / 3)} y={toY(height - rightTriangleCutoutHeight) - 20} textAnchor="middle" fill="#9333ea" fontSize="10" fontFamily="Arial, sans-serif" fontWeight="900">{safeFix(rightAngleDegrees, 2)}°</text>
          </g>
        );
      }
    }

    if (panelType !== "NONE") {
      if (angledLeft && leftTriangleCutoutWidth > 0 && leftTriangleCutoutHeight > 0) {
        const x1 = 0;
        const y1 = height - leftTriangleCutoutHeight;
        const x2 = leftTriangleCutoutWidth;
        const y2 = height;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const angleRad = (leftAngleDegrees * Math.PI) / 180;
        const nx = Math.cos(angleRad + Math.PI / 2);
        const ny = Math.sin(angleRad + Math.PI / 2);
        const dimDist = 20;
        const ax = mx + nx * dimDist;
        const ay = my + ny * dimDist;

        elements.push(
          <g key="dim-angled-rail-left">
            <line x1={tx(ax - nx * 10)} y1={toY(ay - ny * 10)} x2={tx(ax + nx * 10)} y2={toY(ay + ny * 10)} stroke={borderDimColor} strokeWidth={0.7} strokeOpacity={0.5} />
            <line x1={tx(mx + nx * (dimDist - 5))} y1={toY(my + ny * (dimDist - 5))} x2={tx(mx + nx * (dimDist + 5))} y2={toY(my + ny * (dimDist + 5))} stroke={borderDimColor} strokeWidth={1.5} />
            <circle cx={tx(mx)} cy={toY(my)} r="1.5" fill={borderDimColor} />
            <g transform={`translate(${tx(ax)}, ${toY(ay)}) rotate(${isBack ? safeNum(leftAngleDegrees) : -safeNum(leftAngleDegrees)})`}>
              <rect x={-20} y={-14} width={40} height={12} rx={6} fill="white" stroke={borderDimColor} strokeWidth={0.5} opacity={0.8} />
              <text x={0} y={-5} textAnchor="middle" fill={borderDimColor} fontSize="9" fontFamily="Arial, sans-serif" fontWeight="900">
                {safeFix(leftAngledRailWidth, 0)}mm
              </text>
            </g>
          </g>
        );
      }
      if (angledRight && rightTriangleCutoutWidth > 0 && rightTriangleCutoutHeight > 0) {
        const x1 = width - rightTriangleCutoutWidth;
        const y1 = height;
        const x2 = width;
        const y2 = height - rightTriangleCutoutHeight;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const angleRad = (rightAngleDegrees * Math.PI) / 180;
        const nx = -Math.cos(angleRad - Math.PI / 2);
        const ny = Math.sin(angleRad - Math.PI / 2);
        const dimDist = 20;
        const ax = mx + nx * dimDist;
        const ay = my + ny * dimDist;

        elements.push(
          <g key="dim-angled-rail-right">
            <line x1={tx(ax - nx * 10)} y1={toY(ay - ny * 10)} x2={tx(ax + nx * 10)} y2={toY(ay + ny * 10)} stroke={borderDimColor} strokeWidth={0.7} strokeOpacity={0.5} />
            <line x1={tx(mx + nx * (dimDist - 5))} y1={toY(my + ny * (dimDist - 5))} x2={tx(mx + nx * (dimDist + 5))} y2={toY(my + ny * (dimDist + 5))} stroke={borderDimColor} strokeWidth={1.5} />
            <circle cx={tx(mx)} cy={toY(my)} r="1.5" fill={borderDimColor} />
            <g transform={`translate(${tx(ax)}, ${toY(ay)}) rotate(${isBack ? -safeNum(rightAngleDegrees) : safeNum(rightAngleDegrees)})`}>
              <rect x={-20} y={-14} width={40} height={12} rx={6} fill="white" stroke={borderDimColor} strokeWidth={0.5} opacity={0.8} />
              <text x={0} y={-5} textAnchor="middle" fill={borderDimColor} fontSize="9" fontFamily="Arial, sans-serif" fontWeight="900">
                {safeFix(rightAngledRailWidth, 0)}mm
              </text>
            </g>
          </g>
        );
      }
    }

    return elements;
  };

  const renderValidationOverlay = () => {
    if (!hasErrors) return null;
    return (
      <g>
        <g transform={`translate(${maxWidth - 20}, 20)`}>
          <circle r="8" fill="#ef4444" opacity={0.9} />
          <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="12" fontWeight="900" fontFamily="Arial, sans-serif">!</text>
        </g>
        <text x={maxWidth - 34} y={24} textAnchor="end" fill="#ef4444" fontSize="9" fontFamily="Arial, sans-serif" fontWeight="700">
          Invalid Config
        </text>
      </g>
    );
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-white p-4">
      <svg
        viewBox={`0 0 ${maxWidth} ${maxHeight}`}
        className="max-w-full max-h-full"
        style={{ width: "100%", height: "100%" }}
      >
        <g transform={mirrorTransform}>
          <polygon
            points={getDoorOutline()}
            fill={fillColor}
            stroke={outlineStrokeColor}
            strokeWidth={outlineStrokeWidth}
          />
          {renderPanels()}
          {renderReededLines()}
          {renderFrameLines()}
          {renderMidRails()}
        </g>

        {renderHinges()}
        {renderDimensions()}
        {renderLiveGeo()}
        {renderHingeSideIndicator()}
        {renderValidationOverlay()}

        <text
          x={maxWidth / 2} y={maxHeight - 12}
          textAnchor="middle"
          fill={hasErrors ? "#ef4444" : "#999"}
          fontSize="10" fontFamily="Arial, sans-serif"
          fontWeight={hasErrors ? "700" : "400"}
        >
          {safeFix(width, 0)}mm × {safeFix(height, 0)}mm | {panelType === "NONE" ? "Slab" : panelType.replace(/_/g, " ")}
          {hasErrors ? " — CONFIGURATION ERRORS" : ""}
        </text>
      </svg>
    </div>
  );
}