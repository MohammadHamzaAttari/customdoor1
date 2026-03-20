import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  varchar,
  decimal,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

// =====================================================
// ENUMS
// =====================================================

export const deliveryMethodEnum = pgEnum("delivery_method", [
  "COLLECTION",
  "DELIVERY",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "DRAFT",
  "SUBMITTED",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "PAID",
  "REFUNDED",
]);

export const productionStatusEnum = pgEnum("production_status", [
  "NOT_STARTED",
  "FILES_GENERATED",
  "CNC_QUEUED",
  "CNC_COMPLETE",
  "ASSEMBLY",
  "QC_CHECK",
  "PACKED",
  "COMPLETE",
]);

export const angledSideEnum = pgEnum("angled_side", ["LEFT", "RIGHT"]);

export const hingePositionTypeEnum = pgEnum("hinge_position_type", [
  "TOP",
  "BOTTOM",
]);

export const fileTypeEnum = pgEnum("file_type", [
  "SKETCHUP",
  "PDF",
  "DXF",
  "IMAGE",
  "OTHER",
]);

export const syncTypeEnum = pgEnum("sync_type", [
  "CREATE",
  "UPDATE",
  "WEBHOOK",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "SUCCESS",
  "FAILED",
  "PENDING",
]);

export const calculationTypeEnum = pgEnum("calculation_type", [
  "FIXED",
  "PER_ITEM",
  "MULTIPLIER",
]);

export const settingTypeEnum = pgEnum("setting_type", [
  "STRING",
  "NUMBER",
  "BOOLEAN",
  "JSON",
]);

export const panelTypeEnum = pgEnum("panel_type", [
  "STANDARD_12MM",
  "STANDARD_9MM",
  "REEDED_19MM",
  "MELAMINE_18MM",
  "FRETWORK",
  "GLASS",
  "NONE",
]);

export const hingeTypeEnum = pgEnum("hinge_type", [
  "SCREW_POINTS",
  "INSERTA",
]);

// =====================================================
// USERS TABLE (kept for authentication)
// =====================================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =====================================================
// CUSTOMERS TABLE
// =====================================================

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    companyName: varchar("company_name", { length: 200 }).notNull(),
    contactName: varchar("contact_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 20 }).notNull(),
    invoiceAddressLine1: varchar("invoice_address_line1", { length: 255 }).notNull(),
    invoiceAddressLine2: varchar("invoice_address_line2", { length: 255 }),
    invoiceCity: varchar("invoice_city", { length: 100 }).notNull(),
    invoicePostcode: varchar("invoice_postcode", { length: 20 }).notNull(),
    invoiceCountry: varchar("invoice_country", { length: 50 }).default("UK"),
    deliveryAddressLine1: varchar("delivery_address_line1", { length: 255 }),
    deliveryAddressLine2: varchar("delivery_address_line2", { length: 255 }),
    deliveryCity: varchar("delivery_city", { length: 100 }),
    deliveryPostcode: varchar("delivery_postcode", { length: 20 }),
    isTrainedCustomer: boolean("is_trained_customer").default(false),
    preferredHingeSpacing: varchar("preferred_hinge_spacing", { length: 100 }),
    defaultBorderWidth: integer("default_border_width").default(90),
    shopifyCustomerId: varchar("shopify_customer_id", { length: 50 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("idx_customer_email").on(table.email),
    shopifyIdIdx: index("idx_customer_shopify_id").on(table.shopifyCustomerId),
  })
);

// =====================================================
// DOOR STYLES TABLE
// =====================================================

export const doorStyles = pgTable("door_styles", {
  id: serial("id").primaryKey(),
  styleCode: varchar("style_code", { length: 20 }).notNull().unique(),
  styleName: varchar("style_name", { length: 100 }).notNull(),
  description: text("description"),
  thicknessMm: integer("thickness_mm").notNull().default(22),
  rebateWidthMm: integer("rebate_width_mm").default(10),
  rebateDepthMm: integer("rebate_depth_mm").default(14),
  frontFaceThicknessMm: integer("front_face_thickness_mm").default(8),
  cornerRadiusMm: decimal("corner_radius_mm", { precision: 4, scale: 1 }).default("2.5"),
  panelThicknessMm: integer("panel_thickness_mm").default(12),
  minBorderWidthMm: integer("min_border_width_mm").notNull().default(50),
  supportsAngled: boolean("supports_angled").default(true),
  supportsMidRails: boolean("supports_mid_rails").default(true),
  priceAdjustment: decimal("price_adjustment", { precision: 10, scale: 2 }).default("0.00"),
  isActive: boolean("is_active").default(true),
});

// =====================================================
// FINISH OPTIONS TABLE
// =====================================================

export const finishOptions = pgTable("finish_options", {
  id: serial("id").primaryKey(),
  finishCode: varchar("finish_code", { length: 30 }).notNull().unique(),
  finishName: varchar("finish_name", { length: 100 }).notNull(),
  description: text("description"),
  priceMultiplier: decimal("price_multiplier", { precision: 4, scale: 2 }).default("1.00"),
  fixedSurcharge: decimal("fixed_surcharge", { precision: 10, scale: 2 }).default("0.00"),
  isActive: boolean("is_active").default(true),
});

// =====================================================
// ORDERS TABLE
// =====================================================

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .references(() => customers.id)
      .notNull(),
    orderReference: varchar("order_reference", { length: 50 }).notNull().unique(),
    customerJobReference: varchar("customer_job_reference", { length: 100 }),
    orderDate: timestamp("order_date").defaultNow().notNull(),
    dateRequired: timestamp("date_required").notNull(),
    deliveryMethod: deliveryMethodEnum("delivery_method").notNull(),
    deliveryAddressLine1: varchar("delivery_address_line1", { length: 255 }),
    deliveryAddressLine2: varchar("delivery_address_line2", { length: 255 }),
    deliveryCity: varchar("delivery_city", { length: 100 }),
    deliveryPostcode: varchar("delivery_postcode", { length: 20 }),
    specialRequirements: text("special_requirements"),
    subtotalExcVat: decimal("subtotal_exc_vat", { precision: 10, scale: 2 }).notNull(),
    deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 }).default("0.00"),
    additionalCharges: decimal("additional_charges", { precision: 10, scale: 2 }).default("0.00"),
    additionalChargesDesc: varchar("additional_charges_desc", { length: 255 }),
    totalExcVat: decimal("total_exc_vat", { precision: 10, scale: 2 }).notNull(),
    vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).notNull(),
    totalIncVat: decimal("total_inc_vat", { precision: 10, scale: 2 }).notNull(),
    orderStatus: orderStatusEnum("order_status").default("DRAFT"),
    paymentStatus: paymentStatusEnum("payment_status").default("PENDING"),
    shopifyOrderId: varchar("shopify_order_id", { length: 50 }),
    shopifyDraftOrderId: varchar("shopify_draft_order_id", { length: 50 }),
    productionStatus: productionStatusEnum("production_status").default("NOT_STARTED"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orderRefIdx: uniqueIndex("idx_order_ref").on(table.orderReference),
    statusIdx: index("idx_order_status").on(table.orderStatus),
    dateRequiredIdx: index("idx_date_required").on(table.dateRequired),
    shopifyIdx: index("idx_shopify").on(table.shopifyOrderId),
  })
);

// =====================================================
// ORDER ITEMS TABLE (Door Lines)
// =====================================================

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    lineNumber: integer("line_number").notNull(),
    itemReference: varchar("item_reference", { length: 50 }),
    quantity: integer("quantity").notNull().default(1),
    styleId: integer("style_id")
      .references(() => doorStyles.id)
      .notNull(),
    finishId: integer("finish_id")
      .references(() => finishOptions.id)
      .notNull(),

    // Dimensions
    heightMm: integer("height_mm").notNull(),
    widthMm: integer("width_mm").notNull(),

    // Specifications
    panelType: panelTypeEnum("panel_type").default("STANDARD_12MM"),
    panelThicknessMm: integer("panel_thickness_mm").default(12),
    panelOrientation: varchar("panel_orientation", { length: 20 }).default("vertical"),
    material: varchar("material", { length: 50 }).default("MR MDF"),

    // Angled specifications
    isAngled: boolean("is_angled").default(false),
    angledShorterSide: angledSideEnum("angled_shorter_side"),
    angledShortHeightMm: integer("angled_short_height_mm"),
    angledFlatTopWidthMm: integer("angled_flat_top_width_mm"),
    leftAngleDegrees: decimal("left_angle_degrees", { precision: 5, scale: 2 }).default("0.00"),
    rightAngleDegrees: decimal("right_angle_degrees", { precision: 5, scale: 2 }).default("0.00"),
    leftTriangleCutoutWidth: integer("left_triangle_cutout_width").default(0),
    leftTriangleCutoutHeight: integer("left_triangle_cutout_height").default(0),
    rightTriangleCutoutWidth: integer("right_triangle_cutout_width").default(0),
    rightTriangleCutoutHeight: integer("right_triangle_cutout_height").default(0),

    // Panels
    numberOfPanels: integer("number_of_panels").default(1),
    panelCornerSquaring: boolean("panel_corner_squaring").default(false),

    // Border widths (mm)
    borderBottomRail: integer("border_bottom_rail"),
    borderTopRail: integer("border_top_rail"),
    borderLeftStile: integer("border_left_stile"),
    borderRightStile: integer("border_right_stile"),
    borderMidRail: integer("border_mid_rail"),

    // Rebate specifications (Wait for migration or use item_reference for these)

    // Hinge drilling
    hingeQuantity: integer("hinge_quantity").default(0),
    hingedSide: angledSideEnum("hinged_side"),
    hingeSpacingPattern: varchar("hinge_spacing_pattern", { length: 100 }),

    // Mid rails
    midRailsEqualise: boolean("mid_rails_equalise").default(false),

    // Calculated area (stored, not generated in PostgreSQL)
    doorAreaSqm: decimal("door_area_sqm", { precision: 6, scale: 4 }),

    // Pricing breakdown
    basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
    angledSurcharge: decimal("angled_surcharge", { precision: 10, scale: 2 }).default("0.00"),
    midRailSurcharge: decimal("mid_rail_surcharge", { precision: 10, scale: 2 }).default("0.00"),
    squaringSurcharge: decimal("squaring_surcharge", { precision: 10, scale: 2 }).default("0.00"),
    hingeSurcharge: decimal("hinge_surcharge", { precision: 10, scale: 2 }).default("0.00"),
    styleAdjustment: decimal("style_adjustment", { precision: 10, scale: 2 }).default("0.00"),
    finishAdjustment: decimal("finish_adjustment", { precision: 10, scale: 2 }).default("0.00"),
    manualAdjustment: decimal("manual_adjustment", { precision: 10, scale: 2 }).default("0.00"),
    unitPriceExcVat: decimal("unit_price_exc_vat", { precision: 10, scale: 2 }).notNull(),
    lineTotalExcVat: decimal("line_total_exc_vat", { precision: 10, scale: 2 }).notNull(),

    // Comments
    comments: text("comments"),

    // Production data
    dxfFileGenerated: boolean("dxf_file_generated").default(false),
    dxfFilePath: varchar("dxf_file_path", { length: 500 }),
    productionNotes: text("production_notes"),
  },
  (table) => ({
    orderIdx: index("idx_order_items_order").on(table.orderId),
  })
);



// =====================================================
// ORDER ITEM MID RAILS TABLE
// =====================================================

export const orderItemMidRails = pgTable(
  "order_item_mid_rails",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .references(() => orderItems.id, { onDelete: "cascade" })
      .notNull(),
    railNumber: integer("rail_number").notNull(),
    positionFromBottomMm: integer("position_from_bottom_mm").notNull(),
    railWidthMm: integer("rail_width_mm"),
  },
  (table) => ({
    itemRailUnique: uniqueIndex("uk_item_rail").on(table.itemId, table.railNumber),
  })
);

// =====================================================
// PRICE BRACKETS HEIGHT TABLE
// =====================================================

export const priceBracketsHeight = pgTable("price_brackets_height", {
  id: serial("id").primaryKey(),
  bracketName: varchar("bracket_name", { length: 50 }).notNull(),
  maxHeightMm: integer("max_height_mm").notNull().unique(),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").default(true),
});

// =====================================================
// PRICE BRACKETS WIDTH TABLE
// =====================================================

export const priceBracketsWidth = pgTable("price_brackets_width", {
  id: serial("id").primaryKey(),
  bracketName: varchar("bracket_name", { length: 50 }).notNull(),
  maxWidthMm: integer("max_width_mm").notNull().unique(),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").default(true),
});

// =====================================================
// PRICING MATRIX TABLE
// =====================================================

export const pricingMatrix = pgTable(
  "pricing_matrix",
  {
    id: serial("id").primaryKey(),
    heightBracketId: integer("height_bracket_id")
      .references(() => priceBracketsHeight.id)
      .notNull(),
    widthBracketId: integer("width_bracket_id")
      .references(() => priceBracketsWidth.id)
      .notNull(),
    basePriceExcVat: decimal("base_price_exc_vat", { precision: 10, scale: 2 }).notNull(),
    isValidCombination: boolean("is_valid_combination").default(true),
  },
  (table) => ({
    bracketComboUnique: uniqueIndex("uk_bracket_combo").on(
      table.heightBracketId,
      table.widthBracketId
    ),
  })
);

// =====================================================
// SURCHARGE TYPES TABLE
// =====================================================

export const surchargeTypes = pgTable("surcharge_types", {
  id: serial("id").primaryKey(),
  surchargeCode: varchar("surcharge_code", { length: 30 }).notNull().unique(),
  surchargeName: varchar("surcharge_name", { length: 100 }).notNull(),
  calculationType: calculationTypeEnum("calculation_type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true),
});

export const orderItemHinges = pgTable("order_item_hinges", {
  id: serial("id").primaryKey(),
  orderItemId: integer("order_item_id")
    .references(() => orderItems.id, { onDelete: "cascade" })
    .notNull(),
  hingeType: hingeTypeEnum("hinge_type").notNull().default("SCREW_POINTS"),
  positionFromBottomMm: integer("position_from_bottom_mm").notNull(),
  side: angledSideEnum("side").notNull().default("LEFT"), // Reuse angledSideEnum for LEFT/RIGHT
  cupDiameterMm: integer("cup_diameter_mm").default(35),
  cupDepthMm: integer("cup_depth_mm").default(13),
  gapToEdgeMm: integer("gap_to_edge_mm").default(5),
});

// =====================================================
// ORDER ATTACHMENTS TABLE
// =====================================================

export const orderAttachments = pgTable(
  "order_attachments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    itemId: integer("item_id").references(() => orderItems.id, { onDelete: "set null" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileType: fileTypeEnum("file_type").notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileSizeBytes: integer("file_size_bytes"),
    fileContent: text("file_content"), // Storing content directly (Text/Base64)
    description: varchar("description", { length: 255 }),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
    uploadedBy: varchar("uploaded_by", { length: 100 }),
  },
  (table) => ({
    orderIdx: index("idx_attachments_order").on(table.orderId),
  })
);

// =====================================================
// DELIVERY OPTIONS TABLE
// =====================================================

export const deliveryOptions = pgTable("delivery_options", {
  id: serial("id").primaryKey(),
  deliveryCode: varchar("delivery_code", { length: 20 }).notNull().unique(),
  deliveryName: varchar("delivery_name", { length: 100 }).notNull(),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  pricePerDoor: decimal("price_per_door", { precision: 10, scale: 2 }).default("0.00"),
  maxDistanceMiles: integer("max_distance_miles"),
  isActive: boolean("is_active").default(true),
});

// =====================================================
// SYSTEM SETTINGS TABLE
// =====================================================

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  settingKey: varchar("setting_key", { length: 50 }).notNull().unique(),
  settingValue: varchar("setting_value", { length: 500 }).notNull(),
  settingType: settingTypeEnum("setting_type").default("STRING"),
  description: varchar("description", { length: 255 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =====================================================
// SHOPIFY SYNC LOG TABLE
// =====================================================

export const shopifySyncLog = pgTable(
  "shopify_sync_log",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    syncType: syncTypeEnum("sync_type").notNull(),
    shopifyResponse: jsonb("shopify_response"),
    status: syncStatusEnum("status").default("PENDING"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index("idx_sync_log_order").on(table.orderId),
    statusIdx: index("idx_sync_log_status").on(table.status),
  })
);

// =====================================================
// PREVIEW CACHE TABLE
// =====================================================

export const previewCache = pgTable("preview_cache", {
  token: varchar("token", { length: 50 }).primaryKey(),
  svg: text("svg").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =====================================================
// RELATIONS
// =====================================================

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  attachments: many(orderAttachments),
  syncLogs: many(shopifySyncLog),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  style: one(doorStyles, {
    fields: [orderItems.styleId],
    references: [doorStyles.id],
  }),
  finish: one(finishOptions, {
    fields: [orderItems.finishId],
    references: [finishOptions.id],
  }),
  hinges: many(orderItemHinges),
  midRails: many(orderItemMidRails),
}));

export const orderItemHingesRelations = relations(orderItemHinges, ({ one }) => ({
  item: one(orderItems, {
    fields: [orderItemHinges.orderItemId],
    references: [orderItems.id],
  }),
}));

export const orderItemMidRailsRelations = relations(orderItemMidRails, ({ one }) => ({
  item: one(orderItems, {
    fields: [orderItemMidRails.itemId],
    references: [orderItems.id],
  }),
}));

export const pricingMatrixRelations = relations(pricingMatrix, ({ one }) => ({
  heightBracket: one(priceBracketsHeight, {
    fields: [pricingMatrix.heightBracketId],
    references: [priceBracketsHeight.id],
  }),
  widthBracket: one(priceBracketsWidth, {
    fields: [pricingMatrix.widthBracketId],
    references: [priceBracketsWidth.id],
  }),
}));

export const orderAttachmentsRelations = relations(orderAttachments, ({ one }) => ({
  order: one(orders, {
    fields: [orderAttachments.orderId],
    references: [orders.id],
  }),
  item: one(orderItems, {
    fields: [orderAttachments.itemId],
    references: [orderItems.id],
  }),
}));

export const shopifySyncLogRelations = relations(shopifySyncLog, ({ one }) => ({
  order: one(orders, {
    fields: [shopifySyncLog.orderId],
    references: [orders.id],
  }),
}));

// =====================================================
// TYPES
// =====================================================

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

export type DoorStyle = typeof doorStyles.$inferSelect;
export type InsertDoorStyle = typeof doorStyles.$inferInsert;

export type FinishOption = typeof finishOptions.$inferSelect;
export type InsertFinishOption = typeof finishOptions.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

export type OrderItemHinge = typeof orderItemHinges.$inferSelect;
export type InsertOrderItemHinge = typeof orderItemHinges.$inferInsert;

export type OrderItemMidRail = typeof orderItemMidRails.$inferSelect;
export type InsertOrderItemMidRail = typeof orderItemMidRails.$inferInsert;

export type PriceBracketHeight = typeof priceBracketsHeight.$inferSelect;
export type InsertPriceBracketHeight = typeof priceBracketsHeight.$inferInsert;

export type PriceBracketWidth = typeof priceBracketsWidth.$inferSelect;
export type InsertPriceBracketWidth = typeof priceBracketsWidth.$inferInsert;

export type PricingMatrixEntry = typeof pricingMatrix.$inferSelect;
export type InsertPricingMatrixEntry = typeof pricingMatrix.$inferInsert;

export type SurchargeType = typeof surchargeTypes.$inferSelect;
export type InsertSurchargeType = typeof surchargeTypes.$inferInsert;

export type OrderAttachment = typeof orderAttachments.$inferSelect;
export type InsertOrderAttachment = typeof orderAttachments.$inferInsert;

export type DeliveryOption = typeof deliveryOptions.$inferSelect;
export type InsertDeliveryOption = typeof deliveryOptions.$inferInsert;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

export type ShopifySyncLogEntry = typeof shopifySyncLog.$inferSelect;
export type InsertShopifySyncLogEntry = typeof shopifySyncLog.$inferInsert;

// =====================================================
// ZOD SCHEMAS
// =====================================================

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginUser = z.infer<typeof loginSchema>;

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertDoorStyleSchema = createInsertSchema(doorStyles).omit({
  id: true,
});

export const insertFinishOptionSchema = createInsertSchema(finishOptions).omit({
  id: true,
});
