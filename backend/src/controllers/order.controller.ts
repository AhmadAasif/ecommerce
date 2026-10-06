import { Request, Response } from "express";
import pool from "../config/database.js";

export const createOrder = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { cartId,customerName,customerEmail,customerPhone,shippingAddress } = req.body;
    if (!cartId || !customerName || !customerEmail || !customerPhone || !shippingAddress) {
      res.status(400).json({success:false,message:"All checkout details are required"}); return;
    }

    await client.query("BEGIN");
    const cartResult = await client.query(`
      SELECT ci.id AS cart_item_id,ci.product_id,ci.variant_id,ci.quantity,
             p.name AS product_name,pv.sku,pv.size,pv.color,pv.price,pv.stock_quantity
      FROM cart_items ci JOIN products p ON p.id=ci.product_id
      JOIN product_variants pv ON pv.id=ci.variant_id
      WHERE ci.cart_id=$1 AND p.status='active' AND pv.status='active'
      FOR UPDATE OF pv
    `, [cartId]);

    if (!cartResult.rows.length) { await client.query("ROLLBACK"); res.status(400).json({success:false,message:"Cart is empty"}); return; }

    let subtotal = 0;
    for (const item of cartResult.rows) {
      if (item.quantity > item.stock_quantity) { await client.query("ROLLBACK"); res.status(400).json({success:false,message:`Insufficient stock for ${item.product_name}`}); return; }
      subtotal += Number(item.price) * Number(item.quantity);
    }

    const shippingFee = subtotal >= 2000 ? 0 : 100;
    const totalAmount = subtotal + shippingFee;
    const orderNumber = `ORD-${Date.now()}`;

    const orderResult = await client.query(`
      INSERT INTO orders (order_number,customer_name,customer_email,customer_phone,shipping_address,subtotal,shipping_fee,discount_amount,total_amount,payment_status,order_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,'pending','pending')
      RETURNING id,order_number,customer_name,customer_email,customer_phone,shipping_address,subtotal,shipping_fee,discount_amount,total_amount,payment_status,order_status,created_at
    `, [orderNumber,customerName,customerEmail,customerPhone,shippingAddress,subtotal,shippingFee,totalAmount]);

    const order = orderResult.rows[0];
    for (const item of cartResult.rows) {
      await client.query(`
        INSERT INTO order_items (order_id,product_id,variant_id,product_name,sku,size,color,quantity,unit_price,total_price)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [order.id,item.product_id,item.variant_id,item.product_name,item.sku,item.size,item.color,item.quantity,item.price,Number(item.price)*Number(item.quantity)]);

      await client.query("UPDATE product_variants SET stock_quantity=stock_quantity-$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2", [item.quantity,item.variant_id]);
    }

    await client.query("DELETE FROM cart_items WHERE cart_id=$1", [cartId]);
    await client.query("COMMIT");

    res.status(201).json({success:true,message:"Order created successfully",data:{order,items:cartResult.rows}});
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create order error:",error);
    res.status(500).json({success:false,message:"Failed to create order"});
  } finally { client.release(); }
};