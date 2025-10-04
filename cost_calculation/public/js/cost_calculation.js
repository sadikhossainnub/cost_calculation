// Auto-fetch item details when item is selected
frappe.ui.form.on('Cost Calculation Item', {
    item_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.item_code) {
            frappe.call({
                method: 'cost_calculation.cost_calculation.api.get_item_details',
                args: { item_code: row.item_code },
                callback: function(r) {
                    if (r.message) {
                        frappe.model.set_value(cdt, cdn, 'item_name', r.message.item_name);
                        frappe.model.set_value(cdt, cdn, 'description', r.message.description);
                        if (!row.rate && r.message.suggested_rate) {
                            frappe.model.set_value(cdt, cdn, 'rate', r.message.suggested_rate);
                        }
                    }
                }
            });
        }
    }
});

// Auto-calculate production timeline based on quantity
function auto_calculate_production_timeline(frm, process_field, quantity_suffix) {
    let quantity = frm.doc[`costing_quantity_${quantity_suffix}`] || 0;
    if (quantity > 0) {
        let process_type = process_field.replace(quantity_suffix, '').replace('_duration', '');
        
        frappe.call({
            method: 'cost_calculation.cost_calculation.api.auto_calculate_timeline',
            args: {
                quantity: quantity,
                process_type: process_type
            },
            callback: function(r) {
                if (r.message) {
                    frm.set_value(process_field, r.message);
                }
            }
        });
    }
}

// Add custom buttons for enhanced functionality
frappe.ui.form.on('Cost Calculation', {
    refresh: function(frm) {
        // Add duplicate button
        frm.add_custom_button(__('Duplicate'), function() {
            frappe.call({
                method: 'cost_calculation.cost_calculation.api.duplicate_cost_calculation',
                args: { source_name: frm.doc.name },
                callback: function(r) {
                    if (r.message) {
                        frappe.set_route('Form', 'Cost Calculation', r.message);
                    }
                }
            });
        });

        // Add export button
        frm.add_custom_button(__('Export Data'), function() {
            frappe.call({
                method: 'cost_calculation.cost_calculation.api.export_cost_calculation',
                args: { name: frm.doc.name },
                callback: function(r) {
                    if (r.message) {
                        frappe.tools.downloadify(r.message, null, frm.doc.name + '_cost_data');
                    }
                }
            });
        });

        // Add cost summary button
        frm.add_custom_button(__('Cost Summary'), function() {
            frm.call('get_cost_summary').then(r => {
                if (r.message) {
                    let summary = r.message;
                    let html = '<table class="table table-bordered"><tr><th>Quantity</th><th>Unit Price</th><th>Total</th><th>Margin</th></tr>';
                    
                    ['quantity_01', 'quantity_02', 'quantity_03'].forEach(key => {
                        let data = summary[key];
                        html += `<tr><td>${data.quantity}</td><td>${format_currency(data.unit_price)}</td><td>${format_currency(data.total)}</td><td>${format_currency(data.margin)}</td></tr>`;
                    });
                    
                    html += '</table>';
                    
                    frappe.msgprint({
                        title: __('Cost Summary'),
                        message: html,
                        wide: true
                    });
                }
            });
        });
    }
});

// Auto-calculate wastage percentage
frappe.ui.form.on('Wastage', {
    amount: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.amount) {
            // Get total cost from parent form
            let total_cost = frm.doc.total_amount01 || 0;
            if (total_cost > 0) {
                frappe.call({
                    method: 'cost_calculation.cost_calculation.api.calculate_wastage_percentage',
                    args: {
                        total_cost: total_cost,
                        wastage_amount: row.amount
                    },
                    callback: function(r) {
                        if (r.message) {
                            frappe.model.set_value(cdt, cdn, 'percentage', r.message);
                        }
                    }
                });
            }
        }
    }
});