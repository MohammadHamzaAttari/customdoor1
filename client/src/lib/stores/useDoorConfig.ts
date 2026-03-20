// client/src/lib/stores/useDoorConfig.ts
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { calculateDoorPrice, DEFAULT_PRICING } from "@shared/doorSchema";

// ============================================
// CONSTANTS
// ============================================

export const MIN_BORDER_WITH_HINGES = 80;
export const MIN_BORDER_WITHOUT_HINGES = 50;
export const MIN_WIDTH_MM = 100;
export const MAX_WIDTH_MM = 1200;
export const MIN_HEIGHT_MM = 100;
export const MAX_HEIGHT_MM = 2500;
export const HINGE_CUP_DIAMETER_MM = 35;
export const HINGE_CENTER_OFFSET_MM = 22.5;

// Angled corner constraints (CNC manufacturing limits)
export const MIN_ANGLE_DEGREES = 1;
export const MAX_ANGLE_DEGREES = 89;
export const MIN_SHORT_SIDE_HEIGHT_MM = 0;
export const MIN_CUTOUT_DIMENSION_MM = 0;
export const MIN_PANEL_OPENING_MM = 30;
export const MIN_MATERIAL_BRIDGE_MM = 0;

// ============================================
// TYPES
// ============================================

export type PanelType =
  | "UNSELECTED"
  | "STANDARD_12MM"
  | "STANDARD_9MM"
  | "REEDED_19MM"
  | "MELAMINE_18MM"
  | "FRETWORK"
  | "NONE";

export type FinishOption =
  | "RAW_UNASSEMBLED"
  | "ASSEMBLED_PREP"
  | "PRIMED"
  | "PAINTED";

export type HingeType = "SCREW_POINTS" | "INSERTA";
export type HingeSide = "LEFT" | "RIGHT";
export type HingeReference = "TOP" | "BOTTOM";

export interface HingePosition {
  id: string;
  side: HingeSide;
  reference: HingeReference;
  positionMm: number;
  type: HingeType;
}

export interface MidRail {
  id: string;
  positionFromBottom: number;
  dimension: number;
}

export interface AngleValidationIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  side?: "left" | "right" | "both";
}

export interface DoorConfig {
  width: number;
  height: number;
  thickness: 18 | 22;
  panelType: PanelType;
  panelCount: number;
  panelOrientation: "vertical" | "horizontal";
  borderWidth: number;
  customBorders: boolean;
  leftStile: number;
  rightStile: number;
  topRail: number;
  bottomRail: number;
  angledLeft: boolean;
  angledRight: boolean;
  leftTriangleCutoutWidth: number;
  leftTriangleCutoutHeight: number;
  rightTriangleCutoutWidth: number;
  rightTriangleCutoutHeight: number;
  leftAngleDegrees: number;
  rightAngleDegrees: number;
  leftAngledRailWidth: number;
  rightAngledRailWidth: number;
  midRailsEnabled: boolean;
  midRailsEqualise: boolean;
  midRails: MidRail[];
  hingeDrilling: boolean;
  hinges: HingePosition[];
  intendedHingeSide: HingeSide;
  finish: FinishOption;
  showDimensions: boolean;
  rebateWidthMm: number;
  rebateDepthMm: number;
  frontFaceThicknessMm: number;
  cornerRadiusMm: number;
  rearCornerRadiusMm: number;
  selectedSection: string;
  angleValidationIssues: AngleValidationIssue[];
  // Pricing & Meta
  price: number;
  isNewSession: boolean;
  editingCartItemId: string | null;
  _hasInteracted: boolean;
}

// ============================================
// SAFE NUMBER HELPERS
// ============================================

/** Always returns a finite number, never NaN/undefined/null */
function safeNum(val: unknown, fallback: number = 0): number {
  if (val === undefined || val === null) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  const v = safeNum(value, min);
  return Math.max(min, Math.min(max, v));
}

// ============================================
// ANGLE CALCULATION — always returns a number
// ============================================

export function calculateAngleDegrees(
  cutoutWidth: unknown,
  cutoutHeight: unknown
): number {
  const w = safeNum(cutoutWidth, 0);
  const h = safeNum(cutoutHeight, 0);
  if (w <= 0 || h <= 0) return 0;
  const rad = Math.atan2(h, w);
  const deg = (rad * 180) / Math.PI;
  return Number.isFinite(deg) ? deg : 0;
}

export function calculateMaxCutoutWidth(
  doorWidth: number,
  otherCutoutWidth: number,
  _borderLeft: number,
  _borderRight: number,
  _side: "left" | "right"
): number {
  const dw = safeNum(doorWidth, 600);
  const other = safeNum(otherCutoutWidth, 0);
  const maxFromOverlap = dw - other - MIN_MATERIAL_BRIDGE_MM;
  const maxFromDoor = dw - MIN_MATERIAL_BRIDGE_MM;
  return Math.max(0, Math.min(maxFromOverlap, maxFromDoor, dw));
}

export function calculateMaxCutoutHeight(
  doorHeight: number,
  _bottomRail: number
): number {
  const dh = safeNum(doorHeight, 720);
  return Math.max(0, dh - MIN_SHORT_SIDE_HEIGHT_MM);
}

// ============================================
// VALIDATION
// ============================================

export function validateAngledCorners(
  config: Partial<DoorConfig>
): AngleValidationIssue[] {
  const issues: AngleValidationIssue[] = [];

  const width = safeNum(config.width, 600);
  const height = safeNum(config.height, 720);
  const angledLeft = config.angledLeft ?? false;
  const angledRight = config.angledRight ?? false;
  const leftTriangleCutoutWidth = safeNum(config.leftTriangleCutoutWidth, 0);
  const leftTriangleCutoutHeight = safeNum(config.leftTriangleCutoutHeight, 0);
  const rightTriangleCutoutWidth = safeNum(config.rightTriangleCutoutWidth, 0);
  const rightTriangleCutoutHeight = safeNum(config.rightTriangleCutoutHeight, 0);
  const leftStile = safeNum(config.leftStile, 90);
  const rightStile = safeNum(config.rightStile, 90);
  const topRail = safeNum(config.topRail, 90);
  const bottomRail = safeNum(config.bottomRail, 90);
  const customBorders = config.customBorders ?? false;
  const borderWidth = safeNum(config.borderWidth, 90);
  const leftAngledRailWidth = safeNum(config.leftAngledRailWidth, 90);
  const rightAngledRailWidth = safeNum(config.rightAngledRailWidth, 90);
  const midRailsEnabled = config.midRailsEnabled ?? false;
  const midRails = config.midRails ?? [];
  const hingeDrilling = config.hingeDrilling ?? false;
  const hinges = config.hinges ?? [];
  const panelType = config.panelType ?? "STANDARD_12MM";

  const effLeftStile = customBorders ? leftStile : borderWidth;
  const effRightStile = customBorders ? rightStile : borderWidth;

  // ---- LEFT ANGLE VALIDATION ----
  if (angledLeft) {
    const lcw = leftTriangleCutoutWidth;
    const lch = leftTriangleCutoutHeight;

    if (lcw < MIN_CUTOUT_DIMENSION_MM || lch < MIN_CUTOUT_DIMENSION_MM) {
      issues.push({
        type: "error",
        code: "LEFT_CUTOUT_TOO_SMALL",
        message: `Left cutout dimensions must be at least ${MIN_CUTOUT_DIMENSION_MM}mm each. Current: ${lcw}×${lch}mm.`,
        side: "left",
      });
    }

    if (lcw > width) {
      issues.push({
        type: "error",
        code: "LEFT_CUTOUT_WIDTH_EXCEEDS_DOOR",
        message: `Left cutout width (${lcw}mm) must be less than or equal to door width (${width}mm).`,
        side: "left",
      });
    }
    if (lch > height) {
      issues.push({
        type: "error",
        code: "LEFT_CUTOUT_HEIGHT_EXCEEDS_DOOR",
        message: `Left cutout height (${lch}mm) must be less than or equal to door height (${height}mm).`,
        side: "left",
      });
    }

    const leftShortSide = height - lch;
    if (leftShortSide < MIN_SHORT_SIDE_HEIGHT_MM) {
      issues.push({
        type: "error",
        code: "LEFT_SHORT_SIDE_TOO_SHORT",
        message: `Left short side (${Math.round(leftShortSide)}mm) is below minimum ${MIN_SHORT_SIDE_HEIGHT_MM}mm.`,
        side: "left",
      });
    }



    if (lcw > 0 && lch > 0) {
      const hypotenuse = Math.sqrt(lcw * lcw + lch * lch);
      if (leftAngledRailWidth > hypotenuse * 0.6) {
        issues.push({
          type: "warning",
          code: "LEFT_ANGLED_RAIL_TOO_WIDE",
          message: `Left angled rail (${leftAngledRailWidth}mm) is >60% of hypotenuse (${hypotenuse.toFixed(0)}mm).`,
          side: "left",
        });
      }
      if (leftAngledRailWidth >= hypotenuse * 0.9) {
        issues.push({
          type: "error",
          code: "LEFT_ANGLED_RAIL_EXCEEDS_HYPOTENUSE",
          message: `Left angled rail (${leftAngledRailWidth}mm) is too close to hypotenuse (${hypotenuse.toFixed(0)}mm). No panel possible.`,
          side: "left",
        });
      }
    }


  }

  // ---- RIGHT ANGLE VALIDATION ----
  if (angledRight) {
    const rcw = rightTriangleCutoutWidth;
    const rch = rightTriangleCutoutHeight;

    if (rcw < MIN_CUTOUT_DIMENSION_MM || rch < MIN_CUTOUT_DIMENSION_MM) {
      issues.push({
        type: "error",
        code: "RIGHT_CUTOUT_TOO_SMALL",
        message: `Right cutout dimensions must be at least ${MIN_CUTOUT_DIMENSION_MM}mm each. Current: ${rcw}×${rch}mm.`,
        side: "right",
      });
    }

    if (rcw > width) {
      issues.push({
        type: "error",
        code: "RIGHT_CUTOUT_WIDTH_EXCEEDS_DOOR",
        message: `Right cutout width (${rcw}mm) must be less than or equal to door width (${width}mm).`,
        side: "right",
      });
    }
    if (rch > height) {
      issues.push({
        type: "error",
        code: "RIGHT_CUTOUT_HEIGHT_EXCEEDS_DOOR",
        message: `Right cutout height (${rch}mm) must be less than or equal to door height (${height}mm).`,
        side: "right",
      });
    }

    const rightShortSide = height - rch;
    if (rightShortSide < MIN_SHORT_SIDE_HEIGHT_MM) {
      issues.push({
        type: "error",
        code: "RIGHT_SHORT_SIDE_TOO_SHORT",
        message: `Right short side (${Math.round(rightShortSide)}mm) is below minimum ${MIN_SHORT_SIDE_HEIGHT_MM}mm.`,
        side: "right",
      });
    }



    if (rcw > 0 && rch > 0) {
      const hypotenuse = Math.sqrt(rcw * rcw + rch * rch);
      if (rightAngledRailWidth > hypotenuse * 0.6) {
        issues.push({
          type: "warning",
          code: "RIGHT_ANGLED_RAIL_TOO_WIDE",
          message: `Right angled rail (${rightAngledRailWidth}mm) is >60% of hypotenuse (${hypotenuse.toFixed(0)}mm).`,
          side: "right",
        });
      }
      if (rightAngledRailWidth >= hypotenuse * 0.9) {
        issues.push({
          type: "error",
          code: "RIGHT_ANGLED_RAIL_EXCEEDS_HYPOTENUSE",
          message: `Right angled rail (${rightAngledRailWidth}mm) is too close to hypotenuse (${hypotenuse.toFixed(0)}mm).`,
          side: "right",
        });
      }
    }


  }

  // ---- COMBINED VALIDATION ----
  if (angledLeft && angledRight) {
    const lcw = leftTriangleCutoutWidth;
    const rcw = rightTriangleCutoutWidth;

    if (lcw + rcw > width) {
      issues.push({
        type: "error",
        code: "COMBINED_CUTOUTS_EXCEED_WIDTH",
        message: `Combined cutout widths (${lcw} + ${rcw} = ${lcw + rcw}mm) exceed door width (${width}mm).`,
        side: "both",
      });
    }

    if (panelType !== "NONE") {
      const remainingWidth = width - lcw - rcw;
      if (remainingWidth < effLeftStile + effRightStile + MIN_PANEL_OPENING_MM) {
        issues.push({
          type: "error",
          code: "COMBINED_NO_PANEL_ROOM",
          message: `Both angles leave only ${Math.round(remainingWidth)}mm — not enough for borders and panel.`,
          side: "both",
        });
      }
    }


  }

  // ---- HINGE IN CUTOUT ZONE ----
  if (hingeDrilling && hinges.length > 0) {
    hinges.forEach((hinge) => {
      let angleCutoutH = 0;
      let angleCutoutW = 0;
      if (hinge.side === "LEFT" && angledLeft) {
        angleCutoutH = leftTriangleCutoutHeight;
        angleCutoutW = leftTriangleCutoutWidth;
      } else if (hinge.side === "RIGHT" && angledRight) {
        angleCutoutH = rightTriangleCutoutHeight;
        angleCutoutW = rightTriangleCutoutWidth;
      }

      if (angleCutoutH > 0 && angleCutoutW > 0) {
        const cupRadius = HINGE_CUP_DIAMETER_MM / 2;
        const transitionY = height - angleCutoutH;

        // TOP reference is relative to the shoulder
        const hingeAbsY =
          hinge.reference === "BOTTOM"
            ? hinge.positionMm
            : height - angleCutoutH - hinge.positionMm;

        const hingeTopEdge = hingeAbsY + cupRadius;

        if (hingeTopEdge > transitionY) {
          const sideName = hinge.side === "LEFT" ? "left" : "right";
          issues.push({
            type: "error",
            code: `HINGE_IN_${hinge.side}_CUTOUT`,
            message: `Hinge at ${hinge.positionMm}mm from ${hinge.reference.toLowerCase()} falls in the ${sideName} angled cutout zone. Move it down or adjust the angle.`,
            side: sideName as "left" | "right",
          });
        }
      }
    });
  }

  // ---- MID RAILS IN ANGLED ZONE ----
  // Removed strict validation to allow midrails to run into angled sections

  return issues;
}

// ============================================
// CLAMPING HELPERS
// ============================================

function clampCutoutWidth(
  value: number,
  doorWidth: number,
  otherCutoutWidth: number,
  _side: "left" | "right"
): number {
  const v = safeNum(value, 0);
  if (v <= 0) return 0;
  const dw = safeNum(doorWidth, 600);
  const other = safeNum(otherCutoutWidth, 0);
  const maxFromDoor = dw - MIN_MATERIAL_BRIDGE_MM;
  const maxFromOverlap = dw - other - MIN_MATERIAL_BRIDGE_MM;
  const max = Math.max(MIN_CUTOUT_DIMENSION_MM, Math.min(maxFromDoor, maxFromOverlap));
  return clamp(v, MIN_CUTOUT_DIMENSION_MM, max);
}

function clampCutoutHeight(value: number, doorHeight: number): number {
  const v = safeNum(value, 0);
  if (v <= 0) return 0;
  const dh = safeNum(doorHeight, 720);
  const max = dh - MIN_SHORT_SIDE_HEIGHT_MM;
  return clamp(v, MIN_CUTOUT_DIMENSION_MM, Math.max(MIN_CUTOUT_DIMENSION_MM, max));
}

function clampAngledRailWidth(
  value: number,
  cutoutWidth: number,
  cutoutHeight: number
): number {
  const v = safeNum(value, 90);
  const cw = safeNum(cutoutWidth, 0);
  const ch = safeNum(cutoutHeight, 0);
  if (cw <= 0 || ch <= 0) return clamp(v, 30, 300);
  const hypotenuse = Math.sqrt(cw * cw + ch * ch);
  const maxRail = hypotenuse * 0.85;
  return clamp(v, 30, Math.max(30, maxRail));
}

// ============================================
// STORE ACTIONS TYPE
// ============================================

interface DoorConfigActions {
  setWidth: (w: number) => void;
  setHeight: (h: number) => void;
  setThickness: (t: 18 | 22) => void;
  setPanelType: (p: PanelType) => void;
  setBorderWidth: (w: number) => void;
  setCustomBorders: (c: boolean) => void;
  setLeftStile: (v: number) => void;
  setRightStile: (v: number) => void;
  setTopRail: (v: number) => void;
  setBottomRail: (v: number) => void;
  setAngledLeft: (v: boolean) => void;
  setAngledRight: (v: boolean) => void;
  setLeftTriangleCutoutWidth: (v: number) => void;
  setLeftTriangleCutoutHeight: (v: number) => void;
  setLeftAngleDegrees: (deg: number) => void;
  setRightTriangleCutoutWidth: (v: number) => void;
  setRightTriangleCutoutHeight: (v: number) => void;
  setRightAngleDegrees: (deg: number) => void;
  setLeftAngledRailWidth: (v: number) => void;
  setRightAngledRailWidth: (v: number) => void;
  setMidRailsEnabled: (v: boolean) => void;
  setMidRailsEqualise: (v: boolean) => void;
  addMidRail: () => void;
  removeMidRail: (id: string) => void;
  updateMidRail: (id: string, field: keyof MidRail, value: number) => void;
  setHingeDrilling: (v: boolean) => void;
  addHinge: (reference: HingeReference) => void;
  removeHinge: (id: string) => void;
  updateHinge: (id: string, field: string, value: any) => void;
  swapHingeSide: () => void;
  equaliseHinges: () => void;
  setHinges: (h: HingePosition[]) => void;
  setFinish: (f: FinishOption) => void;
  setShowDimensions: (v: boolean) => void;
  setRebateWidth: (v: number) => void;
  setRebateDepth: (v: number) => void;
  setFrontFaceThickness: (v: number) => void;
  setCornerRadius: (v: number) => void;
  setRearCornerRadius: (v: number) => void;
  setSelectedSection: (s: string) => void;
  resetConfig: () => void;
  getMinBorderForSide: (side: "LEFT" | "RIGHT" | "TOP" | "BOTTOM") => number;
  getMaxCutoutWidth: (side: "left" | "right") => number;
  getMaxCutoutHeight: (side: "left" | "right") => number;
  getAngleSafeHingeRange: (side: "LEFT" | "RIGHT") => { min: number; max: number };
  getMaxMidRailPosition: () => number;
  revalidateAngles: () => void;
  setEditingCartItem: (id: string | null) => void;
  loadFromCartItem: (item: any) => void;
}

// ============================================
// DEFAULT CONFIG
// ============================================

const defaultConfig: DoorConfig = {
  width: 600,
  height: 720,
  thickness: 22,
  panelType: "STANDARD_12MM",
  panelCount: 1,
  panelOrientation: "vertical",
  borderWidth: 90,
  customBorders: false,
  leftStile: 90,
  rightStile: 90,
  topRail: 90,
  bottomRail: 90,
  angledLeft: false,
  angledRight: false,
  leftTriangleCutoutWidth: 0,
  leftTriangleCutoutHeight: 0,
  rightTriangleCutoutWidth: 0,
  rightTriangleCutoutHeight: 0,
  leftAngleDegrees: 0,
  rightAngleDegrees: 0,
  leftAngledRailWidth: 90,
  rightAngledRailWidth: 90,
  midRailsEnabled: false,
  midRailsEqualise: false,
  midRails: [],
  hingeDrilling: false,
  hinges: [],
  intendedHingeSide: "LEFT",
  finish: "RAW_UNASSEMBLED",
  showDimensions: true,
  rebateWidthMm: 11,
  rebateDepthMm: 10,
  frontFaceThicknessMm: 12,
  cornerRadiusMm: 2.5,
  rearCornerRadiusMm: 2.5,
  selectedSection: "dimensions",
  angleValidationIssues: [],
  price: 0,
  isNewSession: true,
  editingCartItemId: null,
  _hasInteracted: false,
};

// ============================================
// HELPERS
// ============================================

function internalCalculatePrice(state: DoorConfig): number {
  try {
    const result = calculateDoorPrice({
      width: state.width,
      height: state.height,
      thickness: state.thickness,
      preset: (state as any).preset || "single", // Handle preset if it's external
      panelType: state.panelType,
      panelCount: state.panelCount,
      borderWidth: state.borderWidth,
      customBorders: state.customBorders,
      leftStile: state.leftStile,
      rightStile: state.rightStile,
      topRail: state.topRail,
      bottomRail: state.bottomRail,
      rebateWidthMm: state.rebateWidthMm,
      rebateDepthMm: state.rebateDepthMm,
      frontFaceThicknessMm: state.frontFaceThicknessMm,
      cornerRadiusMm: state.cornerRadiusMm,
      rearCornerRadiusMm: state.rearCornerRadiusMm,
      angledLeft: state.angledLeft,
      angledRight: state.angledRight,
      leftTriangleCutoutWidth: state.leftTriangleCutoutWidth,
      leftTriangleCutoutHeight: state.leftTriangleCutoutHeight,
      rightTriangleCutoutWidth: state.rightTriangleCutoutWidth,
      rightTriangleCutoutHeight: state.rightTriangleCutoutHeight,
      leftAngleDegrees: state.leftAngleDegrees,
      rightAngleDegrees: state.rightAngleDegrees,
      leftAngledRailWidth: state.leftAngledRailWidth,
      rightAngledRailWidth: state.rightAngledRailWidth,
      midRailsEnabled: state.midRailsEnabled,
      midRails: state.midRails,
      hingeDrilling: state.hingeDrilling,
      hinges: state.hinges,
      material: "MDF",
      finish: state.finish,
      showDimensions: state.showDimensions,
      price: 0,
    } as any);
    return result.unitTotal;
  } catch (e) {
    console.error("Price calculation failed", e);
    return 0;
  }
}

// ============================================
// STORE
// ============================================

export const useDoorConfig = create<DoorConfig & DoorConfigActions>()(
  subscribeWithSelector((set, get) => ({
    ...defaultConfig,

    setWidth: (w) =>
      set((state) => {
        const clamped = clamp(w, MIN_WIDTH_MM, MAX_WIDTH_MM);
        const lcw = state.angledLeft
          ? clampCutoutWidth(state.leftTriangleCutoutWidth, clamped, state.rightTriangleCutoutWidth, "left")
          : state.leftTriangleCutoutWidth;
        const rcw = state.angledRight
          ? clampCutoutWidth(state.rightTriangleCutoutWidth, clamped, lcw, "right")
          : state.rightTriangleCutoutWidth;
        const newState = {
          ...state,
          width: clamped,
          leftTriangleCutoutWidth: lcw,
          rightTriangleCutoutWidth: rcw,
          leftAngleDegrees: calculateAngleDegrees(lcw, state.leftTriangleCutoutHeight),
          rightAngleDegrees: calculateAngleDegrees(rcw, state.rightTriangleCutoutHeight),
          isNewSession: false,
          _hasInteracted: true,
        };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setHeight: (h) =>
      set((state) => {
        const clamped = clamp(h, MIN_HEIGHT_MM, MAX_HEIGHT_MM);
        const lch = state.angledLeft
          ? clampCutoutHeight(state.leftTriangleCutoutHeight, clamped)
          : state.leftTriangleCutoutHeight;
        const rch = state.angledRight
          ? clampCutoutHeight(state.rightTriangleCutoutHeight, clamped)
          : state.rightTriangleCutoutHeight;
        const newState = {
          ...state,
          height: clamped,
          leftTriangleCutoutHeight: lch,
          rightTriangleCutoutHeight: rch,
          leftAngleDegrees: calculateAngleDegrees(state.leftTriangleCutoutWidth, lch),
          rightAngleDegrees: calculateAngleDegrees(state.rightTriangleCutoutWidth, rch),
          isNewSession: false,
          _hasInteracted: true,
        };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setThickness: (t) => set((state) => {
      const newState = { ...state, thickness: t, isNewSession: false, _hasInteracted: true };
      return {
        ...newState,
        price: internalCalculatePrice(newState),
      };
    }),

    setPanelType: (p) =>
      set((state) => {
        const updates: Partial<DoorConfig> = { panelType: p, isNewSession: false, _hasInteracted: true };
        if ((p === "REEDED_19MM" || p === "MELAMINE_18MM") && state.thickness !== 22) {
          updates.thickness = 22;
        }
        const newState = { ...state, ...updates };
        return {
          ...updates,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setBorderWidth: (w) =>
      set((state) => {
        const min = Math.max(
          state.getMinBorderForSide("LEFT"),
          state.getMinBorderForSide("RIGHT"),
          state.getMinBorderForSide("TOP"),
          state.getMinBorderForSide("BOTTOM")
        );
        const clamped = Math.max(min, safeNum(w, min));
        
        // Also apply default border width to angled rails and mid-rails to enforce global consistency
        const updatedMidRails = state.midRails.map(rail => ({
          ...rail,
          dimension: clamped
        }));

        const newState = {
          ...state,
          borderWidth: clamped,
          leftStile: clamped,
          rightStile: clamped,
          topRail: clamped,
          bottomRail: clamped,
          leftAngledRailWidth: clamped,
          rightAngledRailWidth: clamped,
          midRails: updatedMidRails,
          isNewSession: false,
          _hasInteracted: true,
        };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setCustomBorders: (c) => set({ customBorders: c, isNewSession: false, _hasInteracted: true }),

    setLeftStile: (v) =>
      set((state) => {
        const min = state.getMinBorderForSide("LEFT");
        const val = Math.max(min, safeNum(v, min));
        const newState = { ...state, leftStile: val, isNewSession: false, _hasInteracted: true };
        return {
          leftStile: val,
          isNewSession: false,
          _hasInteracted: true,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setRightStile: (v) =>
      set((state) => {
        const min = state.getMinBorderForSide("RIGHT");
        const val = Math.max(min, safeNum(v, min));
        const newState = { ...state, rightStile: val, isNewSession: false, _hasInteracted: true };
        return {
          rightStile: val,
          isNewSession: false,
          _hasInteracted: true,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setTopRail: (v) =>
      set((state) => {
        const min = state.getMinBorderForSide("TOP");
        const val = Math.max(min, safeNum(v, min));
        const newState = { ...state, topRail: val, isNewSession: false, _hasInteracted: true };
        return {
          topRail: val,
          isNewSession: false,
          _hasInteracted: true,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setBottomRail: (v) =>
      set((state) => {
        const min = state.getMinBorderForSide("BOTTOM");
        const val = Math.max(min, safeNum(v, min));
        const newState = { ...state, bottomRail: val, isNewSession: false, _hasInteracted: true };
        return {
          bottomRail: val,
          isNewSession: false,
          _hasInteracted: true,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setAngledLeft: (v) =>
      set((state) => {
        if (v) {
          const lcw = state.leftTriangleCutoutWidth > 0
            ? state.leftTriangleCutoutWidth
            : Math.min(100, state.width * 0.3);
          const lch = state.leftTriangleCutoutHeight > 0
            ? state.leftTriangleCutoutHeight
            : Math.min(100, state.height * 0.3);
          const clampedW = clampCutoutWidth(lcw, state.width, state.rightTriangleCutoutWidth, "left");
          const clampedH = clampCutoutHeight(lch, state.height);
          const deg = calculateAngleDegrees(clampedW, clampedH);
          const newState = {
            ...state,
            angledLeft: true,
            leftTriangleCutoutWidth: clampedW,
            leftTriangleCutoutHeight: clampedH,
            leftAngleDegrees: deg,
            isNewSession: false,
            _hasInteracted: true,
          };
          return {
            ...newState,
            angleValidationIssues: validateAngledCorners(newState),
            price: internalCalculatePrice(newState),
          };
        } else {
          const newState = {
            ...state,
            angledLeft: false,
            leftTriangleCutoutWidth: 0,
            leftTriangleCutoutHeight: 0,
            leftAngleDegrees: 0,
            isNewSession: false,
            _hasInteracted: true,
          };
          return {
            ...newState,
            angleValidationIssues: validateAngledCorners(newState),
            price: internalCalculatePrice(newState),
          };
        }
      }),

    setAngledRight: (v) =>
      set((state) => {
        if (v) {
          const maxW = state.getMaxCutoutWidth("right");
          const maxH = state.getMaxCutoutHeight("right");
          const clampedW = clamp(state.rightTriangleCutoutWidth || 100, MIN_CUTOUT_DIMENSION_MM, maxW);
          const clampedH = clamp(state.rightTriangleCutoutHeight || 100, MIN_CUTOUT_DIMENSION_MM, maxH);
          const deg = calculateAngleDegrees(clampedW, clampedH);

          const newState = {
            ...state,
            angledRight: true,
            rightTriangleCutoutWidth: clampedW,
            rightTriangleCutoutHeight: clampedH,
            rightAngleDegrees: deg,
            isNewSession: false,
            _hasInteracted: true,
          };
          return {
            ...newState,
            angleValidationIssues: validateAngledCorners(newState),
            price: internalCalculatePrice(newState),
          };
        } else {
          const newState = {
            ...state,
            angledRight: false,
            rightTriangleCutoutWidth: 0,
            rightTriangleCutoutHeight: 0,
            rightAngleDegrees: 0,
            isNewSession: false,
            _hasInteracted: true,
          };
          return {
            ...newState,
            angleValidationIssues: validateAngledCorners(newState),
            price: internalCalculatePrice(newState),
          };
        }
      }),

    setLeftTriangleCutoutWidth: (v) =>
      set((state) => {
        const clamped = clampCutoutWidth(v, state.width, state.rightTriangleCutoutWidth, "left");
        const newState = {
          ...state,
          leftTriangleCutoutWidth: clamped,
          leftAngleDegrees: calculateAngleDegrees(clamped, state.leftTriangleCutoutHeight),
          isNewSession: false,
          _hasInteracted: true,
        };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setLeftTriangleCutoutHeight: (v) =>
      set((state) => {
        const clamped = clampCutoutHeight(v, state.height);
        const deg = calculateAngleDegrees(state.leftTriangleCutoutWidth, clamped);
        const rail = clampAngledRailWidth(state.leftAngledRailWidth, state.leftTriangleCutoutWidth, clamped);
        const newState = { ...state, leftTriangleCutoutHeight: clamped, leftAngleDegrees: deg, leftAngledRailWidth: rail, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setLeftAngleDegrees: (deg) =>
      set((state) => {
        const clampedDeg = clamp(deg, MIN_ANGLE_DEGREES, MAX_ANGLE_DEGREES);
        const h = state.leftTriangleCutoutHeight || 100;
        const rad = (clampedDeg * Math.PI) / 180;
        // width = height / tan(angle)
        const w = h / Math.tan(rad);
        const clampedW = clampCutoutWidth(w, state.width, state.rightTriangleCutoutWidth, "left");

        // After clamping width, simple tan(rad) might not hold perfectly, re-calc actual angle
        const finalDeg = calculateAngleDegrees(clampedW, h);

        const newState = {
          ...state,
          leftTriangleCutoutWidth: parseFloat(clampedW.toFixed(2)),
          leftAngleDegrees: parseFloat(finalDeg.toFixed(2)),
          isNewSession: false,
          _hasInteracted: true,
        };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setRightTriangleCutoutWidth: (v) =>
      set((state) => {
        const clamped = clampCutoutWidth(v, state.width, state.leftTriangleCutoutWidth, "right");
        const newState = {
          ...state,
          rightTriangleCutoutWidth: clamped,
          rightAngleDegrees: calculateAngleDegrees(clamped, state.rightTriangleCutoutHeight),
          isNewSession: false,
          _hasInteracted: true,
        };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setRightTriangleCutoutHeight: (v) =>
      set((state) => {
        const clamped = clampCutoutHeight(v, state.height);
        const deg = calculateAngleDegrees(state.rightTriangleCutoutWidth, clamped);
        const rail = clampAngledRailWidth(state.rightAngledRailWidth, state.rightTriangleCutoutWidth, clamped);
        const newState = { ...state, rightTriangleCutoutHeight: clamped, rightAngleDegrees: deg, rightAngledRailWidth: rail, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setRightAngleDegrees: (deg) =>
      set((state) => {
        const clampedDeg = clamp(deg, MIN_ANGLE_DEGREES, MAX_ANGLE_DEGREES);
        const h = state.rightTriangleCutoutHeight || 100;
        const rad = (clampedDeg * Math.PI) / 180;
        const w = h / Math.tan(rad);
        const clampedW = clampCutoutWidth(w, state.width, state.leftTriangleCutoutWidth, "right");

        const finalDeg = calculateAngleDegrees(clampedW, h);

        const newState = {
          ...state,
          rightTriangleCutoutWidth: parseFloat(clampedW.toFixed(2)),
          rightAngleDegrees: parseFloat(finalDeg.toFixed(2)),
          isNewSession: false,
          _hasInteracted: true,
        };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setLeftAngledRailWidth: (v) =>
      set((state) => {
        const clamped = clampAngledRailWidth(v, state.leftTriangleCutoutWidth, state.leftTriangleCutoutHeight);
        const newState = { ...state, leftAngledRailWidth: clamped, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setRightAngledRailWidth: (v) =>
      set((state) => {
        const clamped = clampAngledRailWidth(v, state.rightTriangleCutoutWidth, state.rightTriangleCutoutHeight);
        const newState = { ...state, rightAngledRailWidth: clamped, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setMidRailsEnabled: (v) =>
      set((state) => {
        const newState = { ...state, midRailsEnabled: v, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          price: internalCalculatePrice(newState),
        };
      }),

    setMidRailsEqualise: (v) =>
      set((state) => {
        if (!v) return { midRailsEqualise: false, isNewSession: false, _hasInteracted: true };
        const count = state.midRails.length;
        if (count === 0) return { midRailsEqualise: true, isNewSession: false, _hasInteracted: true };
        const effBottom = state.customBorders ? state.bottomRail : state.borderWidth;
        const effTop = state.customBorders ? state.topRail : state.borderWidth;
        // Calculate available panel height (full height between rails)
        const panelTop = state.height - effTop;
        const panelBottom = effBottom;
        const availableHeight = panelTop - panelBottom;
        if (availableHeight <= 0) return { midRailsEqualise: true, isNewSession: false, _hasInteracted: true };
        // Sort rails so we can position them bottom-to-top
        const sorted = state.midRails.slice().sort((a, b) => a.positionFromBottom - b.positionFromBottom);
        // Calculate total rail dimension (all rails' physical widths)
        const totalRailDim = sorted.reduce((sum, r) => sum + r.dimension, 0);
        // Net panel area = total available minus all rail widths
        const netPanelArea = Math.max(0, availableHeight - totalRailDim);
        // Equal gap between each rail/border edge (count + 1 gaps)
        const gap = parseFloat((netPanelArea / (count + 1)).toFixed(2));
        // Position each rail: accumulate gaps and previous rails
        let cursor = panelBottom;
        const newRails = sorted.map((r) => {
          cursor += gap; // gap before this rail
          const pos = parseFloat(cursor.toFixed(2));
          cursor += r.dimension; // skip over this rail's width
          return { ...r, positionFromBottom: pos };
        });
        const newState = {
          ...state,
          midRailsEqualise: true,
          midRails: newRails,
          isNewSession: false,
          _hasInteracted: true,
        };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    addMidRail: () =>
      set((state) => {
        const id = crypto.randomUUID();
        const effBottom = state.customBorders ? state.bottomRail : state.borderWidth;
        const effTop = state.customBorders ? state.topRail : state.borderWidth;
        const maxPos = state.height - effTop - 35;
        // Default: 100mm above the highest existing rail, or 100mm above bottom border
        let pos: number;
        if (state.midRails.length > 0) {
          const highestRail = Math.max(...state.midRails.map(r => r.positionFromBottom + r.dimension));
          pos = Math.min(highestRail + 100, maxPos);
        } else {
          pos = Math.min(effBottom + 100, maxPos);
        }
        pos = Math.max(pos, effBottom + 10); // ensure above bottom frame
        const newRails = [...state.midRails, { id, positionFromBottom: parseFloat(pos.toFixed(2)), dimension: 70 }];
        // If equaliser is ON, re-equalise after adding
        let finalRails = newRails;
        if (state.midRailsEqualise) {
          const panelTop = state.height - effTop;
          const panelBottom = effBottom;
          const availableHeight = panelTop - panelBottom;
          const sorted = finalRails.slice().sort((a, b) => a.positionFromBottom - b.positionFromBottom);
          const totalRailDim = sorted.reduce((sum, r) => sum + r.dimension, 0);
          const netPanelArea = Math.max(0, availableHeight - totalRailDim);
          const gap = parseFloat((netPanelArea / (sorted.length + 1)).toFixed(2));
          let cursor = panelBottom;
          finalRails = sorted.map((r) => {
            cursor += gap;
            const pos = parseFloat(cursor.toFixed(2));
            cursor += r.dimension;
            return { ...r, positionFromBottom: pos };
          });
        }
        const newState = { ...state, midRails: finalRails, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    removeMidRail: (id) =>
      set((state) => {
        const newRails = state.midRails.filter((r) => r.id !== id);
        const newState = { ...state, midRails: newRails, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    updateMidRail: (id, field, value) =>
      set((state) => {
        const newRails = state.midRails.map((r) => (r.id === id ? { ...r, [field]: value } : r));
        const newState = { ...state, midRails: newRails, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setHingeDrilling: (v) =>
      set((state) => {
        if (v && state.hinges.length === 0) {
          const side = state.intendedHingeSide;
          const defaultHinges: HingePosition[] = [
            { id: crypto.randomUUID(), side, reference: "TOP", positionMm: 100, type: "SCREW_POINTS" },
            { id: crypto.randomUUID(), side, reference: "BOTTOM", positionMm: 100, type: "SCREW_POINTS" },
          ];
          const newState = { ...state, hingeDrilling: true, hinges: defaultHinges, isNewSession: false, _hasInteracted: true };
          return {
            ...newState,
            angleValidationIssues: validateAngledCorners(newState),
            price: internalCalculatePrice(newState),
          };
        }
        const newState = { ...state, hingeDrilling: v, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    addHinge: (reference) =>
      set((state) => {
        const side = state.intendedHingeSide;
        const type = state.hinges.length > 0 ? state.hinges[0].type : "SCREW_POINTS";
        const sameRef = state.hinges.filter((h) => h.reference === reference);
        const lastPos = sameRef.length > 0 ? Math.max(...sameRef.map((h) => h.positionMm)) : 0;
        let maxPos = state.height - 50;
        if (side === "LEFT" && state.angledLeft && reference === "TOP") {
          maxPos = state.height - safeNum(state.leftTriangleCutoutHeight, 0) - HINGE_CUP_DIAMETER_MM;
        }
        if (side === "RIGHT" && state.angledRight && reference === "TOP") {
          maxPos = state.height - safeNum(state.rightTriangleCutoutHeight, 0) - HINGE_CUP_DIAMETER_MM;
        }
        // Default 100mm spacing from the last hinge
        const newPos = Math.min(lastPos + 100, maxPos);
        const newHinges = [
          ...state.hinges,
          { id: crypto.randomUUID(), side, reference, positionMm: Math.max(50, newPos), type },
        ];
        const newState = { ...state, hinges: newHinges, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    removeHinge: (id) =>
      set((state) => {
        const newHinges = state.hinges.filter((h) => h.id !== id);
        const newState = { ...state, hinges: newHinges, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    updateHinge: (id, field, value) =>
      set((state) => {
        if (field === "side") {
          const updated = state.hinges.map((h) => ({ ...h, side: value }));
          const newState = { ...state, hinges: updated, isNewSession: false, _hasInteracted: true };
          return {
            ...newState,
            angleValidationIssues: validateAngledCorners(newState),
            price: internalCalculatePrice(newState),
          };
        }
        const newHinges = state.hinges.map((h) => (h.id === id ? { ...h, [field]: value } : h));
        const newState = { ...state, hinges: newHinges, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    swapHingeSide: () =>
      set((state) => {
        const newSide: HingeSide = state.intendedHingeSide === "LEFT" ? "RIGHT" : "LEFT";
        const newHinges = state.hinges.map((h) => ({ ...h, side: newSide }));
        const newState = { ...state, hinges: newHinges, intendedHingeSide: newSide, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    equaliseHinges: () =>
      set((state) => {
        if (state.hinges.length < 2) return { isNewSession: false, _hasInteracted: true };
        const count = state.hinges.length;
        const minY = 50;
        // Calculate max safe Y from bottom, respecting angle cutout on hinge side
        let maxY = state.height - 50;
        const hingeSide = state.hinges[0]?.side || "LEFT";
        if (hingeSide === "LEFT" && state.angledLeft && safeNum(state.leftTriangleCutoutHeight, 0) > 0) {
          maxY = Math.min(maxY, state.height - safeNum(state.leftTriangleCutoutHeight, 0) - HINGE_CUP_DIAMETER_MM);
        }
        if (hingeSide === "RIGHT" && state.angledRight && safeNum(state.rightTriangleCutoutHeight, 0) > 0) {
          maxY = Math.min(maxY, state.height - safeNum(state.rightTriangleCutoutHeight, 0) - HINGE_CUP_DIAMETER_MM);
        }
        maxY = Math.max(maxY, minY + 50); // ensure minimum span
        const totalSpan = maxY - minY;
        const spacing = totalSpan / (count - 1);
        const sorted = [...state.hinges].sort((a, b) => {
          let aCutoutH = 0;
          if (a.side === "LEFT" && state.angledLeft) aCutoutH = safeNum(state.leftTriangleCutoutHeight, 0);
          else if (a.side === "RIGHT" && state.angledRight) aCutoutH = safeNum(state.rightTriangleCutoutHeight, 0);
          
          let bCutoutH = 0;
          if (b.side === "LEFT" && state.angledLeft) bCutoutH = safeNum(state.leftTriangleCutoutHeight, 0);
          else if (b.side === "RIGHT" && state.angledRight) bCutoutH = safeNum(state.rightTriangleCutoutHeight, 0);

          const aY = a.reference === "BOTTOM" ? a.positionMm : (state.height - aCutoutH) - a.positionMm;
          const bY = b.reference === "BOTTOM" ? b.positionMm : (state.height - bCutoutH) - b.positionMm;
          return aY - bY;
        });
        const newHinges = sorted.map((h, i) => {
          const targetY = minY + spacing * i;
          let hCutoutH = 0;
          if (h.side === "LEFT" && state.angledLeft) hCutoutH = safeNum(state.leftTriangleCutoutHeight, 0);
          else if (h.side === "RIGHT" && state.angledRight) hCutoutH = safeNum(state.rightTriangleCutoutHeight, 0);
          
          const shoulderY = state.height - hCutoutH;
          const posMm = h.reference === "BOTTOM" ? targetY : shoulderY - targetY;
          return {
            ...h,
            positionMm: parseFloat(posMm.toFixed(2)),
          };
        });
        const newState = { ...state, hinges: newHinges, isNewSession: false, _hasInteracted: true };
        return {
          ...newState,
          angleValidationIssues: validateAngledCorners(newState),
          price: internalCalculatePrice(newState),
        };
      }),

    setHinges: (h) => set((state) => {
      const newState = { ...state, hinges: h, isNewSession: false, _hasInteracted: true };
      return {
        ...newState,
        price: internalCalculatePrice(newState),
      };
    }),

    setFinish: (f) => set((state) => {
      const newState = { ...state, finish: f, isNewSession: false, _hasInteracted: true };
      return {
        ...newState,
        price: internalCalculatePrice(newState),
      };
    }),
    setShowDimensions: (v) => set({ showDimensions: v }),
    setRebateWidth: (v) => set((state) => {
      const newState = { ...state, rebateWidthMm: v, isNewSession: false, _hasInteracted: true };
      return {
        ...newState,
        price: internalCalculatePrice(newState),
      };
    }),
    setRebateDepth: (v) => set((state) => {
      const newState = { ...state, rebateDepthMm: v, isNewSession: false, _hasInteracted: true };
      return {
        ...newState,
        price: internalCalculatePrice(newState),
      };
    }),
    setFrontFaceThickness: (v) => set((state) => {
      const newState = { ...state, frontFaceThicknessMm: v, isNewSession: false, _hasInteracted: true };
      return {
        ...newState,
        price: internalCalculatePrice(newState),
      };
    }),
    setCornerRadius: (v) => set((state) => {
      const newState = { ...state, cornerRadiusMm: v, isNewSession: false, _hasInteracted: true };
      return {
        ...newState,
        price: internalCalculatePrice(newState),
      };
    }),
    setRearCornerRadius: (v) => set((state) => {
      const newState = { ...state, rearCornerRadiusMm: v, isNewSession: false, _hasInteracted: true };
      return {
        ...newState,
        price: internalCalculatePrice(newState),
      };
    }),
    setSelectedSection: (s) => set({ selectedSection: s }),
    setEditingCartItem: (id) => set({ editingCartItemId: id }),
    loadFromCartItem: (item) => set((state) => {
      // Load all config properties from item into the store config
      const newState = {
        ...state,
        width: item.width,
        height: item.height,
        thickness: item.thickness,
        panelType: item.panelType,
        panelCount: item.panelCount,
        panelOrientation: item.panelOrientation,
        borderWidth: item.borderWidth,
        customBorders: item.customBorders,
        leftStile: item.leftStile,
        rightStile: item.rightStile,
        topRail: item.topRail,
        bottomRail: item.bottomRail,
        angledLeft: item.angledLeft,
        angledRight: item.angledRight,
        leftTriangleCutoutWidth: item.leftTriangleCutoutWidth,
        leftTriangleCutoutHeight: item.leftTriangleCutoutHeight,
        rightTriangleCutoutWidth: item.rightTriangleCutoutWidth,
        rightTriangleCutoutHeight: item.rightTriangleCutoutHeight,
        leftAngleDegrees: item.leftAngleDegrees,
        rightAngleDegrees: item.rightAngleDegrees,
        leftAngledRailWidth: item.leftAngledRailWidth,
        rightAngledRailWidth: item.rightAngledRailWidth,
        midRailsEnabled: item.midRailsEnabled,
        midRailsEqualise: item.midRailsEqualise,
        midRails: [...item.midRails],
        hingeDrilling: item.hingeDrilling,
        hinges: [...item.hinges],
        finish: item.finish,
        showDimensions: item.showDimensions,
        rebateWidthMm: item.rebateWidthMm,
        rebateDepthMm: item.rebateDepthMm,
        frontFaceThicknessMm: item.frontFaceThicknessMm,
        cornerRadiusMm: item.cornerRadiusMm,
        rearCornerRadiusMm: item.rearCornerRadiusMm,
        editingCartItemId: item.id,
        isNewSession: false,
        _hasInteracted: true,
      };

      return {
        ...newState,
        angleValidationIssues: validateAngledCorners(newState),
        price: internalCalculatePrice(newState),
      };
    }),
    resetConfig: () => set({ ...defaultConfig }),

    getMinBorderForSide: (side) => {
      const state = get();
      if (side === "LEFT" || side === "RIGHT") {
        if (state.hingeDrilling && state.hinges.some((h) => h.side === side)) {
          return MIN_BORDER_WITH_HINGES;
        }
      }
      return MIN_BORDER_WITHOUT_HINGES;
    },

    getMaxCutoutWidth: (side) => {
      const state = get();
      const otherWidth = side === "left" ? safeNum(state.rightTriangleCutoutWidth, 0) : safeNum(state.leftTriangleCutoutWidth, 0);
      return calculateMaxCutoutWidth(
        state.width,
        otherWidth,
        state.customBorders ? state.leftStile : state.borderWidth,
        state.customBorders ? state.rightStile : state.borderWidth,
        side
      );
    },

    getMaxCutoutHeight: (side) => {
      const state = get();
      return calculateMaxCutoutHeight(state.height, state.customBorders ? state.bottomRail : state.borderWidth);
    },

    getAngleSafeHingeRange: (side) => {
      const state = get();
      const cupRadius = HINGE_CUP_DIAMETER_MM / 2;
      let maxFromTop = state.height - 50;
      if (side === "LEFT" && state.angledLeft && safeNum(state.leftTriangleCutoutHeight, 0) > 0) {
        maxFromTop = state.height - safeNum(state.leftTriangleCutoutHeight, 0) - cupRadius - 5;
      }
      if (side === "RIGHT" && state.angledRight && safeNum(state.rightTriangleCutoutHeight, 0) > 0) {
        maxFromTop = state.height - safeNum(state.rightTriangleCutoutHeight, 0) - cupRadius - 5;
      }
      return { min: 50, max: Math.max(50, maxFromTop) };
    },

    getMaxMidRailPosition: () => {
      const state = get();
      const effTop = state.customBorders ? state.topRail : state.borderWidth;
      let maxY = state.height - effTop;
      if (state.angledLeft) maxY = Math.min(maxY, state.height - safeNum(state.leftTriangleCutoutHeight, 0));
      if (state.angledRight) maxY = Math.min(maxY, state.height - safeNum(state.rightTriangleCutoutHeight, 0));
      return Math.max(0, maxY);
    },

    revalidateAngles: () =>
      set((state) => ({
        angleValidationIssues: validateAngledCorners(state),
      })),
  }))
);