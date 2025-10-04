function calculate_totals_for_quantity(frm, qty_suffix) {
    let raw_material_total = 0;
    let packaging_total = 0;
    let service_total = 0;
    let chaat_total = 0;
    let wastage_total = 0;
    let delivery_total = 0;

    // Calculate raw material costs
    if (frm.doc.items_copy_copy_copy) {
        frm.doc.items_copy_copy_copy.forEach(item => {
            raw_material_total += item.amount || 0;
        });
    }

    // Calculate packaging costs
    if (frm.doc.items_copy) {
        frm.doc.items_copy.forEach(item => {
            packaging_total += item.amount || 0;
        });
    }

    // Calculate service costs
    if (frm.doc.items) {
        frm.doc.items.forEach(item => {
            service_total += item.amount || 0;
        });
    }

    // Calculate chaat costs
    if (frm.doc.chaat_details) {
        frm.doc.chaat_details.forEach(item => {
            chaat_total += item.amount || 0;
        });
    }

    // Calculate wastage costs
    if (frm.doc.wastage_details_copy) {
        frm.doc.wastage_details_copy.forEach(item => {
            wastage_total += (item.amount || 0);
        });
    }

    // Calculate delivery costs
    if (frm.doc.items_copy_copy) {
        frm.doc.items_copy_copy.forEach(item => {
            delivery_total += item.amount || 0;
        });
    }

    // Set totals
    frm.set_value(`total_raw_material_cost_${qty_suffix}`, raw_material_total);
    frm.set_value(`total_packaging_cost_${qty_suffix}`, packaging_total);
    frm.set_value(`total_service_cost_${qty_suffix}`, service_total);
    frm.set_value(`chaat_total_sale_amount_${qty_suffix}`, chaat_total);
    frm.set_value(`wastage_amount_in_taka_${qty_suffix}`, wastage_total);

    // Calculate total amount
    let total_amount = raw_material_total + packaging_total + service_total - chaat_total + wastage_total + delivery_total;
    
    // Add margin
    let margin_field = qty_suffix === '01' ? 'margin01' : qty_suffix === '02' ? 'margin02' : 'margin03';
    let margin = frm.doc[margin_field] || 0;
    let margin_amount = total_amount * (margin / 100);
    
    // Add VAT/AIT
    let vat_amount = total_amount * (frm.doc.vatait || 0) / 100;
    
    // Calculate final amounts
    let final_total = total_amount + margin_amount + vat_amount;
    let quantity_field = qty_suffix === '01' ? 'costing_quantity_01' : qty_suffix === '02' ? 'costing_quantity_02' : 'costing_quantity_03';
    let quantity = frm.doc[quantity_field] || 1;
    
    frm.set_value(`total_amount${qty_suffix}`, total_amount);
    frm.set_value(`total_margin${qty_suffix}`, margin_amount);
    frm.set_value(`total_vatait_${qty_suffix}`, vat_amount);
    frm.set_value(`unit_price_${qty_suffix}`, final_total / quantity);
    frm.set_value(`grand_total_${qty_suffix}`, final_total);
}

function calculate_production_timeline_for_quantity(frm, qty_suffix) {
    let total_seconds = 0;
    const duration_fields = [
        `polar_cutting_duration${qty_suffix}`,
        `printing_duration${qty_suffix}`,
        `drying_duration${qty_suffix}`,
        `lamination_duration${qty_suffix}`,
        `cutting_duration${qty_suffix}`,
        `pasting_duration${qty_suffix}`,
        `cup_foaming_duration${qty_suffix}`,
        `quality_check_duration${qty_suffix}`,
        `delivery_duration${qty_suffix}`
    ];

    duration_fields.forEach(field => {
        if (frm.doc[field]) {
            total_seconds += frm.doc[field];
        }
    });

    let total_days = total_seconds / (24 * 60 * 60);
    frm.set_value(`total_production_timeline${qty_suffix}`, total_days.toFixed(2));
}

function calculate_all_quantities(frm) {
    ['01', '02', '03'].forEach(suffix => {
        calculate_totals_for_quantity(frm, suffix);
        calculate_production_timeline_for_quantity(frm, suffix);
    });
}

function calculate_delivery_charges(frm) {
    if (!frm.doc.auto_calculate_delivery || !frm.doc.delivery_zone) {
        return;
    }
    
    ['01', '02', '03'].forEach(suffix => {
        let quantity = frm.doc[`costing_quantity_${suffix}`] || 0;
        if (quantity > 0) {
            frappe.call({
                method: 'cost_calculation.cost_calculation.api.calculate_delivery_charge',
                args: {
                    delivery_zone: frm.doc.delivery_zone,
                    distance_km: frm.doc.distance_km,
                    quantity: quantity,
                    rate_per_km: frm.doc.delivery_rate_per_km
                },
                callback: function(r) {
                    if (r.message) {
                        add_delivery_item_to_table(frm, r.message, suffix);
                        calculate_all_quantities(frm);
                    }
                }
            });
        }
    });
}

function add_delivery_item_to_table(frm, delivery_charge, suffix) {
    let delivery_item_name = `Delivery Charge - Quantity ${suffix}`;
    let existing_item = null;
    
    // Check if delivery item already exists
    if (frm.doc.items_copy_copy) {
        frm.doc.items_copy_copy.forEach(item => {
            if (item.item_name === delivery_item_name) {
                existing_item = item;
            }
        });
    }
    
    if (existing_item) {
        frappe.model.set_value(existing_item.doctype, existing_item.name, 'rate', delivery_charge);
        frappe.model.set_value(existing_item.doctype, existing_item.name, 'quantity', 1);
        frappe.model.set_value(existing_item.doctype, existing_item.name, 'amount', delivery_charge);
    } else {
        let new_item = frm.add_child('items_copy_copy');
        new_item.item_name = delivery_item_name;
        new_item.description = `Auto-calculated delivery charge for ${frm.doc.delivery_zone}`;
        new_item.quantity = 1;
        new_item.rate = delivery_charge;
        new_item.amount = delivery_charge;
    }
    
    frm.refresh_field('items_copy_copy');
}

frappe.ui.form.on('Cost Calculation', {
    refresh: function(frm) {
        calculate_all_quantities(frm);
        frm.add_custom_button(__('Create Item Price'), function() {
            frm.call('create_item_price');
        });
    },
    
    // Quantity and margin changes
    costing_quantity_01: function(frm) { calculate_totals_for_quantity(frm, '01'); },
    costing_quantity_02: function(frm) { calculate_totals_for_quantity(frm, '02'); },
    costing_quantity_03: function(frm) { calculate_totals_for_quantity(frm, '03'); },
    margin01: function(frm) { calculate_totals_for_quantity(frm, '01'); },
    margin02: function(frm) { calculate_totals_for_quantity(frm, '02'); },
    margin03: function(frm) { calculate_totals_for_quantity(frm, '03'); },
    vatait: function(frm) { calculate_all_quantities(frm); },
    
    // Delivery automation
    customer_delivery_location: function(frm) {
        if (frm.doc.customer_delivery_location) {
            frappe.call({
                method: 'cost_calculation.cost_calculation.api.get_zone_distance',
                args: { customer_location: frm.doc.customer_delivery_location },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value('delivery_zone', r.message.zone);
                        frm.set_value('distance_km', r.message.distance);
                    }
                }
            });
        }
    },
    
    delivery_zone: function(frm) { calculate_delivery_charges(frm); },
    distance_km: function(frm) { calculate_delivery_charges(frm); },
    delivery_rate_per_km: function(frm) { calculate_delivery_charges(frm); },
    auto_calculate_delivery: function(frm) { calculate_delivery_charges(frm); },

    // Production timeline fields
    polar_cutting_duration01: function(frm) { calculate_production_timeline_for_quantity(frm, '01'); },
    polar_cutting_duration02: function(frm) { calculate_production_timeline_for_quantity(frm, '02'); },
    polar_cutting_duration03: function(frm) { calculate_production_timeline_for_quantity(frm, '03'); },
    printing_duration01: function(frm) { calculate_production_timeline_for_quantity(frm, '01'); },
    printing_duration02: function(frm) { calculate_production_timeline_for_quantity(frm, '02'); },
    printing_duration03: function(frm) { calculate_production_timeline_for_quantity(frm, '03'); },
    drying_duration01: function(frm) { calculate_production_timeline_for_quantity(frm, '01'); },
    drying_duration02: function(frm) { calculate_production_timeline_for_quantity(frm, '02'); },
    drying_duration03: function(frm) { calculate_production_timeline_for_quantity(frm, '03'); },
    lamination_duration01: function(frm) { calculate_production_timeline_for_quantity(frm, '01'); },
    lamination_duration02: function(frm) { calculate_production_timeline_for_quantity(frm, '02'); },
    lamination_duration03: function(frm) { calculate_production_timeline_for_quantity(frm, '03'); },
    cutting_duration01: function(frm) { calculate_production_timeline_for_quantity(frm, '01'); },
    cutting_duration02: function(frm) { calculate_production_timeline_for_quantity(frm, '02'); },
    cutting_duration03: function(frm) { calculate_production_timeline_for_quantity(frm, '03'); },
    pasting_duration01: function(frm) { calculate_production_timeline_for_quantity(frm, '01'); },
    pasting_duration02: function(frm) { calculate_production_timeline_for_quantity(frm, '02'); },
    pasting_duration03: function(frm) { calculate_production_timeline_for_quantity(frm, '03'); },
    cup_foaming_duration01: function(frm) { calculate_production_timeline_for_quantity(frm, '01'); },
    cup_foaming_duration02: function(frm) { calculate_production_timeline_for_quantity(frm, '02'); },
    cup_foaming_duration03: function(frm) { calculate_production_timeline_for_quantity(frm, '03'); },
    quality_check_duration01: function(frm) { calculate_production_timeline_for_quantity(frm, '01'); },
    quality_check_duration02: function(frm) { calculate_production_timeline_for_quantity(frm, '02'); },
    quality_check_duration03: function(frm) { calculate_production_timeline_for_quantity(frm, '03'); },
    delivery_duration01: function(frm) { calculate_production_timeline_for_quantity(frm, '01'); },
    delivery_duration02: function(frm) { calculate_production_timeline_for_quantity(frm, '02'); },
    delivery_duration03: function(frm) { calculate_production_timeline_for_quantity(frm, '03'); }
});

// Child table events
frappe.ui.form.on('Cost Calculation Item', {
    quantity: function(frm, cdt, cdn) {
        let item = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, 'amount', (item.quantity || 0) * (item.rate || 0));
        calculate_all_quantities(frm);
    },
    rate: function(frm, cdt, cdn) {
        let item = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, 'amount', (item.quantity || 0) * (item.rate || 0));
        calculate_all_quantities(frm);
    },
    items_remove: function(frm) { calculate_all_quantities(frm); },
    items_copy_remove: function(frm) { calculate_all_quantities(frm); },
    items_copy_copy_remove: function(frm) { calculate_all_quantities(frm); },
    items_copy_copy_copy_remove: function(frm) { calculate_all_quantities(frm); }
});

frappe.ui.form.on('Chaat Size Rate', {
    rate: function(frm, cdt, cdn) {
        let item = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, 'amount', (item.quantity || 0) * (item.rate || 0));
        calculate_all_quantities(frm);
    },
    quantity: function(frm, cdt, cdn) {
        let item = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, 'amount', (item.quantity || 0) * (item.rate || 0));
        calculate_all_quantities(frm);
    },
    chaat_details_remove: function(frm) { calculate_all_quantities(frm); }
});

frappe.ui.form.on('Wastage', {
    percentage: function(frm, cdt, cdn) {
        calculate_all_quantities(frm);
    },
    amount: function(frm, cdt, cdn) {
        calculate_all_quantities(frm);
    },
    wastage_details_copy_remove: function(frm) { calculate_all_quantities(frm); }
});