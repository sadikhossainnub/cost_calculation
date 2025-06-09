frappe.ui.form.on('Cost Calculation', {
    validate: function(frm) {
        frm.doc.total_amount = 0;
        $.each(frm.doc.items || [], function(i, d) {
            frm.doc.total_amount += d.qty * d.rate;
        });
        refresh_field("total_amount");
    }
});

frappe.ui.form.on('Cost Calculation Item', {
    rate: function(frm, cdt, cdn) {
        var child = locals[cdt][cdn];
        child.amount = child.qty * child.rate;
        refresh_field("amount", cdt, cdn);
        frm.trigger("validate"); // Trigger the main DocType's validate function
    },
    qty: function(frm, cdt, cdn) {
        var child = locals[cdt][cdn];
        child.amount = child.qty * child.rate;
        refresh_field("amount", cdt, cdn);
        frm.trigger("validate"); // Trigger the main DocType's validate function
    }
});