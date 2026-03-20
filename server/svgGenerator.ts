import { Point, getInnerEdgesAtY, getHoleSections, getPanelPoints } from "./utils";

export interface SvgDoorConfig {
  width: number;
  height: number;
  thickness: number;
  preset: string;
  panelType: string;
  panelCount: number;
  panelOrientation?: string;
  shape: string;
  angledLeft?: boolean;
  angledRight?: boolean;
  leftTriangleCutoutWidth?: number;
  leftTriangleCutoutHeight?: number;
  rightTriangleCutoutWidth?: number;
  rightTriangleCutoutHeight?: number;
  borderWidth?: number;
  customBorders?: boolean;
  leftStile?: number;
  rightStile?: number;
  bottomRail?: number;
  topRail?: number;
  midRailsEnabled?: boolean;
  midRails?: Array<{ positionFromBottom: number; dimension: number }>;
  rebateWidthMm?: number;
  rebateDepthMm?: number;
  frontFaceThicknessMm?: number;
  cornerRadiusMm?: number;
  hingeDrilling?: boolean;
  hinges?: any[];
  material: string;
  finish: string;
  leftAngleDegrees?: number;
  rightAngleDegrees?: number;
  leftAngledRailWidth?: number;
  rightAngledRailWidth?: number;
  compact?: boolean;
}

export function generateDoorSvg(config: SvgDoorConfig): string {
  const {
    width,
    height,
    preset,
    panelType,
    panelCount,
    panelOrientation = "vertical",
    shape,
    angledLeft = false,
    angledRight = false,
    leftTriangleCutoutWidth = 100,
    leftTriangleCutoutHeight = 200,
    rightTriangleCutoutWidth = 100,
    rightTriangleCutoutHeight = 200,
    leftStile = 75,
    rightStile = 75,
    bottomRail = 75,
    topRail = 75,
    midRailsEnabled = false,
    midRails = [],
    leftAngledRailWidth = 90,
    rightAngledRailWidth = 90,
  } = config;

  const compact = config.compact || false;
  const h = height;
  const w = width;
  const isDoubleDoor = preset === "double";

  // Use identical scaling logic to Door2D.tsx
  const padding = compact ? 20 : 80;
  const maxWidth = compact ? 500 : 500; // Keep internal coordinate space consistent
  const maxHeight = compact ? 650 : 650;

  const scaleX = (maxWidth - padding * 2) / width;
  const scaleY = (maxHeight - padding * 2) / height;
  const scale = Math.min(scaleX, scaleY);

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  const offsetX = (maxWidth - scaledWidth) / 2;
  const offsetY = (maxHeight - scaledHeight) / 2;

  const strokeWidth = compact ? 8 : 1.5;
  const strokeColor = compact ? "#292524" : "#44403c"; // stone-900 for compact, stone-800 normal
  const fillColor = compact ? "#f5f5f4" : "#fafaf9"; // stone-100 for compact, stone-50 normal
  const panelFillColor = compact ? "#d6d3d1" : "#e7e5e4"; // stone-300 for compact, stone-200 normal
  const railFillColor = compact ? "#f5f5f4" : "#fafaf9";
  const dimensionColor = "#78716c"; // stone-500

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxWidth} ${maxHeight}" width="${compact ? 1000 : maxWidth}" height="${compact ? 1000 : maxHeight}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${compact ? 2 : 3}" />
      <feOffset dx="${compact ? 1 : 2}" dy="${compact ? 1 : 2}" result="offsetblur" />
      <feComponentTransfer>
        <feFuncA type="linear" slope="${compact ? 0.3 : 0.2}" />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- Background -->
  <rect x="0" y="0" width="${maxWidth}" height="${maxHeight}" fill="#ffffff" />
`;

  // Only add label in non-compact mode
  if (!compact) {
    svg += `  <!-- Face Label (Match Door2D) -->
  <text x="${maxWidth / 2}" y="30" text-anchor="middle" fill="#2563eb" font-family="Liberation Sans, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="2">FRONT VIEW</text>
`;
  }

  const transformY = (y: number) => offsetY + (h - y) * scale;

  // Style attributes
  const frameStyle = `fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth * scale}" filter="url(#shadow)"`;

  if (isDoubleDoor) {
    const gap = 10;
    const leafWidth = (w - gap) / 2;

    svg += drawDoorLeaf(
      offsetX,
      leafWidth,
      h,
      shape,
      angledLeft,
      false,
      leftTriangleCutoutWidth,
      leftTriangleCutoutHeight,
      0,
      0,
      panelType,
      panelCount,
      panelOrientation,
      leftStile,
      rightStile,
      bottomRail,
      topRail,
      midRailsEnabled,
      midRails,
      config.leftAngleDegrees || 0,
      config.rightAngleDegrees || 0,
      config.leftAngledRailWidth || 90,
      config.rightAngledRailWidth || 90,
      frameStyle,
      railFillColor,
      panelFillColor,
      transformY,
      config,
      padding,
      isDoubleDoor,
      scale
    );

    svg += drawDoorLeaf(
      offsetX + (leafWidth + gap) * scale,
      leafWidth,
      h,
      shape,
      false,
      angledRight,
      0,
      0,
      rightTriangleCutoutWidth,
      rightTriangleCutoutHeight,
      panelType,
      panelCount,
      panelOrientation,
      leftStile,
      rightStile,
      bottomRail,
      topRail,
      midRailsEnabled,
      midRails,
      config.leftAngleDegrees || 0,
      config.rightAngleDegrees || 0,
      config.leftAngledRailWidth || 90,
      config.rightAngledRailWidth || 90,
      frameStyle,
      railFillColor,
      panelFillColor,
      transformY,
      config,
      padding,
      isDoubleDoor,
      scale
    );
  } else {
    svg += drawDoorLeaf(
      offsetX,
      w,
      h,
      shape,
      angledLeft,
      angledRight,
      leftTriangleCutoutWidth,
      leftTriangleCutoutHeight,
      rightTriangleCutoutWidth,
      rightTriangleCutoutHeight,
      panelType,
      panelCount,
      panelOrientation,
      leftStile,
      rightStile,
      bottomRail,
      topRail,
      midRailsEnabled,
      midRails,
      config.leftAngleDegrees || 0,
      config.rightAngleDegrees || 0,
      config.leftAngledRailWidth || 90,
      config.rightAngledRailWidth || 90,
      frameStyle,
      railFillColor,
      panelFillColor,
      transformY,
      config,
      padding,
      isDoubleDoor,
      scale
    );
  }

  // Only add dimensions and title block in non-compact mode
  if (!compact) {
    svg += addDimensions_Scaled(offsetX, offsetY, w, h, scale, dimensionColor);
    svg += addTitleBlock_Scaled(maxWidth, maxHeight, config);
  }
  svg += `</svg>`;

  return svg;
}

function drawDoorLeaf(
  xOffset: number,
  width: number,
  height: number,
  shape: string,
  angledLeft: boolean,
  angledRight: boolean,
  leftCutW: number,
  leftCutH: number,
  rightCutW: number,
  rightCutH: number,
  panelType: string,
  panelCount: number,
  panelOrientation: string,
  leftStile: number,
  rightStile: number,
  bottomRail: number,
  topRail: number,
  midRailsEnabled: boolean,
  midRails: Array<{ positionFromBottom: number; dimension: number }>,
  leftAngleDegrees: number,
  rightAngleDegrees: number,
  leftAngledRailWidth: number,
  rightAngledRailWidth: number,
  frameStyle: string,
  railFillColor: string,
  panelFillColor: string,
  transformY: (y: number) => number,
  config: SvgDoorConfig,
  padding: number,
  isDoubleDoor: boolean,
  scale: number
): string {
  let svg = "";
  const toX = (x: number) => xOffset + x * scale;

  const clipId = `clip-${xOffset}-${Date.now()}`;

  let clipPathD = "";
  if (angledLeft || angledRight) {
    const points: Array<[number, number]> = [];

    points.push([toX(0), transformY(0)]);

    if (angledLeft) {
      points.push([toX(0), transformY(height - leftCutH)]);
      points.push([toX(leftCutW), transformY(height)]);
    } else {
      points.push([toX(0), transformY(height)]);
    }

    if (angledRight) {
      points.push([toX(width - rightCutW), transformY(height)]);
      points.push([toX(width), transformY(height - rightCutH)]);
    } else {
      points.push([toX(width), transformY(height)]);
    }

    points.push([toX(width), transformY(0)]);

    clipPathD = `M ${points[0][0]} ${points[0][1]} `;
    for (let i = 1; i < points.length; i++) {
      clipPathD += `L ${points[i][0]} ${points[i][1]} `;
    }
    clipPathD += "Z";

    svg += `  <defs><clipPath id="${clipId}"><path d="${clipPathD}" /></clipPath></defs>\n`;
    svg += `  <path d="${clipPathD}" ${frameStyle} />\n`;
  } else {
    svg += `  <rect x="${toX(0)}" y="${transformY(height)}" width="${width * scale}" height="${height * scale}" ${frameStyle} />\n`;
  }

  const useClip = angledLeft || angledRight;
  const clipAttr = useClip ? ` clip-path="url(#${clipId})"` : "";

  if (midRailsEnabled && midRails.length > 0) {
    for (const rail of midRails) {
      const rBottom = rail.positionFromBottom;
      const rTop = rBottom + rail.dimension;

      const { leftInner: xLB, rightInner: xRB } = getInnerEdgesAtY(rBottom, width, height, leftStile, rightStile, topRail, bottomRail, leftAngledRailWidth, rightAngledRailWidth, angledLeft, angledRight, leftCutW, leftCutH, rightCutW, rightCutH);
      const { leftInner: xLT, rightInner: xRT } = getInnerEdgesAtY(rTop, width, height, leftStile, rightStile, topRail, bottomRail, leftAngledRailWidth, rightAngledRailWidth, angledLeft, angledRight, leftCutW, leftCutH, rightCutW, rightCutH);

      const points = [
        [toX(xLB), transformY(rBottom)],
        [toX(xRB), transformY(rBottom)],
        [toX(xRT), transformY(rTop)],
        [toX(xLT), transformY(rTop)]
      ];

      const pathD = `M ${points.map(p => `${p[0]} ${p[1]}`).join(" L ")} Z`;
      svg += `  <path d="${pathD}" fill="${railFillColor}" stroke="#52525b" stroke-width="${(config.compact ? 2 : 1) * scale}"${clipAttr} />\n`;
    }
  }

  if (panelType !== "NONE" && panelCount > 0) {
    const holeSections = getHoleSections(
      midRailsEnabled ? midRails : [],
      height, bottomRail, topRail, panelCount
    );

    for (const [secIdx, section] of holeSections.entries()) {
      const panelPts = getPanelPoints(
        section,
        width, height,
        leftStile, rightStile,
        topRail, bottomRail,
        leftAngledRailWidth, rightAngledRailWidth,
        angledLeft, angledRight,
        leftCutW, leftCutH,
        rightCutW, rightCutH,
        0 // inset
      );

      // Need at least 3 points to form a polygon
      if (panelPts.length > 2) {
        const pathD = `M ${panelPts.map(p => `${toX(p.x)} ${transformY(p.y)}`).join(" L ")} Z`;
        svg += `  <path d="${pathD}" fill="${panelFillColor}" stroke="#a8a29e" stroke-width="${(config.compact ? 2 : 1) * scale}"${clipAttr} />\n`;

        // Reeded lines
        if (panelType === "REEDED_19MM") {
          const reedSpacing = 12;
          const currentLS = leftStile;
          const currentRS = rightStile;
          const pW = width - currentLS - currentRS;
          const count = Math.max(2, Math.round(pW / reedSpacing));
          const step = pW / count;
          const clipId = `reed-clip-${xOffset}-${section.bottom}-${secIdx}-${Date.now()}`;

          svg += `  <defs><clipPath id="${clipId}"><path d="${pathD}" /></clipPath></defs>\n`;
          svg += `  <g clip-path="url(#${clipId})">\n`;
          for (let r = 0; r <= count; r++) {
            const rx = toX(currentLS + r * step);
            svg += `    <line x1="${rx}" y1="${transformY(section.bottom)}" x2="${rx}" y2="${transformY(section.top)}" stroke="#a8a29e" stroke-width="${0.5 * scale}" opacity="0.6" />\n`;
          }
          svg += `  </g>\n`;
        }

        if (panelType === "raised") {
          const innerPad = 10;
          const innerPts = getPanelPoints(
            section,
            width, height,
            leftStile, rightStile,
            topRail, bottomRail,
            leftAngledRailWidth, rightAngledRailWidth,
            angledLeft, angledRight,
            leftCutW, leftCutH,
            rightCutW, rightCutH,
            innerPad // inset
          );
          if (innerPts.length > 2) {
            const innerPathD = `M ${innerPts.map(p => `${toX(p.x)} ${transformY(p.y)}`).join(" L ")} Z`;
            svg += `  <path d="${innerPathD}" fill="${panelFillColor}" stroke="#a8a29e" stroke-width="${1 * scale}"${clipAttr} />\n`;
          }
        }
      }
    }
  }

  // Hinges
  if (config.hingeDrilling && config.hinges && config.hinges.length > 0) {
    for (const hinge of config.hinges) {
      if (hinge.side === "LEFT" && xOffset > padding) continue;
      if (hinge.side === "RIGHT" && xOffset === padding && isDoubleDoor) continue;

      const hY = hinge.positionFromBottomMm;
      const hX = (hinge.side === "LEFT" ? 22 : width - 22);

      let hidden = false;
      if (hinge.side === "LEFT" && angledLeft) {
        if ((hX) / leftCutW + (height - hY) / leftCutH < 1) hidden = true;
      } else if (hinge.side === "RIGHT" && angledRight) {
        if ((width - hX) / rightCutW + (height - hY) / rightCutH < 1) hidden = true;
      }

      if (!hidden) {
        svg += `  <circle cx="${toX(hX)}" cy="${transformY(hY)}" r="${17.5 * scale}" fill="#a1a1aa" stroke="#52525b" stroke-width="${1 * scale}" fill-opacity="0.3" stroke-dasharray="${4 * scale} ${2 * scale}" />\n`;
        svg += `  <circle cx="${toX(hX)}" cy="${transformY(hY)}" r="${2 * scale}" fill="#52525b" />\n`;
      }
    }
  }

  return svg;
}

function addDimensions_Scaled(
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  scale: number,
  color: string
): string {
  let svg = "";
  const dimOffset = 25 * scale;
  const toX = (x: number) => offsetX + x * scale;
  const toY = (y: number) => offsetY + (height - y) * scale;

  const textStyle = `font-family="Liberation Sans, Arial, sans-serif" font-size="12px" fill="${color}" font-weight="600"`;

  // Width dimension
  svg += `  <line x1="${toX(0)}" y1="${toY(0) + dimOffset}" x2="${toX(width)}" y2="${toY(0) + dimOffset}" stroke="${color}" stroke-width="1" />\n`;
  svg += `  <line x1="${toX(0)}" y1="${toY(0) + dimOffset - 5}" x2="${toX(0)}" y2="${toY(0) + dimOffset + 5}" stroke="${color}" stroke-width="1" />\n`;
  svg += `  <line x1="${toX(width)}" y1="${toY(0) + dimOffset - 5}" x2="${toX(width)}" y2="${toY(0) + dimOffset + 5}" stroke="${color}" stroke-width="1" />\n`;
  svg += `  <text ${textStyle} x="${toX(width / 2)}" y="${toY(0) + dimOffset + 15}" text-anchor="middle">${Math.round(width)}mm</text>\n`;

  // Height dimension
  svg += `  <line x1="${toX(width) + dimOffset}" y1="${toY(0)}" x2="${toX(width) + dimOffset}" y2="${toY(height)}" stroke="${color}" stroke-width="1" />\n`;
  svg += `  <line x1="${toX(width) + dimOffset - 5}" y1="${toY(0)}" x2="${toX(width) + dimOffset + 5}" y2="${toY(0)}" stroke="${color}" stroke-width="1" />\n`;
  svg += `  <line x1="${toX(width) + dimOffset - 5}" y1="${toY(height)}" x2="${toX(width) + dimOffset + 5}" y2="${toY(height)}" stroke="${color}" stroke-width="1" />\n`;
  svg += `  <text ${textStyle} x="${toX(width) + dimOffset + 8}" y="${toY(height / 2)}" text-anchor="start" dominant-baseline="middle" transform="rotate(0, ${toX(width) + dimOffset + 8}, ${toY(height / 2)})">${Math.round(height)}mm</text>\n`;

  return svg;
}

function addTitleBlock_Scaled(maxWidth: number, maxHeight: number, config: SvgDoorConfig): string {
  const label = config.panelType === "NONE" ? "Slab" : config.panelType.replace(/_/g, " ");
  return `  <text x="${maxWidth / 2}" y="${maxHeight - 8}" text-anchor="middle" fill="#999" font-family="Liberation Sans, Arial, sans-serif" font-size="10">${config.width}mm × ${config.height}mm | ${label}</text>\n`;
}
