import frappe
from frappe.model.document import Document

class CostCalculation(Document):
    def validate(self):
        self.auto_set_delivery_details()
        self.calculate_child_table_amounts()
        self.calculate_delivery_charges()
        self.calculate_all_quantities()
        self.calculate_production_timelines()

    def calculate_child_table_amounts(self):
        """Calculate amounts for all child table items"""
        for table_field in ['items', 'items_copy', 'items_copy_copy', 'items_copy_copy_copy']:
            for item in self.get(table_field) or []:
                item.amount = float(item.quantity or 0) * float(item.rate or 0)
        
        # Calculate chaat details amounts
        for item in self.chaat_details or []:
            item.amount = float(item.quantity or 0) * float(item.rate or 0)

    def calculate_all_quantities(self):
        """Calculate totals for all three quantity scenarios"""
        for suffix in ['01', '02', '03']:
            self.calculate_totals_for_quantity(suffix)

    def calculate_totals_for_quantity(self, suffix):
        """Calculate totals for a specific quantity scenario"""
        # Calculate component totals
        raw_material_total = sum(item.amount or 0 for item in self.items_copy_copy_copy or [])
        packaging_total = sum(item.amount or 0 for item in self.items_copy or [])
        service_total = sum(item.amount or 0 for item in self.items or [])
        chaat_total = sum(item.amount or 0 for item in self.chaat_details or [])
        wastage_total = sum(item.amount or 0 for item in self.wastage_details_copy or [])
        delivery_total = sum(item.amount or 0 for item in self.items_copy_copy or [])

        # Set component totals
        self.set(f'total_raw_material_cost_{suffix}', raw_material_total)
        self.set(f'total_packaging_cost_{suffix}', packaging_total)
        self.set(f'total_service_cost_{suffix}', service_total)
        self.set(f'chaat_total_sale_amount_{suffix}', chaat_total)
        self.set(f'wastage_amount_in_taka_{suffix}', wastage_total)

        # Calculate total amount
        total_amount = raw_material_total + packaging_total + service_total - chaat_total + wastage_total + delivery_total
        
        # Get margin and quantity
        margin_field = f'margin{suffix}'
        quantity_field = f'costing_quantity_{suffix}'
        margin = float(self.get(margin_field) or 0)
        quantity = float(self.get(quantity_field) or 1)
        
        # Calculate margin and VAT
        margin_amount = total_amount * (margin / 100)
        vat_amount = total_amount * (float(self.vatait or 0) / 100)
        
        # Calculate final amounts
        final_total = total_amount + margin_amount + vat_amount
        unit_price = final_total / quantity if quantity > 0 else 0
        
        # Set calculated values
        self.set(f'total_amount{suffix}', total_amount)
        self.set(f'total_margin{suffix}', margin_amount)
        self.set(f'total_vatait_{suffix}', vat_amount)
        self.set(f'unit_price_{suffix}', unit_price)
        self.set(f'grand_total_{suffix}', final_total)

    def calculate_production_timelines(self):
        """Calculate production timelines for all quantity scenarios"""
        for suffix in ['01', '02', '03']:
            total_seconds = 0
            duration_fields = [
                f'polar_cutting_duration{suffix}',
                f'printing_duration{suffix}',
                f'drying_duration{suffix}',
                f'lamination_duration{suffix}',
                f'cutting_duration{suffix}',
                f'pasting_duration{suffix}',
                f'cup_foaming_duration{suffix}',
                f'quality_check_duration{suffix}',
                f'delivery_duration{suffix}'
            ]
            
            for field in duration_fields:
                total_seconds += self.get(field) or 0
            
            total_days = total_seconds / (24 * 60 * 60)
            self.set(f'total_production_timeline{suffix}', total_days)

    @frappe.whitelist()
    def create_item_price(self):
        """Create Item Price from the cost calculation"""
        if not self.item:
            frappe.throw("Please select an Item to create Item Price.")

        # Check if Item Price already exists
        existing_price = frappe.db.exists("Item Price", {
            "item_code": self.item,
            "price_list": "Standard Selling"
        })
        
        if existing_price:
            frappe.throw(f"Item Price already exists for {self.item}")

        item_price = frappe.new_doc("Item Price")
        item_price.item_code = self.item
        item_price.price_list = "Standard Selling"
        item_price.price_list_rate = self.unit_price_01 or 0
        item_price.currency = frappe.defaults.get_global_default("currency") or "BDT"
        item_price.insert()
        
        frappe.msgprint(f"Item Price {item_price.name} created successfully with rate {item_price.price_list_rate}")
        return item_price.name

    def auto_set_delivery_details(self):
        """Auto set delivery zone and distance based on customer location"""
        if self.customer_delivery_location and not self.delivery_zone:
            from cost_calculation.cost_calculation.api import get_zone_distance
            zone_data = get_zone_distance(self.customer_delivery_location)
            self.delivery_zone = zone_data.get("zone")
            self.distance_km = zone_data.get("distance")

    def calculate_delivery_charges(self):
        """Auto calculate delivery charges if enabled"""
        if not self.auto_calculate_delivery or not self.delivery_zone:
            return
        
        from cost_calculation.cost_calculation.api import calculate_delivery_charge
        
        for suffix in ['01', '02', '03']:
            quantity = self.get(f'costing_quantity_{suffix}') or 0
            if quantity > 0:
                delivery_charge = calculate_delivery_charge(
                    self.delivery_zone,
                    self.distance_km,
                    quantity,
                    self.delivery_rate_per_km
                )
                
                # Add or update delivery charge in items_copy_copy table
                self.add_delivery_item(delivery_charge, suffix)

    @frappe.whitelist()
    def get_cost_summary(self):
        """Get cost summary for all quantities"""
        return {
            "quantity_01": {
                "quantity": self.costing_quantity_01,
                "unit_price": self.unit_price_01,
                "total": self.grand_total_01,
                "margin": self.total_margin01
            },
            "quantity_02": {
                "quantity": self.costing_quantity_02,
                "unit_price": self.unit_price_02,
                "total": self.grand_total_02,
                "margin": self.total_margin02
            },
            "quantity_03": {
                "quantity": self.costing_quantity_03,
                "unit_price": self.unit_price_03,
                "total": self.grand_total_03,
                "margin": self.total_margin03
            }
        }

    def add_delivery_item(self, delivery_charge, suffix):
        """Add delivery charge item to delivery items table"""
        delivery_item_name = f"Delivery Charge - Quantity {suffix}"
        
        # Check if delivery item already exists
        existing_item = None
        for item in self.items_copy_copy or []:
            if item.item_name == delivery_item_name:
                existing_item = item
                break
        
        if existing_item:
            existing_item.rate = delivery_charge
            existing_item.quantity = 1
            existing_item.amount = delivery_charge
        else:
            # Add new delivery item
            delivery_item = self.append('items_copy_copy', {})
            delivery_item.item_name = delivery_item_name
            delivery_item.description = f"Auto-calculated delivery charge for {self.delivery_zone}"
            delivery_item.quantity = 1
            delivery_item.rate = delivery_charge
            delivery_item.amount = delivery_charge