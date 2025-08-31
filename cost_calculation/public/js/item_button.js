frappe.ui.form.on('Item', {
    refresh: function(frm) {
        frm.add_custom_button(__('Cost Calculation'), function() {
            frappe.model.open_mapped_doc({
                method: "cost_calculation.cost_calculation.doctype.item_api.make_cost_calculation",
                frm: frm
            })
        });
    }
});