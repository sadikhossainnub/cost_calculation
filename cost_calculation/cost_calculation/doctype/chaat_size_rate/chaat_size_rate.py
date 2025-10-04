import frappe
from frappe.model.document import Document


class ChaatSizeRate(Document):
	def validate(self):
		self.calculate_amount()

	def calculate_amount(self):
		if self.rate and self.quantity:
			self.amount = self.rate * self.quantity