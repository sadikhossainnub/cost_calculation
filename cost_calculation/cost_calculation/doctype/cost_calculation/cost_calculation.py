import frappe
from frappe.model.document import Document

class CostCalculation(Document):
    def validate(self):
        frappe.log_error("Entering validate method", "CostCalculation Debug")
        # Ensure numeric fields are properly cast to float
        self.margin = float(self.margin or 0)
        self.vatait = float(self.vatait or 0)
        self.costing_quantity = float(self.costing_quantity or 0)
        self.calculate_total_amount()
        self.calculate_production_timeline()
        frappe.log_error(f"Exiting validate method. Total amount: {self.total_amount}", "CostCalculation Debug")

    def calculate_production_timeline(self):
        total_seconds = 0
        duration_fields = [
            "polar_cutting_duration",
            "lamination_duration",
            "cup_foaming_duration",
            "printing_duration",
            "cutting_duration",
            "quality_check_duration",
            "drying_duration",
            "pasting_duration",
            "delivery_duration",
        ]
        for field in duration_fields:
            total_seconds += self.get(field) or 0

        self.total_production_timeline = total_seconds / (24 * 60 * 60)


    def calculate_total_amount(self):
        self.total_amount = 0.0

        for item in self.items:
            item.amount = float(item.quantity or 0) * float(item.rate or 0)
            self.total_amount += item.amount

        if self.costing_quantity > 0 and self.total_amount > 0:
            self.total_margin = self.total_amount * (self.margin / 100)
            self.total_vatait = self.total_amount * (self.vatait / 100)
            final_total_amount = self.total_amount + self.total_margin + self.total_vatait
            self.unit_price = final_total_amount / self.costing_quantity
        else:
            self.total_margin = 0.0
            self.total_vatait = 0.0
            self.unit_price = 0.0

    def set_missing_values(self):
        if self.item_code:
            item = frappe.get_doc("Item", self.item_code)
            self.item_name = item.item_name
            self.description = item.description

    def on_change(self):
        frappe.log_error("Entering on_change method", "CostCalculation Debug")
        self.calculate_total_amount()
        frappe.log_error(f"Exiting on_change method. Total amount: {self.total_amount}", "CostCalculation Debug")

    @frappe.whitelist()
    def create_new_version(self):
        new_doc = frappe.copy_doc(self)
        new_doc.naming_series = self.naming_series
        new_doc.save()
        return new_doc.name

    @frappe.whitelist()
    def create_item_price(self):
        if not self.item:
            frappe.throw("Please select an Item to create Item Price.")

        item_price = frappe.new_doc("Item Price")
        item_price.item_code = self.item
        item_price.item_name = self.brand_name # Assuming brand_name can be used as item_name or fetched from Item
        item_price.price_list = frappe.db.get_value("Price List", {"price_list_name": "Standard Selling"}, "name") or frappe.db.get_value("Price List", {"price_list_name": "Standard Buying"}, "name")
        item_price.selling = 1
        item_price.price_list_rate = self.unit_price
        item_price.currency = frappe.db.get_value("Company", frappe.defaults.get_user_default("Company"), "default_currency")

        try:
            item_price.insert()
            frappe.msgprint(f"Item Price {item_price.name} created successfully.")
        except Exception as e:
            frappe.throw(f"Error creating Item Price: {e}")
