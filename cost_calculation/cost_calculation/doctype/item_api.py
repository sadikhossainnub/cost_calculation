import frappe
from frappe.model.mapper import get_mapped_doc

@frappe.whitelist()
def make_cost_calculation(source_name, target_doc=None):
    def set_missing_values(source, target):
        target.run_method("set_missing_values")

    doc = get_mapped_doc(
        "Item",
        source_name,
        {
            "Item": {
                "doctype": "Cost Calculation",
                "field_map": {
                    "name": "item_code",
                    "item_description": "description"
                }
            }
        },
        target_doc,
        set_missing_values,
    )

    return doc