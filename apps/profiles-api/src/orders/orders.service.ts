import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { getSupabaseAdmin } from "../config/supabase.config";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto, UpdateOrderItemDto } from "./dto/update-order.dto";

@Injectable()
export class OrdersService {
  private readonly supabase = getSupabaseAdmin();

  async findAll(companyId: string) {
    const { data: orders, error } = await this.supabase
      .from("profile_orders")
      .select(
        `
        *,
        order_items (
          id,
          profile_id,
          color,
          length_meters,
          quantity_pieces,
          weight_per_piece,
          total_weight_kg,
          price_per_kg,
          price_per_piece,
          subtotal,
          aluminum_profiles (
            id,
            code,
            name_he,
            name_ru,
            name_en,
            image_url
          )
        )
      `,
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to fetch orders: ${error.message}`,
      );
    }

    return orders || [];
  }

  async findOne(id: string, companyId: string) {
    const { data: order, error } = await this.supabase
      .from("profile_orders")
      .select(
        `
        *,
        order_items (
          id,
          profile_id,
          color,
          length_meters,
          quantity_pieces,
          weight_per_piece,
          total_weight_kg,
          price_per_kg,
          price_per_piece,
          subtotal,
          aluminum_profiles (
            id,
            code,
            name_he,
            name_ru,
            name_en,
            image_url
          )
        )
      `,
      )
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (error) {
      throw new InternalServerErrorException(
        `Failed to fetch order: ${error.message}`,
      );
    }

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  async create(dto: CreateOrderDto, companyId: string) {
    if (!companyId) {
      throw new BadRequestException("company_id is required");
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException("Order must contain at least one item");
    }

    // Fetch profile weights to calculate order totals
    const profileIds = [...new Set(dto.items.map((item) => item.profile_id))];
    const { data: profiles, error: profilesError } = await this.supabase
      .from("aluminum_profiles")
      .select("id, weight_per_meter, price_per_kg")
      .in("id", profileIds)
      .eq("company_id", companyId);

    if (profilesError) {
      throw new InternalServerErrorException(
        `Failed to fetch profiles: ${profilesError.message}`,
      );
    }

    if (profiles.length !== profileIds.length) {
      throw new BadRequestException("One or more profiles not found");
    }

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    // Calculate order totals
    let totalWeightKg = 0;
    let totalAmount = 0;

    const orderItems = dto.items.map((item) => {
      const profile = profileMap.get(item.profile_id);
      if (!profile) {
        throw new BadRequestException(`Profile ${item.profile_id} not found`);
      }

      const weightPerPiece = profile.weight_per_meter * item.length_meters;
      const itemTotalWeight = weightPerPiece * item.quantity_pieces;
      const itemSubtotal = item.price_per_piece * item.quantity_pieces;

      totalWeightKg += itemTotalWeight;
      totalAmount += itemSubtotal;

      return {
        profile_id: item.profile_id,
        color: item.color,
        length_meters: item.length_meters,
        quantity_pieces: item.quantity_pieces,
        weight_per_piece: weightPerPiece,
        total_weight_kg: itemTotalWeight,
        price_per_kg: profile.price_per_kg,
        price_per_piece: item.price_per_piece,
        subtotal: itemSubtotal,
      };
    });

    // Create order
    const { data: order, error: orderError } = await this.supabase
      .from("profile_orders")
      .insert({
        company_id: companyId,
        customer_name: dto.customer.name,
        customer_phone: dto.customer.phone,
        customer_email: dto.customer.email,
        customer_city: dto.customer.city,
        delivery_address: dto.customer.address,
        status: "pending_price",
        total_weight_kg: totalWeightKg,
        total_amount: totalAmount,
        final_amount: totalAmount, // Initially same as total, admin can adjust
        source: "website",
      })
      .select()
      .single();

    if (orderError) {
      throw new InternalServerErrorException(
        `Failed to create order: ${orderError.message}`,
      );
    }

    // Create order items
    const { data: items, error: itemsError } = await this.supabase
      .from("order_items")
      .insert(
        orderItems.map((item) => ({
          order_id: order.id,
          ...item,
        })),
      )
      .select();

    if (itemsError) {
      // Rollback order if items fail
      await this.supabase.from("profile_orders").delete().eq("id", order.id);
      throw new InternalServerErrorException(
        `Failed to create order items: ${itemsError.message}`,
      );
    }

    return {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      total_amount: order.total_amount,
      items: items,
    };
  }

  async update(id: string, dto: UpdateOrderDto, companyId: string) {
    // Verify order exists and belongs to company
    const { data: existingOrder, error: findError } = await this.supabase
      .from("profile_orders")
      .select("id, total_amount, priced_at")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (findError || !existingOrder) {
      throw new NotFoundException("Order not found");
    }

    // Calculate final_amount if discount is provided
    let finalAmount = dto.final_amount;
    if (
      dto.discount_percent !== undefined ||
      dto.discount_amount !== undefined
    ) {
      const baseAmount = existingOrder.total_amount || 0;
      if (dto.discount_percent !== undefined) {
        finalAmount = baseAmount * (1 - dto.discount_percent / 100);
      } else if (dto.discount_amount !== undefined) {
        finalAmount = baseAmount - dto.discount_amount;
      }
    }

    const updateData: Record<string, unknown> = { ...dto };
    if (finalAmount !== undefined) {
      updateData.final_amount = finalAmount;
    }
    if (dto.status === "priced" && !existingOrder.priced_at) {
      updateData.priced_at = new Date().toISOString();
    }

    const { data: order, error } = await this.supabase
      .from("profile_orders")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", companyId)
      .select(
        `
        *,
        order_items (
          id,
          profile_id,
          color,
          length_meters,
          quantity_pieces,
          weight_per_piece,
          total_weight_kg,
          price_per_kg,
          price_per_piece,
          subtotal,
          aluminum_profiles (
            id,
            code,
            name_he,
            name_ru,
            name_en
          )
        )
      `,
      )
      .single();

    if (error) {
      throw new InternalServerErrorException(
        `Failed to update order: ${error.message}`,
      );
    }

    return order;
  }

  async updateOrderItem(
    orderId: string,
    itemId: string,
    dto: UpdateOrderItemDto,
    companyId: string,
  ) {
    // Verify order exists and belongs to company
    const { data: order, error: orderError } = await this.supabase
      .from("profile_orders")
      .select("id")
      .eq("id", orderId)
      .eq("company_id", companyId)
      .single();

    if (orderError || !order) {
      throw new NotFoundException("Order not found");
    }

    // Get the order item
    const { data: item, error: itemError } = await this.supabase
      .from("order_items")
      .select("quantity_pieces")
      .eq("id", itemId)
      .eq("order_id", orderId)
      .single();

    if (itemError || !item) {
      throw new NotFoundException("Order item not found");
    }

    // Update item price, color and recalculate subtotal
    const subtotal = dto.price_per_piece * item.quantity_pieces;

    const updatePayload: Record<string, unknown> = {
      price_per_piece: dto.price_per_piece,
      subtotal: subtotal,
    };
    if (dto.color !== undefined) {
      updatePayload.color = dto.color;
    }

    const { data: updatedItem, error: updateError } = await this.supabase
      .from("order_items")
      .update(updatePayload)
      .eq("id", itemId)
      .select()
      .single();

    if (updateError) {
      throw new InternalServerErrorException(
        `Failed to update order item: ${updateError.message}`,
      );
    }

    // Recalculate order totals
    const { data: allItems } = await this.supabase
      .from("order_items")
      .select("subtotal")
      .eq("order_id", orderId);

    const newTotalAmount =
      allItems?.reduce((sum, i) => sum + (i.subtotal || 0), 0) || 0;

    await this.supabase
      .from("profile_orders")
      .update({
        total_amount: newTotalAmount,
        final_amount: newTotalAmount, // Reset final_amount to match total, admin can adjust
      })
      .eq("id", orderId);

    return updatedItem;
  }

  async delete(id: string, companyId: string) {
    const { data: order, error: findError } = await this.supabase
      .from("profile_orders")
      .select("id")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (findError || !order) {
      throw new NotFoundException("Order not found");
    }

    const { error: deleteError } = await this.supabase
      .from("profile_orders")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (deleteError) {
      throw new InternalServerErrorException(
        `Failed to delete order: ${deleteError.message}`,
      );
    }

    return { success: true };
  }
}
