import { DxfWriter, point3d, point2d, LWPolylineFlags } from "@tarikjabiri/dxf";
import { roundCorners, Point, getHoleSections, getPanelPoints } from "./utils";
import { getManufacturingSettings } from "./settings";

export interface DxfDoorConfig {
  width: number;
  height: number;
  thickness: number;
  preset: string;
  panelType: string;
  panelCount: number;
  shape: string;
  material: string;
  finish: string;
  rebateWidthMm: number;
  rebateDepthMm: number;
  frontFaceThicknessMm: number;
  cornerRadiusMm: number;
  angledLeft?: boolean;
  angledRight?: boolean;
  leftTriangleCutoutWidth?: number;
  leftTriangleCutoutHeight?: number;
  rightTriangleCutoutWidth?: number;
  rightTriangleCutoutHeight?: number;
  hinges: any[];
  leftStile?: number;
  rightStile?: number;
  topRail?: number;
  bottomRail?: number;
  midRailsEnabled?: boolean;
  midRails?: any[];
  leftAngledRailWidth?: number;
  rightAngledRailWidth?: number;
  panelOrientation?: string;
  hingeDrilling?: boolean;
  customerName?: string;
  jobName?: string;
  doorId?: string;
}

// Utility to mirror coordinates horizontally and reverse winding order
function mirrorAndReverse(points: Point[], width: number): { point: any }[] {
  return points
    .map(p => ({ x: width - p.x, y: p.y })) // Mirror X
    .reverse() // Reverse order to maintain original winding direction (since mirroring flips it)
    .map(p => ({ point: point2d(p.x, p.y) }));
}

export async function generateDoorDxf(config: DxfDoorConfig): Promise<string> {
  const settings = await getManufacturingSettings();
  const dxf = new DxfWriter();

  // --- REQUIRED CNC TOOLING LAYERS ---
  const layers = settings.layers;
  dxf.addLayer(layers.hingeHoles || "hinge screw holes", 3, "CONTINUOUS");
  dxf.addLayer(layers.hingeCups || "hinge cups", 3, "CONTINUOUS");
  dxf.addLayer(layers.innerRebate || "inner rebate", 1, "CONTINUOUS");
  dxf.addLayer(layers.innerPerimeter || "inner perimeter cut", 1, "CONTINUOUS");
  dxf.addLayer(layers.perimeter || "perimeter cut", 5, "CONTINUOUS");
  dxf.addLayer(layers.panel || "panel", 2, "CONTINUOUS");
  dxf.addLayer(layers.partIdentification || "part identification", 7, "CONTINUOUS");

  // Local fallback assignments for entity creation
  const l_perimeter = layers.perimeter || "perimeter cut";
  const l_innerPerimeter = layers.innerPerimeter || "inner perimeter cut";
  const l_innerRebate = layers.innerRebate || "inner rebate";
  const l_panel = layers.panel || "panel";
  const l_hingeCups = layers.hingeCups || "hinge cups";
  const l_hingeHoles = layers.hingeHoles || "hinge screw holes";
  const l_partId = layers.partIdentification || "part identification";

  const {
    width,
    height,
    preset,
    panelType,
    hinges,
    leftTriangleCutoutWidth,
    leftTriangleCutoutHeight,
    rightTriangleCutoutWidth,
    rightTriangleCutoutHeight,
    customerName,
    jobName,
    doorId
  } = config;

  // Normalize angled flags
  const isAngledShape = config.shape === "angled";
  const aL = config.angledLeft ?? (isAngledShape && (config.leftTriangleCutoutWidth || 0) > 0);
  const aR = config.angledRight ?? (isAngledShape && (config.rightTriangleCutoutWidth || 0) > 0);

  // Defaults
  const defaultBorder = 75;
  const lStile = config.leftStile || defaultBorder;
  const rStile = config.rightStile || defaultBorder;
  const tRail = config.topRail || defaultBorder;
  const bRail = config.bottomRail || defaultBorder;
  const mRails = config.midRailsEnabled && config.midRails ? config.midRails : [];
  const lcw = leftTriangleCutoutWidth || 0;
  const lch = leftTriangleCutoutHeight || 0;
  const rcw = rightTriangleCutoutWidth || 0;
  const rch = rightTriangleCutoutHeight || 0;
  
  // Enforce standard borders on angled top rails as well
  const arwL = tRail;
  const arwR = tRail;

  // ─── A. Outer Profile ───
  const outerPoints = getProfilePoints(width, height, aL, aR, lcw, lch, rcw, rch);
  const mirroredOuterPoints = mirrorAndReverse(outerPoints, width);
  dxf.addLWPolyline(mirroredOuterPoints, { flags: LWPolylineFlags.Closed, layerName: l_perimeter });

  // ─── B. Inner Profile & Panel ───
  if (panelType !== "NONE") {

    // First, define our panel sections divided by mid-rails
    const effectivePanelCount = config.midRailsEnabled ? (config.panelCount || 1) : 1;
    const holeSections = getHoleSections(
      mRails, height, bRail, tRail,
      effectivePanelCount
    );

    // Now loop over each section cutout
    for (const sec of holeSections) {
        // Inner Perimeter Cut (Panel Hole)
        const innerPoints = getPanelPoints(
          sec,
          width, height,
          lStile, rStile,
          tRail, bRail,
          arwL, arwR,
          aL, aR,
          lcw, lch, rcw, rch,
          0 // inset
        );
        
        if (innerPoints.length > 0) {
          const mirroredInnerPoints = mirrorAndReverse(innerPoints, width);
          dxf.addLWPolyline(mirroredInnerPoints, { flags: LWPolylineFlags.Closed, layerName: l_innerPerimeter });
        }

        // Inner Rebate
        const rM = config.rebateWidthMm || 10;
        const rebatePoints = getPanelPoints(
          sec,
          width, height,
          lStile, rStile,
          tRail, bRail,
          arwL, arwR,
          aL, aR,
          lcw, lch, rcw, rch,
          -rM // negative inset means expansion
        );
        
        if (rebatePoints.length > 0) {
          const mirroredRebatePoints = mirrorAndReverse(rebatePoints, width);
          dxf.addLWPolyline(mirroredRebatePoints, { flags: LWPolylineFlags.Closed, layerName: l_innerRebate });
        }

        // Panel Geometry
        const panelUndersize = settings.panelOffsetToleranceMm;
        const panelRadius = settings.panelCornerRadiusMm;

        const pInset = -rM + panelUndersize; // expansion by rM, then contract by undersize
        const rawPanelPoints = getPanelPoints(
          sec,
          width, height,
          lStile, rStile,
          tRail, bRail,
          arwL, arwR,
          aL, aR,
          lcw, lch, rcw, rch,
          pInset
        );

        if (rawPanelPoints.length > 0) {
          const roundedPanelPoints = roundCorners(rawPanelPoints, panelRadius);
          const dxfPanelPoints = mirrorAndReverse(roundedPanelPoints, width);
          dxf.addLWPolyline(dxfPanelPoints, { flags: LWPolylineFlags.Closed, layerName: l_panel });
        }
    }
  }

  // ─── C. Hinges ───
  if (config.hingeDrilling !== false && hinges && hinges.length > 0) {
    hinges.forEach((h: any) => {
      // Convert from client hinge format to absolute Y from bottom
      let y: number;
      if (h.positionFromBottomMm != null) {
        y = Number(h.positionFromBottomMm);
      } else if (h.positionMm != null && h.reference) {
        if (h.reference === "TOP") {
          let angleCutoutH = 0;
          if (h.side === "LEFT" && aL && lch) {
            angleCutoutH = Number(lch) || 0;
          } else if (h.side === "RIGHT" && aR && rch) {
            angleCutoutH = Number(rch) || 0;
          }
          y = (height - angleCutoutH) - Number(h.positionMm);
        } else {
          y = Number(h.positionMm);
        }
      } else if (h.position != null) {
        y = Number(h.position);
      } else {
        y = 100;
      }

      // Hinge center offset: 5mm gap + 17.5mm (half of 35mm cup) = 22.5mm
      const originalX = h.side === "LEFT" ? 22.5 : width - 22.5;

      // Skip hinges that fall outside angled cutouts
      if (h.side === "LEFT" && aL && lcw > 0 && lch > 0) {
        const heightFromBottom = y;
        const angleStartFromBottom = height - lch;
        if (heightFromBottom > angleStartFromBottom) {
          const t = (heightFromBottom - angleStartFromBottom) / lch;
          const edgeX = lcw * t;
          if (originalX < edgeX + 17.5 + 2) return;
        }
      }
      if (h.side === "RIGHT" && aR && rcw > 0 && rch > 0) {
        const heightFromBottom = y;
        const angleStartFromBottom = height - rch;
        if (heightFromBottom > angleStartFromBottom) {
          const t = (heightFromBottom - angleStartFromBottom) / rch;
          const edgeX = width - rcw * t;
          if (originalX > edgeX - 17.5 - 2) return;
        }
      }

      // Mirror X for rear-view
      const mirrorX = width - originalX;

      // HINGE_CUPS (35mm Cup)
      dxf.addCircle(point3d(mirrorX, y, 0), 35 / 2, { layerName: l_hingeCups });

      // HINGE_SCREW_HOLES
      const screwOffset = 22.5; // 45mm spread
      const hingeType = h.type || h.hingeType || "SCREW_POINTS";
      const drillRadius = hingeType === "INSERTA" ? 4 : 2;

      dxf.addCircle(point3d(mirrorX, y + screwOffset, 0), drillRadius, { layerName: l_hingeHoles });
      dxf.addCircle(point3d(mirrorX, y - screwOffset, 0), drillRadius, { layerName: l_hingeHoles });
    });
  }

  // ─── D. Part Identification Stamp ───
  if (customerName || jobName || doorId) {
    const centerX = width / 2;
    const centerY = height / 2;
    // To roughly center the text visually since addText uses bottom-left origin, we offset X by a fixed amount.
    // A more precise approach would require knowing font metrics.
    const textHeight = 18;
    const xOffset = centerX - 100;
    
    let currentY = centerY + 30; // Start slightly above center

    if (customerName) {
      dxf.addText(point3d(xOffset, currentY, 0), textHeight, `Customer: ${customerName}`, { layerName: l_partId });
      currentY -= (textHeight + 10);
    }
    if (jobName) {
      dxf.addText(point3d(xOffset, currentY, 0), textHeight, `Job: ${jobName}`, { layerName: l_partId });
      currentY -= (textHeight + 10);
    }
    if (doorId) {
      dxf.addText(point3d(xOffset, currentY, 0), textHeight, `Door ID: ${doorId}`, { layerName: l_partId });
    }
  }

  return dxf.stringify();
}

// ─── Helper: Outer Profile Points ───
function getProfilePoints(
  w: number, h: number,
  angL: any, angR: any,
  lW: any, lH: any,
  rW: any, rH: any
): Point[] {
  const pts: Point[] = [];
  pts.push({ x: 0, y: 0 });
  pts.push({ x: w, y: 0 });

  if (angR && rW > 0 && rH > 0) {
    pts.push({ x: w, y: h - rH });
    pts.push({ x: w - rW, y: h });
  } else {
    pts.push({ x: w, y: h });
  }

  if (angL && lW > 0 && lH > 0) {
    pts.push({ x: lW, y: h });
    pts.push({ x: 0, y: h - lH });
  } else {
    pts.push({ x: 0, y: h });
  }

  return pts;
}