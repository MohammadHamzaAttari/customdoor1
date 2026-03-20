// client/src/components/door/sections/AngledCornersSection.tsx
import React from "react";
import {
  useDoorConfig,
  MIN_ANGLE_DEGREES,
  MAX_ANGLE_DEGREES,
  MIN_SHORT_SIDE_HEIGHT_MM,
  MIN_CUTOUT_DIMENSION_MM,
} from "@/lib/stores/useDoorConfig";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { NumberInput } from "@/components/ui/NumberInput";
import { PrecisionAnglePicker } from "../PrecisionAnglePicker";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Safe toFixed that never crashes */
function safeFix(val: unknown, decimals: number = 1): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(decimals);
}

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            onClick={(e) => e.preventDefault()}
          >
            <Info className="h-3 w-3 text-gray-500" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm" side="top">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AngledCornersSection() {
  const {
    width,
    height,
    angledLeft,
    angledRight,
    leftTriangleCutoutWidth,
    leftTriangleCutoutHeight,
    rightTriangleCutoutWidth,
    rightTriangleCutoutHeight,
    leftAngleDegrees,
    rightAngleDegrees,
    leftAngledRailWidth,
    rightAngledRailWidth,
    panelType,
    setAngledLeft,
    setAngledRight,
    setLeftTriangleCutoutWidth,
    setLeftTriangleCutoutHeight,
    setLeftAngleDegrees,
    setRightTriangleCutoutWidth,
    setRightTriangleCutoutHeight,
    setRightAngleDegrees,
    setLeftAngledRailWidth,
    setRightAngledRailWidth,
    getMaxCutoutWidth,
    getMaxCutoutHeight,
    angleValidationIssues,
  } = useDoorConfig();

  const [leftInputMode, setLeftInputMode] = React.useState<"dimensions" | "angle">("dimensions");
  const [rightInputMode, setRightInputMode] = React.useState<"dimensions" | "angle">("dimensions");

  // Safe defaults
  const safeLeftDeg = Number.isFinite(leftAngleDegrees) ? leftAngleDegrees : 0;
  const safeRightDeg = Number.isFinite(rightAngleDegrees) ? rightAngleDegrees : 0;
  const safeLeftCutoutW = Number.isFinite(leftTriangleCutoutWidth) ? leftTriangleCutoutWidth : 0;
  const safeLeftCutoutH = Number.isFinite(leftTriangleCutoutHeight) ? leftTriangleCutoutHeight : 0;
  const safeRightCutoutW = Number.isFinite(rightTriangleCutoutWidth) ? rightTriangleCutoutWidth : 0;
  const safeRightCutoutH = Number.isFinite(rightTriangleCutoutHeight) ? rightTriangleCutoutHeight : 0;
  const safeLeftRailW = Number.isFinite(leftAngledRailWidth) ? leftAngledRailWidth : 90;
  const safeRightRailW = Number.isFinite(rightAngledRailWidth) ? rightAngledRailWidth : 90;

  const issues = angleValidationIssues ?? [];
  const hasErrors = issues.some((i) => i.type === "error");
  const hasWarnings = issues.some((i) => i.type === "warning");
  const leftIssues = issues.filter((i) => i.side === "left" || i.side === "both");
  const rightIssues = issues.filter((i) => i.side === "right" || i.side === "both");

  const maxLeftCutoutWidth = getMaxCutoutWidth("left");
  const maxLeftCutoutHeight = getMaxCutoutHeight("left");
  const maxRightCutoutWidth = getMaxCutoutWidth("right");
  const maxRightCutoutHeight = getMaxCutoutHeight("right");

  const leftHypotenuse =
    safeLeftCutoutW > 0 && safeLeftCutoutH > 0
      ? Math.sqrt(safeLeftCutoutW * safeLeftCutoutW + safeLeftCutoutH * safeLeftCutoutH)
      : 0;
  const rightHypotenuse =
    safeRightCutoutW > 0 && safeRightCutoutH > 0
      ? Math.sqrt(safeRightCutoutW * safeRightCutoutW + safeRightCutoutH * safeRightCutoutH)
      : 0;

  const renderAngleStatus = (degrees: number) => {
    if (!Number.isFinite(degrees) || degrees <= 0) return null;
    const isSafe = degrees >= MIN_ANGLE_DEGREES && degrees <= MAX_ANGLE_DEGREES;
    return (
      <Badge
        variant={isSafe ? "secondary" : "destructive"}
        className={cn(
          "text-[10px] font-bold",
          isSafe ? "bg-green-50 text-green-700 border-green-200" : ""
        )}
      >
        {safeFix(degrees, 1)}°
        {isSafe ? (
          <CheckCircle2 className="w-3 h-3 ml-1" />
        ) : (
          <AlertTriangle className="w-3 h-3 ml-1" />
        )}
      </Badge>
    );
  };

  const calculateDynamicDimensions = () => {
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Global validation status */}
      {(angledLeft || angledRight) && (
        <div
          className={cn(
            "p-3 rounded-lg border flex items-start gap-2 mb-4",
            hasErrors
              ? "bg-red-50 border-red-200"
              : hasWarnings
                ? "bg-amber-50 border-amber-200"
                : "bg-green-50 border-green-200"
          )}
        >
          {hasErrors ? (
            <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          ) : hasWarnings ? (
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
          )}
          <div className="text-xs">
            {hasErrors ? (
              <span className="text-red-700 font-semibold">
                Configuration has errors that must be fixed before manufacturing.
              </span>
            ) : hasWarnings ? (
              <span className="text-amber-700 font-semibold">
                Configuration has warnings. Review before proceeding.
              </span>
            ) : (
              <span className="text-green-700 font-semibold">
                Angle configuration is valid for CNC manufacturing.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Data Readout */}
      {calculateDynamicDimensions()}

      {/* LEFT ANGLE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold text-gray-700">Left Angle</Label>
            {angledLeft && renderAngleStatus(safeLeftDeg)}
            <InfoTip>
              <p>
                Removes a triangular section from the top-left corner. The cutout width goes along
                the top edge, height goes down the left edge.
              </p>
            </InfoTip>
          </div>
          <Switch checked={angledLeft} onCheckedChange={setAngledLeft} />
        </div>

        {angledLeft && (
          <div className="space-y-4 pl-2 border-l-2 border-orange-200">
            {leftIssues.length > 0 && (
              <div className="space-y-1.5">
                {leftIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-md text-xs",
                      issue.type === "error"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    )}
                  >
                    {issue.type === "error" ? (
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            )}



            <Tabs
              value={leftInputMode}
              onValueChange={(v: string) => setLeftInputMode(v as "dimensions" | "angle")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-stone-100/50 p-1 h-9">
                <TabsTrigger value="dimensions" className="text-xs font-semibold py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Dimensions
                </TabsTrigger>
                <TabsTrigger value="angle" className="text-xs font-semibold py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Precision Angle
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dimensions" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500 font-medium">Cutout Width (mm)</Label>
                    <NumberInput
                      value={safeLeftCutoutW}
                      onChange={setLeftTriangleCutoutWidth}
                      min={MIN_CUTOUT_DIMENSION_MM}
                      max={maxLeftCutoutWidth}
                      unit="mm"
                      className="h-9"
                    />
                    <span className="text-[9px] text-gray-400">Max: {Math.round(maxLeftCutoutWidth)}mm</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500 font-medium">Cutout Height (mm)</Label>
                    <NumberInput
                      value={safeLeftCutoutH}
                      onChange={setLeftTriangleCutoutHeight}
                      min={MIN_CUTOUT_DIMENSION_MM}
                      max={maxLeftCutoutHeight}
                      unit="mm"
                      className="h-9"
                    />
                    <span className="text-[9px] text-gray-400">
                      Max: {Math.round(maxLeftCutoutHeight)}mm
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="angle" className="mt-0">
                <div className="flex justify-center p-4 bg-gradient-to-br from-stone-50/50 to-orange-50/30 rounded-xl border border-stone-100 ring-1 ring-white/50">
                  <PrecisionAnglePicker
                    label="Sweep Angle"
                    value={safeLeftDeg}
                    onChange={setLeftAngleDegrees}
                    min={MIN_ANGLE_DEGREES}
                    max={MAX_ANGLE_DEGREES}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {leftHypotenuse > 0 && (
              <div className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded">
                Hypotenuse: {safeFix(leftHypotenuse, 1)}mm | Angle: {safeFix(safeLeftDeg, 2)}°
              </div>
            )}

            {panelType !== "NONE" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500 font-medium">Angled Rail Width (mm)</Label>
                <NumberInput
                  value={safeLeftRailW}
                  onChange={setLeftAngledRailWidth}
                  min={30}
                  max={leftHypotenuse > 0 ? Math.round(leftHypotenuse * 0.85) : 300}
                  unit="mm"
                  className="h-9"
                />
                {leftHypotenuse > 0 && (
                  <span className="text-[9px] text-gray-400">
                    Max: {Math.round(leftHypotenuse * 0.85)}mm (85% of hypotenuse)
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT ANGLE */}
      <div className="space-y-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold text-gray-700">Right Angle</Label>
            {angledRight && renderAngleStatus(safeRightDeg)}
            <InfoTip>
              <p>
                Removes a triangular section from the top-right corner. The cutout width goes along
                the top edge, height goes down the right edge.
              </p>
            </InfoTip>
          </div>
          <Switch checked={angledRight} onCheckedChange={setAngledRight} />
        </div>

        {angledRight && (
          <div className="space-y-4 pl-2 border-l-2 border-purple-200">
            {rightIssues.length > 0 && (
              <div className="space-y-1.5">
                {rightIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-md text-xs",
                      issue.type === "error"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    )}
                  >
                    {issue.type === "error" ? (
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            )}



            <Tabs
              value={rightInputMode}
              onValueChange={(v: string) => setRightInputMode(v as "dimensions" | "angle")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-stone-100/50 p-1 h-9">
                <TabsTrigger value="dimensions" className="text-xs font-semibold py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Dimensions
                </TabsTrigger>
                <TabsTrigger value="angle" className="text-xs font-semibold py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Precision Angle
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dimensions" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500 font-medium">Cutout Width (mm)</Label>
                    <NumberInput
                      value={safeRightCutoutW}
                      onChange={setRightTriangleCutoutWidth}
                      min={MIN_CUTOUT_DIMENSION_MM}
                      max={maxRightCutoutWidth}
                      unit="mm"
                      className="h-9"
                    />
                    <span className="text-[9px] text-gray-400">Max: {Math.round(maxRightCutoutWidth)}mm</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500 font-medium">Cutout Height (mm)</Label>
                    <NumberInput
                      value={safeRightCutoutH}
                      onChange={setRightTriangleCutoutHeight}
                      min={MIN_CUTOUT_DIMENSION_MM}
                      max={maxRightCutoutHeight}
                      unit="mm"
                      className="h-9"
                    />
                    <span className="text-[9px] text-gray-400">
                      Max: {Math.round(maxRightCutoutHeight)}mm
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="angle" className="mt-0">
                <div className="flex justify-center p-4 bg-gradient-to-br from-stone-50/50 to-purple-50/30 rounded-xl border border-stone-100 ring-1 ring-white/50">
                  <PrecisionAnglePicker
                    label="Sweep Angle"
                    value={safeRightDeg}
                    onChange={setRightAngleDegrees}
                    min={MIN_ANGLE_DEGREES}
                    max={MAX_ANGLE_DEGREES}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {rightHypotenuse > 0 && (
              <div className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded">
                Hypotenuse: {safeFix(rightHypotenuse, 1)}mm | Angle: {safeFix(safeRightDeg, 2)}°
              </div>
            )}

            {panelType !== "NONE" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500 font-medium">Angled Rail Width (mm)</Label>
                <NumberInput
                  value={safeRightRailW}
                  onChange={setRightAngledRailWidth}
                  min={30}
                  max={rightHypotenuse > 0 ? Math.round(rightHypotenuse * 0.85) : 300}
                  unit="mm"
                  className="h-9"
                />
                {rightHypotenuse > 0 && (
                  <span className="text-[9px] text-gray-400">
                    Max: {Math.round(rightHypotenuse * 0.85)}mm (85% of hypotenuse)
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Combined angle overlap warning */}
      {angledLeft && angledRight && safeLeftCutoutW + safeRightCutoutW > width * 0.7 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-700">
            <strong>Overlap Risk:</strong> Combined cutout widths (
            {Math.round(safeLeftCutoutW + safeRightCutoutW)}mm) use{" "}
            {(((safeLeftCutoutW + safeRightCutoutW) / width) * 100).toFixed(0)}% of door width (
            {width}mm).
          </div>
        </div>
      )}
    </div>
  );
}