export interface Point {
    x: number;
    y: number;
}

/**
 * Line intersection of Ax + By = C
 */
export function intersect(A1: number, B1: number, C1: number, A2: number, B2: number, C2: number): Point | null {
    const det = A1 * B2 - A2 * B1;
    if (Math.abs(det) < 1e-6) return null;
    return {
        x: (B2 * C1 - B1 * C2) / det,
        y: (A1 * C2 - A2 * C1) / det
    };
}

export interface HoleSection {
    bottom: number;
    top: number;
    isTop: boolean;
}

export function getHoleSections(
    midRails: any[],
    h: number,
    bottomRail: number,
    topRail: number,
    panelCount: number = 1
): HoleSection[] {
    const panelBottom = bottomRail;
    const panelTop = h - topRail;
    const panelPadding = 15; // 15mm gap between panels if mid-rails are disabled

    if (panelTop <= panelBottom + 0.05) return [];

    if (midRails && midRails.length > 0) {
        const sorted = midRails
            .map((r) => {
                const railBottom = Number(r.positionFromBottom || r.position || 0);
                const railTop = railBottom + Number(r.dimension || r.height || 100);
                return { bottom: railBottom, top: railTop };
            })
            .filter((r) => r.top > panelBottom && r.bottom < panelTop)
            .sort((a, b) => a.bottom - b.bottom);

        const sections: HoleSection[] = [];
        let lastTop = panelBottom;

        for (const rail of sorted) {
            const effectiveBottom = Math.max(rail.bottom, panelBottom);
            const effectiveTop = Math.min(rail.top, panelTop);
            if (effectiveBottom > lastTop + 0.05) {
                sections.push({ bottom: lastTop, top: effectiveBottom, isTop: false });
            }
            lastTop = Math.max(lastTop, effectiveTop);
        }

        if (lastTop < panelTop - 0.05) {
            sections.push({ bottom: lastTop, top: panelTop, isTop: true });
        }

        if (sections.length > 0) {
            sections.forEach((s) => (s.isTop = false));
            sections[sections.length - 1].isTop = true;
        }
        return sections;
    }

    const sections: HoleSection[] = [];
    const totalPanelArea = panelTop - panelBottom;
    const netPanelArea = totalPanelArea - (panelCount - 1) * panelPadding;
    const individualPanelHeight = netPanelArea / panelCount;

    for (let i = 0; i < panelCount; i++) {
        const b = panelBottom + i * (individualPanelHeight + panelPadding);
        const t = b + individualPanelHeight;
        sections.push({
            bottom: b,
            top: t,
            isTop: i === panelCount - 1
        });
    }

    return sections;
}

export function createRoofPoints(
    rightX: number,
    leftX: number,
    flatTopY: number,
    angledInsetL: number,
    angledInsetR: number,
    w: number,
    h: number,
    angledLeft: boolean,
    angledRight: boolean,
    leftCutW: number,
    leftCutH: number,
    rightCutW: number,
    rightCutH: number
): Point[] {
    const hasL = angledLeft && leftCutH > 0.001 && leftCutW > 0.001;
    const hasR = angledRight && rightCutH > 0.001 && rightCutW > 0.001;

    const mR = hasR ? -rightCutH / rightCutW : 0;
    const cR = hasR ? h - mR * w : h;
    
    const mL = hasL ? leftCutH / leftCutW : 0;
    const cL = hasL ? (h - leftCutH) - mL * 0 : h;

    const lHyp = hasL ? Math.sqrt(leftCutW * leftCutW + leftCutH * leftCutH) : 0;
    const rHyp = hasR ? Math.sqrt(rightCutW * rightCutW + rightCutH * rightCutH) : 0;
    
    const lShift = hasL && leftCutW > 0 ? angledInsetL * (lHyp / leftCutW) : 0;
    const rShift = hasR && rightCutW > 0 ? angledInsetR * (rHyp / rightCutW) : 0;

    let intersectionXR = w; // Default if no angle
    if (hasR) {
        intersectionXR = (flatTopY - (cR - rShift)) / mR;
    }

    let intersectionXL = 0; // Default if no angle
    if (hasL) {
        intersectionXL = (flatTopY - (cL - lShift)) / mL;
    }

    const getY = (x: number): number => {
        let y = flatTopY;
        if (hasR) {
            y = Math.min(y, mR * x + cR - rShift);
        }
        if (hasL) {
            y = Math.min(y, mL * x + cL - lShift);
        }
        return y;
    };

    const samples: number[] = [rightX, leftX];
    if (hasR && intersectionXR < rightX && intersectionXR > leftX) {
        samples.push(intersectionXR);
    }
    if (hasL && intersectionXL < rightX && intersectionXL > leftX) {
        samples.push(intersectionXL);
    }

    return Array.from(new Set(samples))
        .sort((a, b) => b - a)
        .map((x) => ({ x, y: Math.max(getY(x), 0) }));
}

export function getPanelPoints(
    sec: HoleSection,
    w: number,
    h: number,
    ls: number,
    rs: number,
    ts: number,
    bs: number,
    arwL: number,
    arwR: number,
    angledLeft: boolean,
    angledRight: boolean,
    leftCutW: number,
    leftCutH: number,
    rightCutW: number,
    rightCutH: number,
    inset: number = 0
): Point[] {
    const pBottom = sec.bottom + inset;
    const pTop = sec.top - inset;
    if (pTop <= pBottom) return [];

    const { leftInner: bL, rightInner: bR } = getInnerEdgesAtY(
        pBottom, w, h, ls, rs, ts, bs, arwL, arwR, angledLeft, angledRight, 
        leftCutW, leftCutH, rightCutW, rightCutH, inset
    );

    if (bL >= bR - 0.001) return [];

    const flatTopY = pTop;
    const roof = createRoofPoints(bR, bL, flatTopY, arwL + inset, arwR + inset, 
        w, h, angledLeft, angledRight, leftCutW, leftCutH, rightCutW, rightCutH);

    const points: Point[] = [];
    points.push({ x: bL, y: pBottom });
    points.push({ x: bR, y: pBottom });
    
    // Roof points (Right to Left)
    roof.forEach(pt => {
        points.push({ x: pt.x, y: Math.max(pt.y, pBottom) });
    });

    return points;
}

/**
 * Calculates the inner (panel/hole/rail) edges at a given Y height (millimetres).
 * Accounts for stile and rail widths, including angled ones.
 * Reflects logic in client's doorUtils.ts
 */
export function getInnerEdgesAtY(
    y: number,
    w: number,
    h: number,
    ls: number,
    rs: number,
    ts: number,
    bs: number,
    arwL: number,
    arwR: number,
    angL: boolean,
    angR: boolean,
    lW: number,
    lH: number,
    rW: number,
    rH: number,
    inset: number = 0
): { leftInner: number; rightInner: number } {
    let leftInner = ls + inset;
    let rightInner = w - rs - inset;

    // Angled side constraints
    if (angL && lH > 0.1 && lW > 0.1) {
        const hyp = Math.sqrt(lW * lW + lH * lH);
        const totalVertShift = (arwL + inset) * (hyp / lW);
        const m = lH / lW;
        // y = m*(x - 0) + (h - lH) - shift -> simplified for server coordinate system (0,0 is bottom-left)
        // In client: y' = m*x' + c' where y' is height-relative.
        // Let's use the line equation: y = m*x + (h - lH) - shift
        // x = (y - (h - lH) + shift) / m
        const xAtY = (y - (h - lH) + totalVertShift) / m;
        leftInner = Math.max(leftInner, xAtY);
    }

    if (angR && rH > 0.1 && rW > 0.1) {
        const hyp = Math.sqrt(rW * rW + rH * rH);
        const totalVertShift = (arwR + inset) * (hyp / rW);
        const m = -rH / rW;
        // y = m*(x - (w - rW)) + h - shift
        // x = (y - h + shift) / m + (w - rW)
        const xAtY = (y - h + totalVertShift) / m + (w - rW);
        rightInner = Math.min(rightInner, xAtY);
    }

    return { leftInner, rightInner };
}

/**
 * Rounds the corners of a given closed polygon (array of Points).
 * @param points The vertices of the polygon.
 * @param radius Radius for the fillets in millimeters.
 * @returns Array of Points defining the rounded polygon, matching the original shape if radius is 0 or impossible.
 */
export function roundCorners(points: Point[], radius: number): Point[] {
    if (radius <= 0 || points.length < 3) return points;

    const result: Point[] = [];
    const len = points.length;

    for (let i = 0; i < len; i++) {
        const pPrev = points[(i - 1 + len) % len];
        const pCurr = points[i];
        const pNext = points[(i + 1) % len];

        // Vectors from current point to previous and next points
        const v1 = { x: pPrev.x - pCurr.x, y: pPrev.y - pCurr.y };
        const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };

        // Lengths of vectors
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        if (len1 === 0 || len2 === 0) {
            result.push({ x: pCurr.x, y: pCurr.y });
            continue;
        }

        // Normalize vectors
        const n1 = { x: v1.x / len1, y: v1.y / len1 };
        const n2 = { x: v2.x / len2, y: v2.y / len2 };

        // Angle between vectors
        const dot = n1.x * n2.x + n1.y * n2.y;
        // Clamp dot to [-1, 1] to avoid NaN in Math.acos due to float rounding
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

        if (angle < 0.01 || angle > Math.PI - 0.01) {
            // Collinear lines, no rounding needed
            result.push({ x: pCurr.x, y: pCurr.y });
            continue;
        }

        // Distance from corner to tangent points
        const tanDist = Math.abs(radius / Math.tan(angle / 2));

        // If the tangent distance is greater than half the segment length, limit the radius to prevent overlap
        const maxTanDist = Math.min(len1 / 2, len2 / 2);
        let actualTanDist = tanDist;
        let actualRadius = radius;

        if (tanDist > maxTanDist) {
            actualTanDist = maxTanDist;
            actualRadius = Math.abs(actualTanDist * Math.tan(angle / 2));
        }

        // Calculate tangent points
        const pt1 = {
            x: pCurr.x + n1.x * actualTanDist,
            y: pCurr.y + n1.y * actualTanDist
        };
        const pt2 = {
            x: pCurr.x + n2.x * actualTanDist,
            y: pCurr.y + n2.y * actualTanDist
        };

        // Determine if corner is convex or concave based on cross product (Z component)
        const cross = n1.x * n2.y - n1.y * n2.x;
        // We evaluate curvature based on 2D polygon orientation.
        // For general rounding, we approximate the arc with line segments.

        // Center of arc
        // Normal to n1
        const perp1 = { x: -n1.y, y: n1.x };
        // Ensure perp1 points inwards
        if (perp1.x * v2.x + perp1.y * v2.y < 0) {
            perp1.x = -perp1.x;
            perp1.y = -perp1.y;
        }

        const cx = pt1.x + perp1.x * actualRadius;
        const cy = pt1.y + perp1.y * actualRadius;

        // Start and end angles
        const a1 = Math.atan2(pt1.y - cy, pt1.x - cx);
        const a2 = Math.atan2(pt2.y - cy, pt2.x - cx);

        let deltaAngle = a2 - a1;
        
        // Correct angle wrapping based on turning direction
        if (cross > 0) {
            if (deltaAngle < 0) deltaAngle += 2 * Math.PI;
        } else {
            if (deltaAngle > 0) deltaAngle -= 2 * Math.PI;
        }

        const segments = Math.max(3, Math.ceil(Math.abs(deltaAngle) / (Math.PI / 8))); // One point per 22.5 deg approx

        for (let j = 0; j <= segments; j++) {
            const a = a1 + (j / segments) * deltaAngle;
            result.push({
                x: cx + actualRadius * Math.cos(a),
                y: cy + actualRadius * Math.sin(a)
            });
        }
    }

    return result;
}
