/**
 * Customer Service
 * Customer records + WhatsApp conversation + orders.
 */
const Customer = require('../models/Customer');
const CustomerOrder = require('../models/CustomerOrder');
const auditHelper = require('../utils/auditHelper');

// ============================================================
// List customers
// ============================================================
async function listCustomers(req) {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company, isActive: true };

    if (req.user.role !== 'employer') {
        if (req.user.activeRoles?.includes('manager') || req.user.activeRoles?.includes('sales')) {
            query.branch = { $in: [req.user.branch, null] };
        } else {
            throw { status: 403, message: 'Not authorized to view customers' };
        }
    }

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
        ];
    }

    const customers = await Customer.find(query)
        .sort({ lastOrderAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Customer.countDocuments(query);

    const viewerRole = req.user.role === 'employer' ? 'employer'
        : (req.user.activeRoles?.includes('manager') ? 'manager' : 'sales');

    return {
        customers: customers.map(c => c.toPublicJSON(viewerRole)),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

// ============================================================
// Get customer
// ============================================================
async function getCustomer(req, id) {
    const customer = await Customer.findOne({ _id: id, company: req.user.company });
    if (!customer) throw { status: 404, message: 'Customer not found' };

    const viewerRole = req.user.role === 'employer' ? 'employer'
        : (req.user.activeRoles?.includes('manager') ? 'manager' : 'sales');

    return customer.toPublicJSON(viewerRole);
}

// ============================================================
// Create customer (sales/manager/employer)
// ============================================================
async function createCustomer(req, data) {
    const { name, phone, email, address } = data;

    if (!name || !phone) throw { status: 400, message: 'Name and phone required' };

    // Check duplicate
    const existing = await Customer.findOne({ company: req.user.company, phone });
    if (existing) throw { status: 400, message: 'Customer with this phone already exists' };

    const customer = await Customer.create({
        company: req.user.company,
        branch: req.user.branch || null,
        name,
        phone,
        email: email || '',
        address: address || '',
        createdBy: req.user._id
    });

    await auditHelper.log(req, {
        action: 'CUSTOMER_CREATE',
        entityType: 'Customer',
        entityId: customer._id,
        entityName: customer.name
    });

    return customer.toPublicJSON('sales');
}

// ============================================================
// Update customer
// ============================================================
async function updateCustomer(req, id, data) {
    const customer = await Customer.findOne({ _id: id, company: req.user.company });
    if (!customer) throw { status: 404, message: 'Customer not found' };

    if (data.name !== undefined) customer.name = data.name;
    if (data.email !== undefined) customer.email = data.email;
    if (data.address !== undefined) customer.address = data.address;
    if (data.preferences !== undefined) customer.preferences = data.preferences;
    if (data.whatsappOptIn !== undefined) customer.whatsapp.optedIn = data.whatsappOptIn;

    await customer.save();

    await auditHelper.log(req, {
        action: 'CUSTOMER_UPDATE',
        entityType: 'Customer',
        entityId: customer._id,
        entityName: customer.name
    });

    return customer.toPublicJSON('sales');
}

// ============================================================
// Add conversation entry
// ============================================================
async function addConversation(req, id, data) {
    const { type, channel, message, automated } = data;

    const customer = await Customer.findOne({ _id: id, company: req.user.company });
    if (!customer) throw { status: 404, message: 'Customer not found' };

    customer.addConversation({
        type, channel: channel || 'whatsapp', message,
        handledBy: req.user?._id, handledByName: `${req.user?.firstName || 'System'} ${req.user?.lastName || ''}`,
        automated: !!automated
    });

    await customer.save();

    return customer.toPublicJSON('sales');
}

// ============================================================
// List customer orders
// ============================================================
async function listOrders(req) {
    const { status, customerId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company };
    if (status) query.status = status;
    if (customerId) query.customer = customerId;

    if (req.user.role !== 'employer') {
        if (req.user.activeRoles?.includes('manager') || req.user.activeRoles?.includes('sales')) {
            query.branch = req.user.branch;
        } else {
            throw { status: 403, message: 'Not authorized to view orders' };
        }
    } else if (req.branch) {
        query.branch = req.branch;
    }

    const orders = await CustomerOrder.find(query)
        .populate('customer', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await CustomerOrder.countDocuments(query);

    return {
        orders: orders.map(o => o.toPublicJSON()),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

// ============================================================
// Create order (sales/manager)
// ============================================================
async function createOrder(req, data) {
    const { customerId, items, channel, originalMessage, notes } = data;

    if (!customerId) throw { status: 400, message: 'Customer required' };
    if (!items || items.length === 0) throw { status: 400, message: 'At least one item required' };

    const customer = await Customer.findOne({ _id: customerId, company: req.user.company });
    if (!customer) throw { status: 404, message: 'Customer not found' };

    const order = new CustomerOrder({
        company: req.user.company,
        branch: req.user.branch,
        customer: customerId,
        customerName: customer.name,
        customerPhone: customer.phone,
        channel: channel || 'whatsapp',
        originalMessage: originalMessage || '',
        items: items.map(i => ({
            inventoryItem: i.inventoryItem,
            itemCode: i.itemCode || '',
            itemName: i.itemName,
            quantity: parseFloat(i.quantity),
            unit: i.unit || 'pieces',
            unitPrice: parseFloat(i.unitPrice) || 0,
            totalPrice: parseFloat(i.quantity) * parseFloat(i.unitPrice || 0),
            inStock: i.inStock !== false
        })),
        notes: notes || '',
        createdBy: req.user._id
    });

    await order.save();

    await auditHelper.log(req, {
        action: 'CUSTOMER_ORDER_CREATE',
        entityType: 'CustomerOrder',
        entityId: order._id,
        entityName: order.orderId
    });

    return order.toPublicJSON();
}

// ============================================================
// Approve order
// ============================================================
async function approveOrder(req, id) {
    const order = await CustomerOrder.findOne({ _id: id, company: req.user.company });
    if (!order) throw { status: 404, message: 'Order not found' };

    if (req.user.role !== 'employer' && order.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'Not authorized' };
    }

    try {
        order.approve(req.user);
    } catch (err) {
        throw { status: 400, message: err.message };
    }
    await order.save();

    await auditHelper.log(req, {
        action: 'CUSTOMER_ORDER_APPROVE',
        entityType: 'CustomerOrder',
        entityId: order._id,
        entityName: order.orderId
    });

    return order.toPublicJSON();
}

// ============================================================
// Reject order
// ============================================================
async function rejectOrder(req, id, reason) {
    const order = await CustomerOrder.findOne({ _id: id, company: req.user.company });
    if (!order) throw { status: 404, message: 'Order not found' };

    if (req.user.role !== 'employer' && order.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'Not authorized' };
    }

    if (!reason) throw { status: 400, message: 'Rejection reason required' };

    try {
        order.reject(req.user, reason);
    } catch (err) {
        throw { status: 400, message: err.message };
    }
    await order.save();

    await auditHelper.log(req, {
        action: 'CUSTOMER_ORDER_REJECT',
        entityType: 'CustomerOrder',
        entityId: order._id,
        entityName: order.orderId
    });

    return order.toPublicJSON();
}

module.exports = {
    listCustomers, getCustomer, createCustomer, updateCustomer,
    addConversation, listOrders, createOrder, approveOrder, rejectOrder
};