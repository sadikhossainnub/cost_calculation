function calculate_totals(frm) {
    var total_amount = 0;
    if (frm.doc.items) {
        frm.doc.items.forEach(function(item) {
            total_amount += item.amount;
        });
    }
    frm.set_value('total_amount', total_amount);

    if (frm.doc.costing_quantity > 0 && frm.doc.total_amount > 0) {
        var total_margin_amount = frm.doc.total_amount * (frm.doc.margin / 100);
        var total_vatait_amount = frm.doc.total_amount * (frm.doc.vatait / 100);
        var final_total_amount = frm.doc.total_amount + total_margin_amount + total_vatait_amount;
        frm.set_value('total_margin', total_margin_amount);
        frm.set_value('total_vatait', total_vatait_amount);
        frm.set_value('unit_price', final_total_amount / frm.doc.costing_quantity);
    } else {
        frm.set_value('total_margin', 0);
        frm.set_value('total_vatait', 0);
        frm.set_value('unit_price', 0);
    }
}

frappe.ui.form.on('Cost Calculation', {
    refresh: function(frm) {
        calculate_totals(frm);
        frm.add_custom_button(__('Create Item Price'), function() {
            frm.call('create_item_price');
        });
    },
    costing_quantity: function(frm) {
        calculate_totals(frm);
    },
    margin: function(frm) {
        calculate_totals(frm);
    },
    vatait: function(frm) {
        calculate_totals(frm);
    }
});

frappe.ui.form.on('Cost Calculation Item', {
    item_code: function(frm, cdt, cdn) {
        var item = locals[cdt][cdn];
        if (item.item_code) {
            frappe.db.get_value('Item', item.item_code, 'item_name', function(r) {
                frappe.model.set_value(cdt, cdn, 'item_name', r.item_name);
            });
        }
    },
    quantity: function(frm, cdt, cdn) {
        var item = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, 'amount', item.quantity * item.rate);
        calculate_totals(frm);
    },
    rate: function(frm, cdt, cdn) {
        var item = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, 'amount', item.quantity * item.rate);
        calculate_totals(frm);
    },
    items_remove: function(frm) {
        calculate_totals(frm);
    }
});
