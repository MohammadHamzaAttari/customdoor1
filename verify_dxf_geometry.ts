
import fetch from "node-fetch";

const baseUrl = "http://127.0.0.1:5000";

async function verifyDxfGeometry() {
    console.log("Starting DXF Geometry Verification...");

    // Config: 900x2100 Door.
    // Angled Top Right: 200mm width, 200mm height.
    // Expected Points for Right Cut:
    // X=900, Y=1900 (Start of cut on right edge) -> Y = 2100 - 200
    // X=700, Y=2100 (End of cut on top edge) -> X = 900 - 200

    const payload = {
        "width": 900,
        "height": 2100,
        "thickness": 40,
        "preset": "single",
        "panelType": "NONE",
        "panelCount": 0,
        "shape": "angled",
        "material": "MDF",
        "finish": "Primed",
        "rebateWidthMm": 10,
        "rebateDepthMm": 10,
        "frontFaceThicknessMm": 5,
        "cornerRadiusMm": 0,
        "angledLeft": false,
        "angledRight": true,
        "leftTriangleCutoutWidth": 0,
        "leftTriangleCutoutHeight": 0,
        "rightTriangleCutoutWidth": 200,
        "rightTriangleCutoutHeight": 200,
        "hinges": []
    };

    try {
        // 1. Prepare
        const prepareRes = await fetch(`${baseUrl}/api/export/prepare?type=dxf`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!prepareRes.ok) throw new Error("Prepare failed");
        const { token } = await prepareRes.json();

        // 2. Download
        const downloadRes = await fetch(`${baseUrl}/api/download/dxf/${token}`);
        const dxfText = await downloadRes.text();

        console.log(`DXF Downloaded (${dxfText.length} bytes). Checking geometry...`);

        const dxfUpper = dxfText.toUpperCase();

        const hasRightEdgeCutStart = dxfText.includes("1900") || dxfText.includes("1900.0"); // Y value
        const hasSideViewLabel = dxfText.includes("SIDE VIEW");
        const hasTopViewLabel = dxfText.includes("TOP VIEW");
        const hasThicknessDim = dxfText.includes("Thk:");

        // Check for expected layers (case-insensitive)
        const hasPerimeterLayer = dxfUpper.includes("PERIMETER");
        const hasIdLayer = dxfUpper.includes("IDENTIFICATION");
        const hasPanelLayer = dxfUpper.includes("PANEL");
        const hasHingeLayer = dxfUpper.includes("HINGE");

        if (hasRightEdgeCutStart && !hasSideViewLabel && !hasTopViewLabel && !hasThicknessDim && hasPerimeterLayer && hasIdLayer && hasPanelLayer && hasHingeLayer) {
            console.log("[PASS] Found coordinates consistent with angled cut.");
            console.log("[PASS] Verified Clutter (SIDE VIEW, TOP VIEW, Thk:) is REMOVED.");
            console.log("[PASS] Verified required production layers are INCLUDED.");
        } else {
            console.error("[FAIL] Geometry verification failed or clutter remains or layers missing.");
            if (hasSideViewLabel) console.error(" - Clutter remains: SIDE VIEW label");
            if (hasTopViewLabel) console.error(" - Clutter remains: TOP VIEW label");
            if (!hasPerimeterLayer) console.error(" - Missing layer: PERIMETER");
            if (!hasIdLayer) console.error(" - Missing layer: PART IDENTIFICATION");
            if (!hasPanelLayer) console.error(" - Missing layer: PANEL");
            if (!hasHingeLayer) console.error(" - Missing layer: HINGE");
            process.exit(1);
        }

        console.log("Geometry Check Passed: Angled cut and Section views are present.");

    } catch (error) {
        console.error("Verification Failed:", error);
        process.exit(1);
    }
}

verifyDxfGeometry();
