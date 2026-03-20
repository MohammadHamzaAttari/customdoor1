import { generateDoorSvg, SvgDoorConfig } from "./server/svgGenerator";
import fs from "fs";

// Match the user's config: 601x720, left angle ~9.45°, 1 mid-rail
const config: SvgDoorConfig = {
  width: 601,
  height: 720,
  thickness: 22,
  preset: "single",
  panelType: "STANDARD_12MM",
  panelCount: 1,
  shape: "angled",
  material: "MDF",
  finish: "RAW_UNASSEMBLED",
  angledLeft: true,
  angledRight: false,
  leftTriangleCutoutWidth: 100,
  leftTriangleCutoutHeight: 17,
  rightTriangleCutoutWidth: 0,
  rightTriangleCutoutHeight: 0,
  leftStile: 90,
  rightStile: 90,
  topRail: 90,
  bottomRail: 90,
  midRailsEnabled: true,
  midRails: [{ positionFromBottom: 360, dimension: 100 }],
  leftAngleDegrees: 9.45,
  rightAngleDegrees: 0,
  leftAngledRailWidth: 90,
  rightAngledRailWidth: 90,
  borderWidth: 90,
  customBorders: false,
  compact: true,
};

console.log("Generating SVG...");
const svg = generateDoorSvg(config);
fs.writeFileSync("test_door.svg", svg);
console.log("SVG saved to test_door.svg, length:", svg.length);

// Also generate a non-compact version
const svgFull = generateDoorSvg({ ...config, compact: false });
fs.writeFileSync("test_door_full.svg", svgFull);
console.log("Full SVG saved to test_door_full.svg, length:", svgFull.length);
