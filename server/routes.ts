import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { doorConfigSchema, cartItemSchema } from "../shared/doorSchema";
import { generateDoorDxf, type DxfDoorConfig } from "./dxfGenerator";
import { generateDoorSvg, type SvgDoorConfig } from "./svgGenerator";
import { z } from "zod";
import sharp from "sharp";
import {
  insertCustomerSchema,
  insertOrderSchema,
  insertOrderItemSchema,
} from "../shared/schema";
import { verifyDoorPrice } from "./pricing";
import { createShopifyDraftOrder, createQuickCheckout } from "./shopify";
import { registerOAuthRoutes } from "./oauth";
import { isAuthenticated } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Database Initial Migration (Ensures preview_cache exists in Production without VPC access)
  // We do NOT await this here to avoid blocking route registration in Lambda cold starts
  (async () => {
    try {
      console.log("[DB] Verifying preview_cache table...");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "preview_cache" (
          "token" varchar(50) PRIMARY KEY,
          "svg" text NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        );
      `);
      console.log("[DB] Table verified.");
    } catch (err) {
      console.error("[DB] Migration error during background check:", err);
    }
  })();

  // Register OAuth Handlers
  registerOAuthRoutes(app);
  // =====================================================
  // CUSTOMER ENDPOINTS
  // =====================================================

  app.get("/api/customers", isAuthenticated, async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/customers/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      console.log(`[Customer API] POST received. RAW BODY:`, JSON.stringify(req.body, null, 2));
      const customerData = insertCustomerSchema.parse(req.body);
      console.log(`[Customer API] Parsed Customer Data:`, JSON.stringify(customerData, null, 2));

      // Check if customer already exists by email
      const existingCustomer = await storage.getCustomerByEmail(customerData.email);
      if (existingCustomer) {
        console.log(`[Customer API] Found existing customer ID: ${existingCustomer.id}. Updating...`);
        // Update details with latest info from form
        const updated = await storage.updateCustomer(existingCustomer.id, customerData);
        console.log(`[Customer API] Update result for ${updated?.email}: name=${updated?.contactName}, phone=${updated?.phone}`);
        return res.status(200).json(updated);
      }

      console.log(`[Customer API] Creating new customer for email: ${customerData.email}`);
      const customer = await storage.createCustomer(customerData);
      res.status(201).json(customer);
    } catch (error: any) {
      console.error(`[Customer API] Error:`, error.message);
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/customers/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customerData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(id, customerData);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // =====================================================
  // DOOR STYLES ENDPOINTS
  // =====================================================

  app.get("/api/door-styles", async (req, res) => {
    try {
      const styles = await storage.getAllDoorStyles();
      res.json(styles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/door-styles/:code", async (req, res) => {
    try {
      const style = await storage.getDoorStyleByCode(req.params.code);
      if (!style) {
        return res.status(404).json({ message: "Door style not found" });
      }
      res.json(style);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // =====================================================
  // FINISH OPTIONS ENDPOINTS
  // =====================================================

  app.get("/api/finish-options", async (req, res) => {
    try {
      const finishes = await storage.getAllFinishOptions();
      res.json(finishes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/finish-options/:code", async (req, res) => {
    try {
      const finish = await storage.getFinishOptionByCode(req.params.code);
      if (!finish) {
        return res.status(404).json({ message: "Finish option not found" });
      }
      res.json(finish);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // =====================================================
  // ORDER ENDPOINTS
  // =====================================================

  app.get("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
      const orders = customerId
        ? await storage.getOrdersByCustomer(customerId)
        : await storage.getAllOrders();
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Get order items
      const items = await storage.getOrderItemsByOrder(id);

      // Get hinges and mid rails for each item
      const itemsWithDetails = await Promise.all(
        items.map(async (item) => {
          const hinges = await storage.getHingesByItem(item.id);
          const midRails = await storage.getMidRailsByItem(item.id);
          return { ...item, hinges, midRails };
        })
      );

      res.json({ ...order, items: itemsWithDetails });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      console.log("POST /api/orders received:", req.body);
      const body = { ...req.body };
      if (typeof body.dateRequired === "string") {
        console.log("Converting dateRequired string to Date object:", body.dateRequired);
        body.dateRequired = new Date(body.dateRequired);
      }
      console.log("Parsed body before Zod:", { ...body, dateRequired: typeof body.dateRequired });
      const orderData = insertOrderSchema.parse(body);
      const order = await storage.createOrder(orderData);
      res.status(201).json(order);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const body = { ...req.body };
      if (typeof body.dateRequired === "string") {
        body.dateRequired = new Date(body.dateRequired);
      }
      const orderData = insertOrderSchema.partial().parse(body);
      const order = await storage.updateOrder(id, orderData);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // =====================================================
  // ORDER ITEMS ENDPOINTS
  // =====================================================

  app.get("/api/orders/:orderId/items", async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const items = await storage.getOrderItemsByOrder(orderId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/orders/:orderId/items", async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const itemData = insertOrderItemSchema.parse({ ...req.body, orderId });
      const item = await storage.createOrderItem(itemData);
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/order-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const itemData = insertOrderItemSchema.partial().parse(req.body);
      const item = await storage.updateOrderItem(id, itemData);
      if (!item) {
        return res.status(404).json({ message: "Order item not found" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/order-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteOrderItem(id);
      if (!deleted) {
        return res.status(404).json({ message: "Order item not found" });
      }
      res.json({ message: "Order item deleted" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/order-items/:id/hinges", async (req, res) => {
    try {
      const orderItemId = parseInt(req.params.id);
      const body = req.body;

      // Normalize hinge position from client format (positionMm + reference) to DB format (positionFromBottomMm)
      let posFromBottom = body.positionFromBottomMm;
      if (posFromBottom == null && body.positionMm != null && body.reference) {
        const item = await storage.getOrderItem(orderItemId);
        if (item && body.reference === "TOP") {
          let angleCutoutH = 0;
          if (body.side === "LEFT" && item.leftTriangleCutoutHeight) {
            angleCutoutH = Number(item.leftTriangleCutoutHeight) || 0;
          } else if (body.side === "RIGHT" && item.rightTriangleCutoutHeight) {
            angleCutoutH = Number(item.rightTriangleCutoutHeight) || 0;
          }
          posFromBottom = (item.heightMm - angleCutoutH) - body.positionMm;
        } else {
          posFromBottom = body.positionMm;
        }
      }

      const hinge = await storage.createHinge({
        orderItemId,
        positionFromBottomMm: posFromBottom ?? 100,
        side: body.side || "LEFT",
        hingeType: body.hingeType || body.type || "SCREW_POINTS",
        cupDiameterMm: body.cupDiameterMm ?? 35,
        cupDepthMm: body.cupDepthMm ?? 13,
        gapToEdgeMm: body.gapToEdgeMm ?? 5,
      });
      res.status(201).json(hinge);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/order-items/:id/mid-rails", async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const body = req.body;
      const rail = await storage.createMidRail({
        ...body,
        itemId,
        positionMm: typeof body.positionMm === 'string' ? parseInt(body.positionMm) : body.positionMm,
        isAngled: typeof body.isAngled === 'string' ? body.isAngled === 'true' : body.isAngled,
      });
      res.status(201).json(rail);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // =====================================================
  // PRICING ENDPOINTS
  // =====================================================

  app.get("/api/price-brackets/height", async (req, res) => {
    try {
      const brackets = await storage.getPriceBracketsHeight();
      res.json(brackets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/price-brackets/width", async (req, res) => {
    try {
      const brackets = await storage.getPriceBracketsWidth();
      res.json(brackets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/surcharges", async (req, res) => {
    try {
      const surcharges = await storage.getAllSurcharges();
      res.json(surcharges);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const calculatePriceSchema = z.object({
    heightMm: z.number().min(200).max(2430),
    widthMm: z.number().min(200).max(900),
    styleCode: z.string(),
    isAngled: z.boolean().default(false),
    panelType: z.string().default("STANDARD_12MM"),
    numMidRails: z.number().min(0).default(0),
    hingeQty: z.number().min(0).default(0),
    finish: z.string().default("RAW_UNASSEMBLED"),
  });

  app.post("/api/calculate-price", async (req, res) => {
    try {
      const params = calculatePriceSchema.parse(req.body);
      const price = await storage.calculateDoorPrice(params);
      res.json({ price });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // =====================================================
  // DELIVERY OPTIONS ENDPOINTS
  // =====================================================

  app.get("/api/delivery-options", async (req, res) => {
    try {
      const options = await storage.getAllDeliveryOptions();
      res.json(options);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =====================================================
  // SYSTEM SETTINGS ENDPOINTS
  // =====================================================

  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/settings/:key", isAuthenticated, async (req, res) => {
    try {
      const { value } = req.body;
      if (typeof value !== "string") {
        return res.status(400).json({ message: "Value must be a string" });
      }
      const setting = await storage.updateSetting(req.params.key, value);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // =====================================================
  // LEGACY ENDPOINTS (Door configuration and cart)
  // =====================================================

  app.post("/api/door-config", async (req, res) => {
    try {
      const config = doorConfigSchema.parse(req.body);
      const saved = await storage.saveDoorConfig(config);
      res.json(saved);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/door-config/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const config = await storage.getDoorConfig(id);
      if (!config) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      res.json(config);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Cart endpoints
  app.post("/api/cart", async (req, res) => {
    try {
      const itemData = {
        label: `Custom Door ${req.body.config.width}x${req.body.config.height}`,
        category: "door",
        config: doorConfigSchema.parse(req.body.config),
        quantity: req.body.quantity || 1,
      };
      const cartItem = await storage.addToCart(itemData);
      res.json(cartItem);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/cart", async (req, res) => {
    try {
      const items = await storage.getCartItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const removed = await storage.removeFromCart(id);
      if (!removed) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json({ message: "Item removed from cart" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/cart", async (req, res) => {
    try {
      await storage.clearCart();
      res.json({ message: "Cart cleared" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =====================================================
  // EXPORT ENDPOINTS (DXF/SVG)
  // =====================================================

  // =====================================================
  // EXPORT ENDPOINTS (DXF/SVG) - Token Based
  // =====================================================

  const { nanoid } = await import("nanoid");
  const exportCache = new Map<string, { type: "dxf" | "svg"; config: any; filename: string }>();

  // Clean up cache periodically (every 10 minutes)
  setInterval(() => {
    exportCache.clear();
  }, 10 * 60 * 1000);

  // ─── SVG Preview Cache (for Shopify checkout images) ───
  const svgPreviewCache = new Map<string, { svg: string; createdAt: number }>();

  // Clean up preview cache periodically (every hour)
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of svgPreviewCache.entries()) {
      if (now - val.createdAt > 3600000) svgPreviewCache.delete(key);
    }
  }, 30 * 60 * 1000);

  // ─── DXF Download Cache (for attaching to Shopify draft orders) ───
  const dxfDownloadCache = new Map<string, { filename: string; content: string | Buffer; createdAt: number }>();

  // Clean up DXF cache periodically (keep for 24 hours so merchants can download)
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of dxfDownloadCache.entries()) {
      if (now - val.createdAt > 86400000) dxfDownloadCache.delete(key);
    }
  }, 60 * 60 * 1000);

  // Public endpoint for merchants to download the DXF file from Shopify admin
  app.get("/api/dxf/:token", (req, res) => {
    const cached = dxfDownloadCache.get(req.params.token);
    if (!cached) {
      return res.status(404).send("DXF link expired or not found");
    }
    res.setHeader("Content-Type", "application/dxf");
    res.setHeader("Content-Disposition", `attachment; filename="${cached.filename}"`);
    res.send(cached.content);
  });

  // Public endpoint to serve SVG previews (used by Shopify for checkout images)
  app.get("/api/preview/:token.svg", (req, res) => {
    const cached = svgPreviewCache.get(req.params.token);
    if (!cached) {
      return res.status(404).send("Preview expired or not found");
    }
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(cached.svg);
  });

  // Public endpoint to serve PNG previews (converted from SVG on the fly)
  app.get("/api/preview/:token.png", async (req, res) => {
    try {
      const { token } = req.params;
      const svgContent = await storage.getPreview(token);

      if (!svgContent) {
        console.error(`[Preview] 404: SVG not found for token ${token}`);
        return res.status(404).send("Preview not found");
      }

      // Convert SVG to PNG using sharp
      // We use a square output (1000x1000). Shopify compresses thumbnails to squares
      // and squashes non-square images without preserving aspect ratio in draft orders.
      const pngBuffer = await sharp(Buffer.from(svgContent), { density: 300 })
        .flatten({ background: '#ffffff' }) // Ensure white background
        .resize({
          width: 1000,
          height: 1000,
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toBuffer();

      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
      return res.send(pngBuffer);
    } catch (err) {
      console.error("[Preview] Sharp conversion failed:", err);
      return res.status(500).send("Image conversion failed");
    }
  });

  const dxfExportSchema = z.object({
    width: z.number(),
    height: z.number(),
    thickness: z.number(),
    preset: z.string(),
    panelType: z.string(),
    panelCount: z.number(),
    shape: z.string(),
    material: z.string(),
    finish: z.string(),
    rebateWidthMm: z.number(),
    rebateDepthMm: z.number(),
    frontFaceThicknessMm: z.number(),
    cornerRadiusMm: z.number(),
    angledLeft: z.boolean().optional(),
    angledRight: z.boolean().optional(),
    leftTriangleCutoutWidth: z.preprocess((val) => Number(val) || 0, z.number().optional()),
    leftTriangleCutoutHeight: z.preprocess((val) => Number(val) || 0, z.number().optional()),
    rightTriangleCutoutWidth: z.preprocess((val) => Number(val) || 0, z.number().optional()),
    rightTriangleCutoutHeight: z.preprocess((val) => Number(val) || 0, z.number().optional()),
    leftStile: z.number().optional(),
    rightStile: z.number().optional(),
    topRail: z.number().optional(),
    bottomRail: z.number().optional(),
    midRailsEnabled: z.boolean().optional(),
    midRails: z.array(z.any()).optional(),
    leftAngleDegrees: z.number().optional(),
    rightAngleDegrees: z.number().optional(),
    leftAngledRailWidth: z.number().optional(),
    rightAngledRailWidth: z.number().optional(),
    panelOrientation: z.string().optional(),
    hinges: z.array(z.any()),
  }).passthrough();

  const svgExportSchema = z.object({
    width: z.number(),
    height: z.number(),
    thickness: z.number(),
    preset: z.string(),
    panelType: z.string(),
    panelCount: z.number(),
    panelOrientation: z.enum(["vertical", "horizontal"]).optional().default("vertical"),
    shape: z.string(),
    angledLeft: z.boolean().optional(),
    angledRight: z.boolean().optional(),
    leftTriangleCutoutWidth: z.preprocess((val) => Number(val) || 0, z.number().optional()),
    leftTriangleCutoutHeight: z.preprocess((val) => Number(val) || 0, z.number().optional()),
    rightTriangleCutoutWidth: z.preprocess((val) => Number(val) || 0, z.number().optional()),
    rightTriangleCutoutHeight: z.preprocess((val) => Number(val) || 0, z.number().optional()),
    borderWidth: z.number().optional(),
    customBorders: z.boolean().optional(),
    leftStile: z.number().optional(),
    rightStile: z.number().optional(),
    bottomRail: z.number().optional(),
    topRail: z.number().optional(),
    midRailsEnabled: z.boolean().optional(),
    midRails: z.array(z.any()).optional(),
    leftAngleDegrees: z.number().optional(),
    rightAngleDegrees: z.number().optional(),
    leftAngledRailWidth: z.number().optional(),
    rightAngledRailWidth: z.number().optional(),
    rebateWidthMm: z.number().optional(),
    rebateDepthMm: z.number().optional(),
    frontFaceThicknessMm: z.number().optional(),
    cornerRadiusMm: z.number().optional(),
    hingeDrilling: z.boolean().optional(),
    hinges: z.array(z.any()).optional(),
    material: z.string(),
    finish: z.string(),
  }).passthrough();

  app.post("/api/export/prepare", async (req, res) => {
    try {
      const type = req.query.type as string;
      if (type !== "dxf" && type !== "svg") {
        return res.status(400).json({ message: "Invalid export type" });
      }

      let parsedConfig;
      if (type === "dxf") {
        parsedConfig = dxfExportSchema.parse(req.body);
      } else {
        parsedConfig = svgExportSchema.parse(req.body);
      }

      const token = nanoid();
      const filename = `door-${parsedConfig.preset}-${parsedConfig.width}x${parsedConfig.height}-${Date.now()}.${type}`;

      exportCache.set(token, { type: type as "dxf" | "svg", config: parsedConfig, filename });
      res.json({ token });

    } catch (error: any) {
      console.error("Export Preparation Error:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation Error:", JSON.stringify(error.format(), null, 2));
      }
      res.status(422).json({
        message: "Failed to prepare export",
        details: error.message
      });
    }
  });

  app.get("/api/download/:type/:token", async (req, res) => {
    const { type, token } = req.params;
    const cached = exportCache.get(token);

    if (!cached || cached.type !== type) {
      return res.status(404).send("Link expired or invalid");
    }

    try {
      let content;
      if (type === "dxf") {
        const config: DxfDoorConfig = { ...cached.config, height: cached.config.height };
        content = await generateDoorDxf(config);
        res.setHeader("Content-Type", "application/dxf");
      } else {
        const config: SvgDoorConfig = {
          ...cached.config,
          height: cached.config.height,
          borderWidth: cached.config.borderWidth ?? 75,
        };
        content = generateDoorSvg(config);
        res.setHeader("Content-Type", "image/svg+xml");
      }

      res.setHeader("Content-Disposition", `attachment; filename="${cached.filename}"`);
      res.send(content);

      // Optional: Clear cache after download (one-time use)
      exportCache.delete(token);

    } catch (error: any) {
      console.error("Download Generation Error:", error);
      res.status(500).send("Failed to generate file");
    }
  });

  // =====================================================
  // SHOPIFY INTEGRATION ENDPOINTS
  // =====================================================

  app.post("/api/orders/:id/sync-shopify", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await createShopifyDraftOrder(id);
      res.json(result);
    } catch (error: any) {
      console.error("Shopify Sync Route Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/orders/:id/sync-logs", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const logs = await storage.getShopifySyncLogs(id);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Quick checkout - creates a Shopify draft order directly from door config
  app.post("/api/quick-checkout", async (req, res) => {
    try {
      const body = req.body;
      // Dynamically import node modules to avoid top-level issues if not polyfilled
      const fs = await import("fs");
      const path = await import("path");

      console.log("=== QUICK CHECKOUT REQUEST ===");
      console.log("Body keys:", Object.keys(body));
      console.log("Has items?", Array.isArray(body.items));

      // ─── Normalize: accept BOTH old flat format and new items array ───
      let lineItems: Array<{
        width: number;
        height: number;
        thickness: number;
        panelType: string;
        panelOrientation?: string;
        material?: string;
        finish: string;
        price: number;
        quantity: number;
        category?: string;
        angledLeft?: boolean;
        angledRight?: boolean;
        leftAngleDegrees?: number;
        rightAngleDegrees?: number;
        leftTriangleCutoutWidth?: number;
        leftTriangleCutoutHeight?: number;
        rightTriangleCutoutWidth?: number;
        rightTriangleCutoutHeight?: number;
        midRailsEnabled?: boolean;
        midRails?: any[];
        midRailsEqualise?: boolean;
        hingeDrilling?: boolean;
        hinges?: any[];
        customBorders?: boolean;
        borderWidth?: number;
        leftStile?: number;
        rightStile?: number;
        topRail?: number;
        bottomRail?: number;
        rebateWidthMm?: number;
        rebateDepthMm?: number;
        frontFaceThicknessMm?: number;
        cornerRadiusMm?: number | string;
      }> = [];

      if (Array.isArray(body.items) && body.items.length > 0) {
        lineItems = body.items;
      } else if (body.width && body.height && body.price) {
        lineItems = [
          {
            width: body.width,
            height: body.height,
            thickness: body.thickness || 22,
            panelType: body.panelType || "STANDARD_12MM",
            finish: body.finish || "RAW_UNASSEMBLED",
            price: body.price,
            quantity: body.quantity || 1,
            category: body.category || "shaker",
            angledLeft: body.angledLeft,
            angledRight: body.angledRight,
            leftAngleDegrees: body.leftAngleDegrees,
            rightAngleDegrees: body.rightAngleDegrees,
            midRailsEnabled: body.midRailsEnabled,
            midRails: body.midRails,
            hingeDrilling: body.hingeDrilling,
            hinges: body.hinges,
          },
        ];
      } else {
        console.error("Invalid checkout body — no items and no flat config");
        return res.status(400).json({
          message:
            "Missing required door configuration. Please add at least one door to your cart.",
        });
      }

      // ─── Validate each line item and lookup DB IDs ───
      const validationPromises = lineItems.map(async (item, i) => {
        if (!item.width || !item.height || item.price == null) {
          throw new Error(`Item ${i + 1} is missing required fields.`);
        }
        if (!item.quantity || item.quantity < 1) item.quantity = 1;

        // Verify Price
        try {
          const verificationConfig = doorConfigSchema.parse({
            width: item.width,
            height: item.height,
            thickness: item.thickness || 22,
            preset: "single",
            panelType: item.panelType || "STANDARD_12MM",
            panelCount: 1,
            borderWidth: 90,
            customBorders: false,
            leftStile: 90,
            rightStile: 90,
            topRail: 90,
            bottomRail: 90,
            angledLeft: item.angledLeft || false,
            angledRight: item.angledRight || false,
            leftTriangleCutoutWidth: 0,
            leftTriangleCutoutHeight: 0,
            rightTriangleCutoutWidth: 0,
            rightTriangleCutoutHeight: 0,
            midRailsEnabled: item.midRailsEnabled || false,
            midRails: item.midRails || [],
            hingeDrilling: item.hingeDrilling || false,
            hinges: item.hinges || [],
            finish: item.finish || "RAW_UNASSEMBLED",
            price: 0,
          });

          const serverPrice = await verifyDoorPrice(verificationConfig);
          // 1% tolerance
          const tolerance = serverPrice * 0.01;
          if (Math.abs(item.price - serverPrice) > Math.max(tolerance, 0.50)) {
            console.warn(`[Price Verification] Item ${i + 1} price mismatch. Client: ${item.price}, Server: ${serverPrice}`);
            // We accept client price for now but log warning, or enforce server price:
            item.price = serverPrice;
          }
        } catch (e) {
          console.warn(`[Price Verification] Failed for item ${i + 1}:`, e);
        }
        return item;
      });

      await Promise.all(validationPromises);

      // ─── 1. Ensure Guest Customer Exists ───
      // We need a customer to create an order. Since this is "Quick Checkout" before user details,
      // we use a generic Guest identity.
      const GUEST_EMAIL = "guest@customdoordesigner.com";
      let customer = await storage.getCustomerByEmail(GUEST_EMAIL);
      if (!customer) {
        console.log("Creating Guest Customer for Quick Checkout...");
        customer = await storage.createCustomer({
          companyName: "Guest User",
          contactName: "Guest",
          email: GUEST_EMAIL,
          phone: "00000000000",
          invoiceAddressLine1: "Guest Checkout",
          invoiceCity: "Unknown",
          invoicePostcode: "UNKNOWN",
        });
      }

      // ─── 2. Create Local Order (DRAFT) ───
      const orderRef = `ORD-${nanoid(8).toUpperCase()}`;

      const newOrder = await storage.createOrder({
        customerId: customer.id,
        orderReference: orderRef,
        dateRequired: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 2 weeks
        deliveryMethod: "COLLECTION", // Default
        subtotalExcVat: lineItems.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2),
        totalExcVat: lineItems.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2),
        vatAmount: (lineItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * 0.2).toFixed(2),
        totalIncVat: (lineItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * 1.2).toFixed(2),
        orderStatus: "DRAFT",
        productionStatus: "NOT_STARTED",
      });
      console.log(`Created local order: ${newOrder.id} (${newOrder.orderReference})`);

      // Lookup Styles/Finishes for DB Foreign Keys
      // In a real scenario, you'd want to cache these or do a more robust lookup.
      // We'll fallback to the first available if exact match fails, or creating defaults.
      // For now, let's assume standard IDs exist or just fetch them all.
      const allStyles = await storage.getAllDoorStyles();
      const allFinishes = await storage.getAllFinishOptions();
      const defaultStyle = allStyles[0];
      const defaultFinish = allFinishes[0];

      // File storage setup
      // const __dirname = path.dirname(new URL(import.meta.url).pathname); // ES module dirname workaround if needed, or stick to provided context
      // Actually, we are inside an async function in a module, __dirname might not be available directly if we were pure ESM, 
      // but typical TS/Node setups here inject it. 
      // Let's rely on standard process.cwd() or relative path from project root.
      const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      const baseDir = isLambda ? "/tmp" : process.cwd();
      const storageDir = path.resolve(baseDir, "storage", "orders", newOrder.id.toString());
      if (!fs.existsSync(storageDir)) {
        await fs.promises.mkdir(storageDir, { recursive: true });
      }

      // ─── 3. Create Order Items & Generate Files ───
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];

        // Find matching Style/Finish IDs
        // Attempt to match style details (shaker/slab etc)
        // Match item.category or item.panelType to styleCode
        let styleId: number | undefined;
        const styleMatch = allStyles.find(s =>
          s.styleCode === (item.category?.toUpperCase()) ||
          s.styleCode === (item.panelType?.toUpperCase()) ||
          (item.panelType === "NONE" && s.styleCode === "SLAB")
        );

        if (styleMatch) {
          styleId = styleMatch.id;
        } else if (defaultStyle) {
          styleId = defaultStyle.id;
        }

        if (styleId === undefined) {
          throw new Error("Critical Error: No door styles found in database. Please run seed script.");
        }

        let finishId: number | undefined;
        const matchingFinish = allFinishes.find(f => f.finishCode === item.finish) ||
          allFinishes.find(f => f.finishName === item.finish);
        if (matchingFinish) {
          finishId = matchingFinish.id;
        } else if (defaultFinish) {
          finishId = defaultFinish.id;
        }

        if (finishId === undefined) {
          throw new Error("Critical Error: No finish options found in database. Please run seed script.");
        }

        const dbItem = await storage.createOrderItem({
          orderId: newOrder.id,
          lineNumber: i + 1,
          quantity: item.quantity,
          styleId: styleId,
          finishId: finishId,
          heightMm: Math.round(Number(item.height)),
          widthMm: Math.round(Number(item.width)),
          panelThicknessMm: Math.round(Number(item.thickness || 22)),
          panelType: item.panelType as any,
          panelOrientation: item.panelOrientation || "vertical",
          material: item.material || "MR MDF",

          isAngled: !!(item.angledLeft || item.angledRight),
          angledShorterSide: item.angledLeft ? "LEFT" : (item.angledRight ? "RIGHT" : null),
          leftAngleDegrees: (item.leftAngleDegrees || 0).toString(),
          rightAngleDegrees: (item.rightAngleDegrees || 0).toString(),
          leftTriangleCutoutWidth: Math.round(Number(item.leftTriangleCutoutWidth || 0)),
          leftTriangleCutoutHeight: Math.round(Number(item.leftTriangleCutoutHeight || 0)),
          rightTriangleCutoutWidth: Math.round(Number(item.rightTriangleCutoutWidth || 0)),
          rightTriangleCutoutHeight: Math.round(Number(item.rightTriangleCutoutHeight || 0)),

          borderLeftStile: Math.round(Number(item.customBorders ? item.leftStile : (item.borderWidth || 90))),
          borderRightStile: Math.round(Number(item.customBorders ? item.rightStile : (item.borderWidth || 90))),
          borderTopRail: Math.round(Number(item.customBorders ? item.topRail : (item.borderWidth || 90))),
          borderBottomRail: Math.round(Number(item.customBorders ? item.bottomRail : (item.borderWidth || 90))),

          unitPriceExcVat: item.price.toFixed(2),
          lineTotalExcVat: (item.price * item.quantity).toFixed(2),
          basePrice: item.price.toFixed(2),

          hingeQuantity: item.hingeDrilling && item.hinges ? item.hinges.length : 0,
          midRailsEqualise: item.midRailsEqualise || false,
        });

        // Save Mid Rails
        if (item.midRails && item.midRails.length > 0) {
          for (const [idx, rail] of item.midRails.entries()) {
            await storage.createMidRail({
              itemId: dbItem.id,
              railNumber: idx + 1,
              positionFromBottomMm: Math.round(Number(rail.positionFromBottom ?? rail.position)),
              railWidthMm: Math.round(Number(rail.dimension ?? rail.height ?? 100)), // Default width if missing
            });
          }
        }

        // Save Hinges
        if (item.hinges && item.hinges.length > 0) {
          for (const h of item.hinges) {
            // Convert client hinge position (positionMm + reference) to absolute position from bottom
            let posFromBottom: number;
            if (h.positionFromBottomMm != null) {
              posFromBottom = h.positionFromBottomMm;
            } else if (h.positionMm != null && h.reference) {
              if (h.reference === "TOP") {
                let angleCutoutH = 0;
                if (h.side === "LEFT" && item.leftTriangleCutoutHeight) {
                  angleCutoutH = Number(item.leftTriangleCutoutHeight) || 0;
                } else if (h.side === "RIGHT" && item.rightTriangleCutoutHeight) {
                  angleCutoutH = Number(item.rightTriangleCutoutHeight) || 0;
                }
                posFromBottom = (item.height - angleCutoutH) - h.positionMm;
              } else {
                posFromBottom = h.positionMm;
              }
            } else if (h.position != null) {
              posFromBottom = h.position;
            } else {
              posFromBottom = 100; // Safe default
            }

            await storage.createHinge({
              orderItemId: dbItem.id,
              positionFromBottomMm: Math.round(Number(posFromBottom)),
              side: h.side || "LEFT",
              hingeType: h.type || h.hingeType || "SCREW_POINTS",
              cupDiameterMm: 35,
              cupDepthMm: 13,
              gapToEdgeMm: 5,
            });
          }
        }

        // Generate & Save DXF/SVG
        // Construct full config for generators
        // Generate & Save DXF/SVG
        // Construct full config for generators with proper hinge conversion
        const fullConfig = {
          ...item,
          width: Number(item.width),
          height: Number(item.height),
          thickness: Number(item.thickness),
          preset: item.preset || "single",
          panelType: item.panelType || "NONE",
          panelCount: Number(item.panelCount || 1),
          panelOrientation: item.panelOrientation || "vertical",
          shape: (item.angledLeft === true || item.angledLeft === "true" || item.angledRight === true || item.angledRight === "true") ? "angled" : "rectangular",
          angledLeft: item.angledLeft === true || item.angledLeft === "true",
          angledRight: item.angledRight === true || item.angledRight === "true",
          material: item.material || "MR MDF",
          finish: item.finish || "RAW_UNASSEMBLED",
          leftStile: Number(item.leftStile || item.borderWidth || 75),
          rightStile: Number(item.rightStile || item.borderWidth || 75),
          topRail: Number(item.topRail || item.borderWidth || 75),
          bottomRail: Number(item.bottomRail || item.borderWidth || 75),
          midRailsEnabled: item.midRailsEnabled === true || item.midRailsEnabled === "true",
          midRails: typeof item.midRails === "string" ? JSON.parse(item.midRails) : (Array.isArray(item.midRails) ? item.midRails : []),
          leftTriangleCutoutWidth: Number(item.leftTriangleCutoutWidth || 0),
          leftTriangleCutoutHeight: Number(item.leftTriangleCutoutHeight || 0),
          rightTriangleCutoutWidth: Number(item.rightTriangleCutoutWidth || 0),
          rightTriangleCutoutHeight: Number(item.rightTriangleCutoutHeight || 0),
          leftAngleDegrees: Number(item.leftAngleDegrees || 0),
          rightAngleDegrees: Number(item.rightAngleDegrees || 0),
          leftAngledRailWidth: Number(item.leftAngledRailWidth || 90),
          rightAngledRailWidth: Number(item.rightAngledRailWidth || 90),
          rebateWidthMm: Number(item.rebateWidthMm || 10),
          rebateDepthMm: Number(item.rebateDepthMm || 14),
          frontFaceThicknessMm: Number(item.frontFaceThicknessMm || 8),
          cornerRadiusMm: Number(item.cornerRadiusMm || 0),
          // Convert hinges from client format (positionMm + reference) to DXF format (positionFromBottomMm)
          hinges: (item.hinges || []).map((h: any) => {
            let posFromBottom: number;
            if (h.positionFromBottomMm != null) {
              posFromBottom = Number(h.positionFromBottomMm);
            } else if (h.positionMm != null && h.reference) {
              if (h.reference === "TOP") {
                let angleCutoutH = 0;
                if (h.side === "LEFT" && item.leftTriangleCutoutHeight) {
                  angleCutoutH = Number(item.leftTriangleCutoutHeight) || 0;
                } else if (h.side === "RIGHT" && item.rightTriangleCutoutHeight) {
                  angleCutoutH = Number(item.rightTriangleCutoutHeight) || 0;
                }
                posFromBottom = (Number(item.height) - angleCutoutH) - Number(h.positionMm);
              } else {
                posFromBottom = Number(h.positionMm);
              }
            } else if (h.position != null) {
              posFromBottom = Number(h.position);
            } else {
              posFromBottom = 100;
            }
            return {
              ...h,
              positionFromBottomMm: posFromBottom,
              positionMm: h.positionMm,
              reference: h.reference,
              side: h.side || "LEFT",
              type: h.type || h.hingeType || "SCREW_POINTS",
              hingeType: h.type || h.hingeType || "SCREW_POINTS",
            };
          }),
        };

        try {
          // DXF
          const dxfContent = await generateDoorDxf(fullConfig as any);
          const dxfFilename = `${dbItem.id}_door.dxf`;
          const dxfPath = path.join(storageDir, dxfFilename);
          await fs.promises.writeFile(dxfPath, dxfContent);

          // SVG (normal — for order file)
          const svgContent = generateDoorSvg(fullConfig as any);
          const svgFilename = `${dbItem.id}_preview.svg`;
          const svgPath = path.join(storageDir, svgFilename);
          await fs.promises.writeFile(svgPath, svgContent);

          // SVG (compact — optimized for Shopify thumbnail: no labels, minimal padding, bolder strokes)
          const compactSvg = generateDoorSvg({ ...fullConfig, compact: true } as any);

          // Store compact SVG in preview cache for Shopify checkout image
          const previewToken = nanoid();
          await storage.savePreview(previewToken, compactSvg);
          const hostName = process.env.HOST_NAME || `http://localhost:${process.env.PORT || 5000}`;

          // Use PNG URL for Shopify (Svg is rejected)
          const imageUrl = `${hostName}/api/preview/${previewToken}.png`;
          console.log(`[Checkout] Token=${previewToken} hostName=${hostName}`);
          console.log(`[Checkout] Setting _imageUrl for item ${i + 1}: ${imageUrl}`);

          // Attach image URL to the line item so Shopify can display it
          (item as any)._imageUrl = imageUrl;

          // Cache the DXF file so we can attach a public link to the Shopify order
          const dxfToken = nanoid(12);
          dxfDownloadCache.set(dxfToken, {
            filename: dxfFilename,
            content: dxfContent,
            createdAt: Date.now()
          });
          const dxfUrl = `${hostName}/api/dxf/${dxfToken}`;
          (item as any)._dxfUrl = dxfUrl;

          // Update Item with DXF Path
          await storage.updateOrderItem(dbItem.id, {
            dxfFilePath: dxfPath,
            dxfFileGenerated: true,
          });

          // Save Attachments to DB (DXF)
          await storage.createOrderAttachment({
            orderId: newOrder.id,
            itemId: dbItem.id,
            fileName: dxfFilename,
            fileType: "DXF",
            filePath: dxfPath,
            fileContent: dxfContent, // Store DXF content
            description: `Production DXF for Item #${dbItem.lineNumber}`,
            fileSizeBytes: Buffer.byteLength(dxfContent),
          });

          // Save Attachments to DB (SVG)
          await storage.createOrderAttachment({
            orderId: newOrder.id,
            itemId: dbItem.id,
            fileName: svgFilename,
            fileType: "IMAGE", // SVG treated as image
            filePath: svgPath,
            fileContent: svgContent, // Store SVG content
            description: `Preview SVG for Item #${dbItem.lineNumber}`,
            fileSizeBytes: Buffer.byteLength(svgContent),
          });

          console.log(`Generated files and attachments for item ${dbItem.id}`);
        } catch (err) {
          console.error(`Failed to generate/save files for item ${dbItem.id}`, err);
        }
      }


      // ─── 4. Sync to Shopify ───
      const { getShopifyCredentials, createDraftOrderFromLineItems } =
        await import("./shopifyCheckout");

      const creds = await getShopifyCredentials();
      if (!creds) {
        console.error("Missing Shopify credentials");
        throw new Error("Payment system not configured. Please visit /api/auth to connect your Shopify store.");
      }

      console.log(`[Checkout] Passing ${lineItems.length} items to Draft Order creation.`);
      lineItems.forEach((it, idx) => {
        console.log(`[Checkout] Item ${idx + 1} has _imageUrl: ${(it as any)._imageUrl}`);
      });

      const result = await createDraftOrderFromLineItems(lineItems, creds);

      console.log(`Draft order created! Invoice URL: ${result.invoiceUrl}`);

      // ─── 5. Update Local Order with Shopify ID ───
      await storage.updateOrder(newOrder.id, {
        shopifyDraftOrderId: result.draftOrderId,
        shopifyOrderId: result.draftOrderId, // Initially same until converted
        orderStatus: "SUBMITTED",
        paymentStatus: "PENDING",
      });

      return res.json({
        invoiceUrl: result.invoiceUrl,
        draftOrderId: result.draftOrderId,
      });

    } catch (error: any) {
      console.error("Checkout error:", error.message);

      let msg = error.message || "An unexpected error occurred.";
      let statusCode = 500;

      if (msg?.includes("credentials") || msg?.includes("not configured")) {
        msg = "Payment system is not configured. Please contact the administrator.";
        statusCode = 503;
      } else if (msg?.includes("Failed to connect to Shopify")) {
        msg = `Shopify connection failed: ${error.message}`;
        statusCode = 502;
      } else if (msg?.includes("Payment provider did not return")) {
        msg = "Checkout URL not received from Shopify. Please try again.";
      }

      return res.status(statusCode).json({ message: msg, debug: process.env.NODE_ENV !== 'production' ? error.message : undefined });
    }
  });
  // server/routes.ts - add before httpServer creation

  app.get("/api/shopify/status", async (req, res) => {
    try {
      const { getShopifyCredentials } = await import("./shopifyCheckout");
      const creds = await getShopifyCredentials();

      if (!creds) {
        return res.status(503).json({
          configured: false,
          message: "Missing SHOPIFY_ACCESS_TOKEN or SHOPIFY_SHOP_DOMAIN",
          env: {
            hasToken: !!(process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN),
            hasDomain: !!(process.env.SHOPIFY_SHOP_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN),
            tokenPrefix: (process.env.SHOPIFY_ACCESS_TOKEN || "").substring(0, 8) || "MISSING",
          }
        });
      }

      // Test the connection
      const testUrl = `https://${creds.shopDomain}/admin/api/2025-01/shop.json`;
      const testRes = await fetch(testUrl, {
        headers: { "X-Shopify-Access-Token": creds.accessToken }
      });

      if (!testRes.ok) {
        const body = await testRes.text();
        return res.status(502).json({
          configured: true,
          connected: false,
          httpStatus: testRes.status,
          message: testRes.status === 401
            ? "Invalid access token - token rejected by Shopify"
            : testRes.status === 404
              ? "Shop domain not found - check SHOPIFY_SHOP_DOMAIN"
              : `Shopify returned ${testRes.status}`,
          detail: body.substring(0, 200)
        });
      }

      const shopData: any = await testRes.json();
      return res.json({
        configured: true,
        connected: true,
        shop: shopData.shop?.name,
        domain: shopData.shop?.domain,
        plan: shopData.shop?.plan_name,
      });

    } catch (e: any) {
      return res.status(500).json({ configured: false, error: e.message });
    }
  });
  const httpServer = createServer(app);

  return httpServer;
}
