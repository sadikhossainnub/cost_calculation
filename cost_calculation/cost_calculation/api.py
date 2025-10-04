import frappe
from frappe import _

@frappe.whitelist()
def get_item_details(item_code):
    """Get item details for cost calculation"""
    if not item_code:
        return {}
    
    item = frappe.get_doc("Item", item_code)
    
    # Get latest purchase rate
    latest_purchase_rate = frappe.db.get_value(
        "Purchase Invoice Item",
        {"item_code": item_code},
        "rate",
        order_by="creation desc"
    ) or 0
    
    # Get standard rate from Item Price
    standard_rate = frappe.db.get_value(
        "Item Price",
        {"item_code": item_code, "price_list": "Standard Buying"},
        "price_list_rate"
    ) or 0
    
    return {
        "item_name": item.item_name,
        "description": item.description,
        "uom": item.stock_uom,
        "latest_purchase_rate": latest_purchase_rate,
        "standard_rate": standard_rate,
        "suggested_rate": latest_purchase_rate or standard_rate
    }

@frappe.whitelist()
def calculate_wastage_percentage(total_cost, wastage_amount):
    """Calculate wastage percentage"""
    if not total_cost or total_cost == 0:
        return 0
    return (float(wastage_amount) / float(total_cost)) * 100

@frappe.whitelist()
def get_production_capacity():
    """Get production capacity data for timeline calculation"""
    # This can be extended to fetch from a Production Capacity doctype
    return {
        "polar_cutting_per_hour": 1000,
        "printing_per_hour": 500,
        "lamination_per_hour": 800,
        "cutting_per_hour": 1200,
        "pasting_per_hour": 600,
        "cup_foaming_per_hour": 400,
        "quality_check_per_hour": 2000
    }

@frappe.whitelist()
def auto_calculate_timeline(quantity, process_type):
    """Auto calculate timeline based on quantity and process type"""
    capacity = get_production_capacity()
    
    if process_type in capacity:
        per_hour_capacity = capacity[process_type]
        hours_needed = float(quantity) / per_hour_capacity
        return hours_needed * 3600  # Convert to seconds
    
    return 0

@frappe.whitelist()
def duplicate_cost_calculation(source_name):
    """Create a duplicate of cost calculation"""
    source_doc = frappe.get_doc("Cost Calculation", source_name)
    
    # Create new document
    new_doc = frappe.copy_doc(source_doc)
    new_doc.naming_series = source_doc.naming_series
    new_doc.transaction_date = frappe.utils.today()
    
    # Clear calculated fields
    for suffix in ['01', '02', '03']:
        new_doc.set(f'total_amount{suffix}', 0)
        new_doc.set(f'unit_price_{suffix}', 0)
        new_doc.set(f'grand_total_{suffix}', 0)
        new_doc.set(f'total_margin{suffix}', 0)
    
    new_doc.insert()
    return new_doc.name

@frappe.whitelist()
def export_cost_calculation(name):
    """Export cost calculation data"""
    doc = frappe.get_doc("Cost Calculation", name)
    
    export_data = {
        "basic_info": {
            "name": doc.name,
            "customer": doc.customer_name,
            "item": doc.item,
            "date": doc.transaction_date
        },
        "quantities": [],
        "raw_materials": [],
        "packaging": [],
        "services": [],
        "chaat_details": [],
        "wastage": []
    }
    
    # Add quantity data
    for suffix in ['01', '02', '03']:
        export_data["quantities"].append({
            "quantity": doc.get(f'costing_quantity_{suffix}'),
            "unit_price": doc.get(f'unit_price_{suffix}'),
            "total": doc.get(f'grand_total_{suffix}'),
            "margin": doc.get(f'margin{suffix}')
        })
    
    # Add item details
    for item in doc.items_copy_copy_copy or []:
        export_data["raw_materials"].append({
            "item": item.item_code,
            "quantity": item.quantity,
            "rate": item.rate,
            "amount": item.amount
        })
    
    return export_data

@frappe.whitelist()
def calculate_delivery_charge(delivery_zone, distance_km, quantity, rate_per_km=15):
    """Calculate delivery charge based on zone, distance and quantity"""
    
    zone_rates = {
        "Dhaka City": 50,
        "Dhaka Metro": 100,
        "Chittagong": 200,
        "Sylhet": 300,
        "Rajshahi": 250,
        "Khulna": 280,
        "Barisal": 320,
        "Rangpur": 350,
        "Mymensingh": 200,
        "Other": 400
    }
    
    base_rate = zone_rates.get(delivery_zone, 400)
    distance_charge = float(distance_km or 0) * float(rate_per_km or 15)
    quantity_multiplier = 1 + (float(quantity or 0) / 10000)
    
    total_charge = (base_rate + distance_charge) * quantity_multiplier
    
    return total_charge

@frappe.whitelist()
def get_zone_distance(customer_location):
    """Get delivery zone and estimated distance based on customer location"""
    location_mapping = {
        "dhaka": {"zone": "Dhaka City", "distance": 10},
        "chittagong": {"zone": "Chittagong", "distance": 244},
        "sylhet": {"zone": "Sylhet", "distance": 303},
        "rajshahi": {"zone": "Rajshahi", "distance": 256},
        "khulna": {"zone": "Khulna", "distance": 334},
        "barisal": {"zone": "Barisal", "distance": 373},
        "rangpur": {"zone": "Rangpur", "distance": 304},
        "mymensingh": {"zone": "Mymensingh", "distance": 120}
    }
    
    if not customer_location:
        return {"zone": "Other", "distance": 50}
    
    location_lower = customer_location.lower()
    for key, value in location_mapping.items():
        if key in location_lower:
            return value
    
    return {"zone": "Other", "distance": 50}