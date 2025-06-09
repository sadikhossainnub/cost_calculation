import frappe
from frappe.model.document import Document

class CostCalculation(Document):
    def validate(self):
        self.calculate_total_amount()

    def calculate_total_amount(self):
        self.total_amount = 0
        for item in self.items:
            self.total_amount += item.qty * item.rate

    def on_change(self):
        self.calculate_total_amount()

    @frappe.whitelist()
    def create_new_version(self):
        """Creates a new version of the Cost Calculation document."""

        new_doc = frappe.new_doc(self.doctype)

        # Copy relevant fields
        for field in self.meta.fields:
            if field.fieldname not in ("serial", "total_amount", "name", "items", "owner", "modified_by", "creation", "modified", "idx", "docstatus"): # Exclude name and auto-generated fields
                new_doc.set(field.fieldname, self.get(field.fieldname))

        # Copy child table (items)
        for item in self.items:
            new_item = new_doc.append("items", {})
            for field in item.meta.fields:
                if field.fieldname not in ("name", "owner", "modified_by", "creation", "modified", "idx", "docstatus", "parent", "parentfield", "parenttype"):
                    new_item.set(field.fieldname, item.get(field.fieldname))

        # Generate a new serial
        new_doc.serial = frappe.generate_hash(length=10)  # Or your serial generation logic

        # Clear total_amount
        new_doc.total_amount = 0.0

        new_doc.save()

        return new_doc.name
