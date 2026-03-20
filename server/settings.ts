import { storage } from "./storage";
import { DEFAULT_PRICING } from "../shared/doorSchema";

export interface ManufacturingSettings {
  panelOffsetToleranceMm: number;
  panelCornerRadiusMm: number;
  layers: {
    partIdentification: string;
    hingeHoles: string;
    hingeCups: string;
    innerRebate: string;
    innerPerimeter: string;
    perimeter: string;
    panel: string;
  };
}

export async function getManufacturingSettings(): Promise<ManufacturingSettings> {
  const settings = await storage.getAllSettings();
  
  const getSetting = (key: string, _default: string) => {
    const s = settings.find(s => s.settingKey === key);
    return s ? s.settingValue : _default;
  };

  return {
    panelOffsetToleranceMm: parseFloat(getSetting("PANEL_OFFSET_TOLERANCE_MM", "0.175")),
    panelCornerRadiusMm: parseFloat(getSetting("PANEL_CORNER_RADIUS_MM", "2.4")),
    layers: {
      partIdentification: getSetting("DXF_LAYER_PART_IDENTIFICATION", "part identification"),
      hingeHoles: getSetting("DXF_LAYER_HINGE_HOLES", "hinge screw holes"),
      hingeCups: getSetting("DXF_LAYER_HINGE_CUPS", "hinge cups"),
      innerRebate: getSetting("DXF_LAYER_INNER_REBATE", "inner rebate"),
      innerPerimeter: getSetting("DXF_LAYER_INNER_PERIMETER", "inner perimeter cut"),
      perimeter: getSetting("DXF_LAYER_PERIMETER", "perimeter cut"),
      panel: getSetting("DXF_LAYER_PANEL", "panel"),
    }
  };
}

export async function getPricingSettings() {
  const settings = await storage.getAllSettings();
  const surcharges = await storage.getAllSurcharges();
  const deliveryOptions = await storage.getAllDeliveryOptions();
  
  const getNumSetting = (key: string, _default: number) => {
    const s = settings.find(s => s.settingKey === key);
    return s ? parseFloat(s.settingValue) : _default;
  };

  const getSurcharge = (code: string, _default: number) => {
    const s = surcharges.find(s => s.surchargeCode === code);
    return s ? parseFloat(s.amount.toString()) : _default;
  };
  
  const stdDelivery = deliveryOptions.find(d => d.deliveryCode === "DELIVERY");

  return {
    ...DEFAULT_PRICING,
    FIXED_FEE_PER_DOOR: getNumSetting("FIXED_FEE_BASE", DEFAULT_PRICING.FIXED_FEE_PER_DOOR),
    SQM_RATE_SHAKER: getNumSetting("PRICE_PER_SQM_SHAKER", DEFAULT_PRICING.SQM_RATE_SHAKER),
    SQM_RATE_SLAB: getNumSetting("PRICE_PER_SQM_SLAB", DEFAULT_PRICING.SQM_RATE_SLAB),
    ANGLED_SURCHARGE: getSurcharge("ANGLED", DEFAULT_PRICING.ANGLED_SURCHARGE),
    MID_RAIL_SURCHARGE: getSurcharge("MID_RAIL", DEFAULT_PRICING.MID_RAIL_SURCHARGE),
    HINGE_HOLE_SURCHARGE: getSurcharge("HINGE_HOLE", DEFAULT_PRICING.HINGE_HOLE_SURCHARGE),
    DELIVERY_BASE_FEE: stdDelivery ? parseFloat(stdDelivery.basePrice.toString()) : DEFAULT_PRICING.DELIVERY_BASE_FEE,
    VAT_RATE: getNumSetting("VAT_RATE", DEFAULT_PRICING.VAT_RATE),
  };
}
