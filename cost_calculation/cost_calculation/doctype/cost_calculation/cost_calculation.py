import frappe
from frappe.model.document import Document

class CostCalculation(Document):
    def validate(self):
        # Ensure numeric fields are properly cast to float
        self.margin = float(self.margin or 0)
        self.vatait = float(self.vatait or 0)
        self.costing_quantity = float(self.costing_quantity or 0)
        self.calculate_total_amount()

    def calculate_total_amount(self):
        self.total_amount = 0.0

        for item in self.items:
            item.amount = float(item.quantity or 0) * float(item.rate or 0)
            self.total_amount += item.amount

        if self.costing_quantity > 0 and self.total_amount > 0:
            base_unit_price = self.total_amount + ((self.margin / 100) + (self.vatait / 100))
            self.unit_price = base_unit_price / self.costing_quantity
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
