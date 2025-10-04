frappe.ui.form.on('Chaat Size Rate', {
	rate: function(frm, cdt, cdn) {
		calculate_amount(frm, cdt, cdn);
	},
	
	quantity: function(frm, cdt, cdn) {
		calculate_amount(frm, cdt, cdn);
	}
});

function calculate_amount(frm, cdt, cdn) {
	let row = locals[cdt][cdn];
	if (row.rate && row.quantity) {
		row.amount = row.rate * row.quantity;
		refresh_field('amount', cdn, 'chaat_details');
	}
}