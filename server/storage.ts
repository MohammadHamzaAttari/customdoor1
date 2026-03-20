import { eq, and, gte, asc, desc, lt } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  customers,
  orders,
  orderItems,
  orderItemHinges,
  orderItemMidRails,
  doorStyles,
  finishOptions,
  priceBracketsHeight,
  priceBracketsWidth,
  pricingMatrix,
  surchargeTypes,
  orderAttachments,
  deliveryOptions,
  systemSettings,
  shopifySyncLog,
  previewCache,
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type OrderItemHinge,
  type InsertOrderItemHinge,
  type OrderItemMidRail,
  type InsertOrderItemMidRail,
  type DoorStyle,
  type InsertDoorStyle,
  type FinishOption,
  type InsertFinishOption,
  type PriceBracketHeight,
  type PriceBracketWidth,
  type PricingMatrixEntry,
  type SurchargeType,
  type DeliveryOption,
  type SystemSetting,
  type InsertSystemSetting,
  type ShopifySyncLogEntry,
  type InsertShopifySyncLogEntry,
  type OrderAttachment,
  type InsertOrderAttachment,
} from "../shared/schema";
import type { DoorConfig, CartItem } from "../shared/doorSchema";

// =====================================================
// STORAGE INTERFACE
// =====================================================

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;

  // Customers
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  getAllCustomers(): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;

  // Door Styles
  getDoorStyle(id: number): Promise<DoorStyle | undefined>;
  getDoorStyleByCode(code: string): Promise<DoorStyle | undefined>;
  getAllDoorStyles(): Promise<DoorStyle[]>;

  // Finish Options
  getFinishOption(id: number): Promise<FinishOption | undefined>;
  getFinishOptionByCode(code: string): Promise<FinishOption | undefined>;
  getAllFinishOptions(): Promise<FinishOption[]>;

  // Orders
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByReference(reference: string): Promise<Order | undefined>;
  getOrdersByCustomer(customerId: number): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>;

  // Order Items
  getOrderItem(id: number): Promise<OrderItem | undefined>;
  getOrderItemsByOrder(orderId: number): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  updateOrderItem(id: number, item: Partial<InsertOrderItem>): Promise<OrderItem | undefined>;
  deleteOrderItem(id: number): Promise<boolean>;

  // Order Item Hinges
  getHingesByItem(itemId: number): Promise<OrderItemHinge[]>;
  createHinge(hinge: InsertOrderItemHinge): Promise<OrderItemHinge>;
  deleteHingesByItem(itemId: number): Promise<boolean>;

  // Order Item Mid Rails
  getMidRailsByItem(itemId: number): Promise<OrderItemMidRail[]>;
  createMidRail(rail: InsertOrderItemMidRail): Promise<OrderItemMidRail>;
  deleteMidRailsByItem(itemId: number): Promise<boolean>;

  // Pricing
  getPriceBracketsHeight(): Promise<PriceBracketHeight[]>;
  getPriceBracketsWidth(): Promise<PriceBracketWidth[]>;
  getPriceForDimensions(heightMm: number, widthMm: number): Promise<PricingMatrixEntry | undefined>;
  getSurchargeByCode(code: string): Promise<SurchargeType | undefined>;
  getAllSurcharges(): Promise<SurchargeType[]>;

  // Delivery Options
  getAllDeliveryOptions(): Promise<DeliveryOption[]>;
  getDeliveryOptionByCode(code: string): Promise<DeliveryOption | undefined>;

  // System Settings
  getSetting(key: string): Promise<SystemSetting | undefined>;
  getAllSettings(): Promise<SystemSetting[]>;
  updateSetting(key: string, value: string): Promise<SystemSetting | undefined>;

  // Price Calculation
  calculateDoorPrice(params: {
    heightMm: number;
    widthMm: number;
    styleCode: string;
    isAngled: boolean;
    panelType: string;
    numMidRails: number;
    hingeQty: number;
    finish: string;
  }): Promise<number>;

  // Legacy support for existing cart functionality
  saveDoorConfig(config: DoorConfig): Promise<{ id: number; config: DoorConfig }>;
  getDoorConfig(id: number): Promise<DoorConfig | undefined>;
  addToCart(item: Omit<CartItem, "id">): Promise<CartItem>;
  getCartItems(): Promise<CartItem[]>;
  removeFromCart(id: number): Promise<boolean>;
  clearCart(): Promise<void>;

  // Shopify Sync
  logShopifySync(entry: InsertShopifySyncLogEntry): Promise<ShopifySyncLogEntry>;
  getShopifySyncLogs(orderId: number): Promise<ShopifySyncLogEntry[]>;

  // Order Attachments
  createOrderAttachment(attachment: InsertOrderAttachment): Promise<OrderAttachment>;
  getOrderAttachments(orderId: number): Promise<OrderAttachment[]>;

  // Preview Cache (Persistent SVG storage for Shopify images)
  savePreview(token: string, svg: string): Promise<void>;
  getPreview(token: string): Promise<string | undefined>;
  cleanupOldPreviews(maxAgeMs: number): Promise<void>;
}

// =====================================================
// DATABASE STORAGE IMPLEMENTATION
// =====================================================

export class DatabaseStorage implements IStorage {
  // In-memory cart for session-based cart (will be replaced with proper session handling)
  private cartItems: Map<number, CartItem> = new Map();
  private doorConfigs: Map<number, DoorConfig> = new Map();
  private currentConfigId = 1;
  private currentCartId = 1;

  // =====================================================
  // USERS
  // =====================================================

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.resetToken, token),
          gte(users.resetTokenExpiry, new Date())
        )
      );
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: number, user: Partial<User>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  // =====================================================
  // CUSTOMERS
  // =====================================================

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    return customer;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return db.select().from(customers).orderBy(asc(customers.companyName));
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [created] = await db.insert(customers).values(customer).returning();
    return created;
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updated] = await db
      .update(customers)
      .set({ ...customer, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updated;
  }

  // =====================================================
  // DOOR STYLES
  // =====================================================

  async getDoorStyle(id: number): Promise<DoorStyle | undefined> {
    const [style] = await db.select().from(doorStyles).where(eq(doorStyles.id, id));
    return style;
  }

  async getDoorStyleByCode(code: string): Promise<DoorStyle | undefined> {
    const [style] = await db.select().from(doorStyles).where(eq(doorStyles.styleCode, code));
    return style;
  }

  async getAllDoorStyles(): Promise<DoorStyle[]> {
    return db.select().from(doorStyles).where(eq(doorStyles.isActive, true));
  }

  // =====================================================
  // FINISH OPTIONS
  // =====================================================

  async getFinishOption(id: number): Promise<FinishOption | undefined> {
    const [finish] = await db.select().from(finishOptions).where(eq(finishOptions.id, id));
    return finish;
  }

  async getFinishOptionByCode(code: string): Promise<FinishOption | undefined> {
    const [finish] = await db.select().from(finishOptions).where(eq(finishOptions.finishCode, code));
    return finish;
  }

  async getAllFinishOptions(): Promise<FinishOption[]> {
    return db.select().from(finishOptions).where(eq(finishOptions.isActive, true));
  }

  // =====================================================
  // ORDERS
  // =====================================================

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderByReference(reference: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderReference, reference));
    return order;
  }

  async getOrdersByCustomer(customerId: number): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.orderDate));
  }

  async getAllOrders(): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.orderDate));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }

  async updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined> {
    const [updated] = await db
      .update(orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  // =====================================================
  // ORDER ITEMS
  // =====================================================

  async getOrderItem(id: number): Promise<OrderItem | undefined> {
    const [item] = await db.select().from(orderItems).where(eq(orderItems.id, id));
    return item;
  }

  async getOrderItemsByOrder(orderId: number): Promise<OrderItem[]> {
    return db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.lineNumber));
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    // Calculate door area
    const doorAreaSqm = ((item.heightMm * item.widthMm) / 1000000).toFixed(4);
    const [created] = await db
      .insert(orderItems)
      .values({ ...item, doorAreaSqm })
      .returning();
    return created;
  }

  async updateOrderItem(id: number, item: Partial<InsertOrderItem>): Promise<OrderItem | undefined> {
    // Recalculate door area if dimensions changed
    const updateData: any = { ...item };
    if (item.heightMm && item.widthMm) {
      updateData.doorAreaSqm = ((item.heightMm * item.widthMm) / 1000000).toFixed(4);
    }

    const [updated] = await db
      .update(orderItems)
      .set(updateData)
      .where(eq(orderItems.id, id))
      .returning();
    return updated;
  }

  async deleteOrderItem(id: number): Promise<boolean> {
    const result = await db.delete(orderItems).where(eq(orderItems.id, id));
    return true;
  }

  // =====================================================
  // ORDER ITEM HINGES
  // =====================================================

  async getHingesByItem(itemId: number): Promise<OrderItemHinge[]> {
    return db
      .select()
      .from(orderItemHinges)
      .where(eq(orderItemHinges.orderItemId, itemId))
      .orderBy(asc(orderItemHinges.positionFromBottomMm));
  }

  async createHinge(hinge: InsertOrderItemHinge): Promise<OrderItemHinge> {
    const [created] = await db.insert(orderItemHinges).values(hinge).returning();
    return created;
  }

  async deleteHingesByItem(itemId: number): Promise<boolean> {
    await db.delete(orderItemHinges).where(eq(orderItemHinges.orderItemId, itemId));
    return true;
  }

  // =====================================================
  // ORDER ITEM MID RAILS
  // =====================================================

  async getMidRailsByItem(itemId: number): Promise<OrderItemMidRail[]> {
    return db
      .select()
      .from(orderItemMidRails)
      .where(eq(orderItemMidRails.itemId, itemId))
      .orderBy(asc(orderItemMidRails.railNumber));
  }

  async createMidRail(rail: InsertOrderItemMidRail): Promise<OrderItemMidRail> {
    const [created] = await db.insert(orderItemMidRails).values(rail).returning();
    return created;
  }

  async deleteMidRailsByItem(itemId: number): Promise<boolean> {
    await db.delete(orderItemMidRails).where(eq(orderItemMidRails.itemId, itemId));
    return true;
  }

  // =====================================================
  // PRICING
  // =====================================================

  async getPriceBracketsHeight(): Promise<PriceBracketHeight[]> {
    return db
      .select()
      .from(priceBracketsHeight)
      .where(eq(priceBracketsHeight.isActive, true))
      .orderBy(asc(priceBracketsHeight.sortOrder));
  }

  async getPriceBracketsWidth(): Promise<PriceBracketWidth[]> {
    return db
      .select()
      .from(priceBracketsWidth)
      .where(eq(priceBracketsWidth.isActive, true))
      .orderBy(asc(priceBracketsWidth.sortOrder));
  }

  async getPriceForDimensions(heightMm: number, widthMm: number): Promise<PricingMatrixEntry | undefined> {
    // Find the appropriate height bracket
    const [heightBracket] = await db
      .select()
      .from(priceBracketsHeight)
      .where(and(eq(priceBracketsHeight.isActive, true), gte(priceBracketsHeight.maxHeightMm, heightMm)))
      .orderBy(asc(priceBracketsHeight.maxHeightMm))
      .limit(1);

    if (!heightBracket) return undefined;

    // Find the appropriate width bracket
    const [widthBracket] = await db
      .select()
      .from(priceBracketsWidth)
      .where(and(eq(priceBracketsWidth.isActive, true), gte(priceBracketsWidth.maxWidthMm, widthMm)))
      .orderBy(asc(priceBracketsWidth.maxWidthMm))
      .limit(1);

    if (!widthBracket) return undefined;

    // Get the price from the matrix
    const [price] = await db
      .select()
      .from(pricingMatrix)
      .where(
        and(
          eq(pricingMatrix.heightBracketId, heightBracket.id),
          eq(pricingMatrix.widthBracketId, widthBracket.id),
          eq(pricingMatrix.isValidCombination, true)
        )
      );

    return price;
  }

  async getSurchargeByCode(code: string): Promise<SurchargeType | undefined> {
    const [surcharge] = await db
      .select()
      .from(surchargeTypes)
      .where(and(eq(surchargeTypes.surchargeCode, code), eq(surchargeTypes.isActive, true)));
    return surcharge;
  }

  async getAllSurcharges(): Promise<SurchargeType[]> {
    return db.select().from(surchargeTypes).where(eq(surchargeTypes.isActive, true));
  }

  // =====================================================
  // DELIVERY OPTIONS
  // =====================================================

  async getAllDeliveryOptions(): Promise<DeliveryOption[]> {
    return db.select().from(deliveryOptions).where(eq(deliveryOptions.isActive, true));
  }

  async getDeliveryOptionByCode(code: string): Promise<DeliveryOption | undefined> {
    const [option] = await db
      .select()
      .from(deliveryOptions)
      .where(eq(deliveryOptions.deliveryCode, code));
    return option;
  }

  // =====================================================
  // SYSTEM SETTINGS
  // =====================================================

  async getSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, key));
    return setting;
  }

  async getAllSettings(): Promise<SystemSetting[]> {
    return db.select().from(systemSettings);
  }

  async updateSetting(key: string, value: string): Promise<SystemSetting | undefined> {
    const [updated] = await db
      .insert(systemSettings)
      .values({
        settingKey: key,
        settingValue: value,
        settingType: "STRING",
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: {
          settingValue: value,
          updatedAt: new Date()
        },
      })
      .returning();
    return updated;
  }

  // =====================================================
  // PRICE CALCULATION
  // =====================================================

  // In storage.ts, replace the calculateDoorPrice method:

  async calculateDoorPrice(params: {
    heightMm: number;
    widthMm: number;
    styleCode: string;
    isAngled: boolean;
    panelType: string;
    numMidRails: number;
    hingeQty: number;
    finish: string;
  }): Promise<number> {
    const { heightMm, widthMm, isAngled, panelType, numMidRails, hingeQty, finish } = params;

    const FIXED_FEE_PER_DOOR = 3.00;
    const PRICE_PER_SQM_SHAKER = 75.00;
    const PRICE_PER_SQM_SLAB = 45.00;
    const ANGLED_DOOR_FEE = 25.00;
    const MID_RAIL_FEE = 5.00;
    const HINGE_HOLE_FEE = 1.50;

    // Door area (always full rectangular, even if angled — per spec)
    const doorAreaSqm = (heightMm * widthMm) / 1000000;

    const isSlab = panelType === "NONE";
    const pricePerSqm = isSlab ? PRICE_PER_SQM_SLAB : PRICE_PER_SQM_SHAKER;

    let price = FIXED_FEE_PER_DOOR + (doorAreaSqm * pricePerSqm);

    if (isAngled) {
      price += ANGLED_DOOR_FEE;
    }

    price += numMidRails * MID_RAIL_FEE;
    price += hingeQty * HINGE_HOLE_FEE;

    // Panel upgrades — use PANEL area not door area (per spec)
    // Approximate panel area: assume default 90mm borders
    const defaultBorder = 90;
    const panelWidthMm = Math.max(0, widthMm - defaultBorder * 2);
    const panelHeightMm = Math.max(0, heightMm - defaultBorder * 2);
    const panelAreaSqm = (panelWidthMm * panelHeightMm) / 1000000;

    if (panelType === "REEDED_19MM") {
      price += 10 + (panelAreaSqm * 60);  // £10 fixed + £60/m² of PANEL
    } else if (panelType === "MELAMINE_18MM") {
      price += 10 + (panelAreaSqm * 40);  // £10 fixed + £40/m² of PANEL
    }

    // FIX: Finish is NOT a multiplier per spec — it's additive
    // The spec says pricing formula is purely additive
    // Finish surcharges should come from the finishOptions DB table
    // For now, keep them as fixed surcharges, NOT multipliers
    const finishSurcharges: Record<string, number> = {
      RAW_UNASSEMBLED: 0,
      ASSEMBLED_PREP: 0,  // TODO: Set actual surcharge when determined
      PRIMED: 0,          // TODO: Set actual surcharge when determined (priced highly as disincentive)
    };
    price += finishSurcharges[finish] || 0;

    return Math.round(price * 100) / 100;
  }
  // =====================================================
  // LEGACY CART SUPPORT (In-memory for now)
  // =====================================================

  async saveDoorConfig(config: DoorConfig): Promise<{ id: number; config: DoorConfig }> {
    const id = this.currentConfigId++;
    this.doorConfigs.set(id, config);
    return { id, config };
  }

  async getDoorConfig(id: number): Promise<DoorConfig | undefined> {
    return this.doorConfigs.get(id);
  }

  async addToCart(item: Omit<CartItem, "id">): Promise<CartItem> {
    const id = this.currentCartId++;
    const cartItem: CartItem = { ...item, id };
    this.cartItems.set(id, cartItem);
    return cartItem;
  }

  async getCartItems(): Promise<CartItem[]> {
    return Array.from(this.cartItems.values());
  }

  async removeFromCart(id: number): Promise<boolean> {
    return this.cartItems.delete(id);
  }

  async clearCart(): Promise<void> {
    this.cartItems.clear();
  }

  // =====================================================
  // SHOPIFY SYNC
  // =====================================================

  async logShopifySync(entry: InsertShopifySyncLogEntry): Promise<ShopifySyncLogEntry> {
    const [log] = await db.insert(shopifySyncLog).values(entry).returning();
    return log;
  }

  async getShopifySyncLogs(orderId: number): Promise<ShopifySyncLogEntry[]> {
    return db.select().from(shopifySyncLog).where(eq(shopifySyncLog.orderId, orderId)).orderBy(desc(shopifySyncLog.createdAt));
  }

  // =====================================================
  // ORDER ATTACHMENTS
  // =====================================================

  async createOrderAttachment(attachment: InsertOrderAttachment): Promise<OrderAttachment> {
    const [created] = await db.insert(orderAttachments).values(attachment).returning();
    return created;
  }

  async getOrderAttachments(orderId: number): Promise<OrderAttachment[]> {
    return db.select().from(orderAttachments).where(eq(orderAttachments.orderId, orderId));
  }

  // =====================================================
  // PREVIEW CACHE
  // =====================================================

  async savePreview(token: string, svg: string): Promise<void> {
    await db
      .insert(previewCache)
      .values({
        token,
        svg,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: previewCache.token,
        set: { svg, createdAt: new Date() },
      });
  }

  async getPreview(token: string): Promise<string | undefined> {
    const [preview] = await db
      .select()
      .from(previewCache)
      .where(eq(previewCache.token, token));
    return preview?.svg;
  }

  async cleanupOldPreviews(maxAgeMs: number): Promise<void> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    await db.delete(previewCache).where(lt(previewCache.createdAt, cutoff));
  }
}

// Export singleton instance
export const storage = new DatabaseStorage();
