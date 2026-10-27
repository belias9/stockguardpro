/**
 * Customization Service
 * Employer manages categories, units, fields, currency, template.
 */
const Customization = require('../models/Customization');
const Inventory = require('../models/Inventory');
const auditHelper = require('../utils/auditHelper');

async function getCustomization(req) {
    return Customization.getForCompany(req.user.company);
}

async function addCategory(req, data) {
    const { name } = data;
    if (!name) throw { status: 400, message: 'Name required' };

    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const doc = await Customization.getForCompany(req.user.company);

    if (doc.categories.some(c => c.slug === slug)) {
        throw { status: 400, message: 'Category already exists' };
    }

    doc.categories.push({ name, slug });
    await doc.save();

    await auditHelper.log(req, {
        action: 'SETTINGS_UPDATE',
        entityType: 'Settings',
        entityName: `Category: ${name}`
    });

    return doc;
}

async function removeCategory(req, slug) {
    // Check if any inventory uses it
    const count = await Inventory.countDocuments({
        company: req.user.company,
        category: slug,
        isActive: true
    });
    if (count > 0) {
        throw { status: 400, message: `Cannot remove: ${count} item(s) still use this category` };
    }

    const doc = await Customization.getForCompany(req.user.company);
    doc.categories = doc.categories.filter(c => c.slug !== slug);
    await doc.save();
    return doc;
}

async function addUnit(req, data) {
    const { name, abbreviation } = data;
    if (!name) throw { status: 400, message: 'Name required' };

    const doc = await Customization.getForCompany(req.user.company);
    if (doc.units.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        throw { status: 400, message: 'Unit already exists' };
    }
    doc.units.push({ name, abbreviation: abbreviation || name.toLowerCase() });
    await doc.save();
    return doc;
}

async function removeUnit(req, name) {
    const count = await Inventory.countDocuments({
        company: req.user.company,
        unit: name.toLowerCase(),
        isActive: true
    });
    if (count > 0) {
        throw { status: 400, message: `Cannot remove: ${count} item(s) still use this unit` };
    }

    const doc = await Customization.getForCompany(req.user.company);
    doc.units = doc.units.filter(u => u.name.toLowerCase() !== name.toLowerCase());
    await doc.save();
    return doc;
}

async function addCustomField(req, data) {
    const { key, label, type, options, required } = data;
    if (!key || !label) throw { status: 400, message: 'Key and label required' };

    const doc = await Customization.getForCompany(req.user.company);
    if (doc.customFields.some(f => f.key === key)) {
        throw { status: 400, message: 'Field key already exists' };
    }
    doc.customFields.push({ key, label, type: type || 'text', options: options || [], required: !!required });
    await doc.save();
    return doc;
}

async function removeCustomField(req, key) {
    const doc = await Customization.getForCompany(req.user.company);
    doc.customFields = doc.customFields.filter(f => f.key !== key);
    await doc.save();
    return doc;
}

async function updateCurrency(req, data) {
    const { code, symbol, decimalPlaces } = data;
    const doc = await Customization.getForCompany(req.user.company);
    if (code) doc.currency.code = code.toUpperCase();
    if (symbol) doc.currency.symbol = symbol;
    if (decimalPlaces !== undefined) doc.currency.decimalPlaces = parseInt(decimalPlaces);
    await doc.save();
    return doc;
}

async function updateReceiptTemplate(req, data) {
    const doc = await Customization.getForCompany(req.user.company);
    Object.assign(doc.receiptTemplate, data);
    await doc.save();
    return doc;
}

module.exports = {
    getCustomization,
    addCategory, removeCategory,
    addUnit, removeUnit,
    addCustomField, removeCustomField,
    updateCurrency, updateReceiptTemplate
};