import frappe
from frappe.model.document import Document

class CostCalculation(Document):
    def validate(self):
        self.calculate_total_amount()

    def calculate_total_amount(self):
        self.total_amount = 0
        for item in self.items:
            item.amount = item.quantity * item.rate
            self.total_amount += item.amount

        if self.costing_quantity and self.total_amount:
            base_unit_price = self.total_amount / self.costing_quantity
            self.unit_price = base_unit_price + (self.margin / 100) + (self.vatait / 100)
        else:
            self.unit_price = 0.0

    def on_change(self):
        self.calculate_total_amount()

    @frappe.whitelist()
    def create_new_version(self):
        new_doc = frappe.copy_doc(self)
        new_doc.naming_series = self.naming_series
        new_doc.save()
        return new_doc.name
