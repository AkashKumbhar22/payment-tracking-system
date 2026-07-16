from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from datetime import date
from vendors.models import Vendor
from invoices.models import Invoice, ApprovalStep

User = get_user_model()

class InvoiceSystemTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Test Users
        self.submitter = User.objects.create_user(
            username='test_submitter',
            password='password123',
            role=User.Role.SUBMITTER
        )
        self.approver1 = User.objects.create_user(
            username='test_approver1',
            password='password123',
            role=User.Role.APPROVER
        )
        self.approver2 = User.objects.create_user(
            username='test_approver2',
            password='password123',
            role=User.Role.APPROVER
        )
        self.finance_admin = User.objects.create_user(
            username='test_admin',
            password='password123',
            role=User.Role.FINANCE_ADMIN
        )

        # Create Test Vendor
        self.vendor = Vendor()
        self.vendor.name = "Test Vendor"
        self.vendor.email = "test@vendor.com"
        self.vendor.bank_account_details = "987654321-BANK"
        self.vendor.save()

    def get_jwt_token(self, username, password):
        url = reverse('token_obtain_pair_custom')
        response = self.client.post(url, {'username': username, 'password': password}, format='json')
        return response.data['access']

    def test_role_enforcement_on_invoice_creation(self):
        # 1. Submitter role can create invoice
        token = self.get_jwt_token('test_submitter', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        url = reverse('invoice-list')
        data = {
            'invoice_number': 'INV-TEST-001',
            'vendor_id': str(self.vendor.id),
            'amount': '5000.00',
            'tax_amount': '500.00',
            'due_date': '2026-12-31',
            'assigned_approver_id': self.approver1.id
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Invoice.objects.count(), 1)
        
        # 2. Approver role cannot create invoice
        token = self.get_jwt_token('test_approver1', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_low_value_invoice_workflow(self):
        token = self.get_jwt_token('test_submitter', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        url = reverse('invoice-list')
        data = {
            'invoice_number': 'INV-LOW',
            'vendor_id': str(self.vendor.id),
            'amount': '8000.00',
            'tax_amount': '800.00',
            'due_date': '2026-12-31',
            'assigned_approver_id': self.approver1.id
        }
        
        # Should create a single stage 1 approval step
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        invoice = Invoice.objects.get(invoice_number='INV-LOW')
        
        steps = invoice.approval_steps.all()
        self.assertEqual(steps.count(), 1)
        self.assertEqual(steps[0].approver, self.approver1)
        self.assertEqual(steps[0].stage, 1)
        self.assertEqual(steps[0].status, ApprovalStep.Status.PENDING)

    def test_high_value_invoice_workflow_enforcement(self):
        token = self.get_jwt_token('test_submitter', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        url = reverse('invoice-list')
        data = {
            'invoice_number': 'INV-HIGH',
            'vendor_id': str(self.vendor.id),
            'amount': '12500.00',
            'tax_amount': '1250.00',
            'due_date': '2026-12-31',
            'assigned_approver_id': self.approver1.id
            # Missing secondary_approver_id
        }
        
        # 1. Submission fails because it exceeds $10,000 and has no secondary approver
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('secondary_approver_id', response.data)

        # 2. Submission fails because primary and secondary approvers are identical
        data['secondary_approver_id'] = self.approver1.id
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Submission succeeds with two different approvers
        data['secondary_approver_id'] = self.approver2.id
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        invoice = Invoice.objects.get(invoice_number='INV-HIGH')
        steps = invoice.approval_steps.all().order_by('stage')
        self.assertEqual(steps.count(), 2)
        self.assertEqual(steps[0].approver, self.approver1)
        self.assertEqual(steps[0].stage, 1)
        self.assertEqual(steps[1].approver, self.approver2)
        self.assertEqual(steps[1].stage, 2)

    def test_approval_and_rejection_logic(self):
        # Setup: Submit a high-value invoice requiring approval from both approver1 and approver2
        token = self.get_jwt_token('test_submitter', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        url = reverse('invoice-list')
        data = {
            'invoice_number': 'INV-WORKFLOW',
            'vendor_id': str(self.vendor.id),
            'amount': '15000.00',
            'tax_amount': '1500.00',
            'due_date': '2026-12-31',
            'assigned_approver_id': self.approver1.id,
            'secondary_approver_id': self.approver2.id
        }
        self.client.post(url, data, format='json')
        invoice = Invoice.objects.get(invoice_number='INV-WORKFLOW')
        
        # 1. Approver 2 attempts to approve, but fails permissions/step order if not their turn (wait, our logic allows any assigned step to be approved, but checks if all steps are done)
        # Let's verify Approver 1 approves their step
        token1 = self.get_jwt_token('test_approver1', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token1}')
        approve_url = reverse('invoice-approve', args=[invoice.id])
        
        response = self.client.post(approve_url, {'comments': 'Stage 1 looks correct.'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Refresh state
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, Invoice.Status.PENDING_APPROVAL)  # Invoice still pending as Stage 2 is outstanding

        # 2. Approver 2 approves their step
        token2 = self.get_jwt_token('test_approver2', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token2}')
        approve_url_2 = reverse('invoice-approve', args=[invoice.id])
        response = self.client.post(approve_url_2, {'comments': 'Stage 2 approved.'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Refresh state: Both approved -> Invoice status must change to APPROVED
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, Invoice.Status.APPROVED)

    def test_rejection_logic(self):
        # Setup: Submit invoice
        token = self.get_jwt_token('test_submitter', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        url = reverse('invoice-list')
        data = {
            'invoice_number': 'INV-REJECT-TEST',
            'vendor_id': str(self.vendor.id),
            'amount': '500.00',
            'tax_amount': '50.00',
            'due_date': '2026-12-31',
            'assigned_approver_id': self.approver1.id
        }
        self.client.post(url, data, format='json')
        invoice = Invoice.objects.get(invoice_number='INV-REJECT-TEST')

        # Approver 1 rejects the invoice
        token1 = self.get_jwt_token('test_approver1', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token1}')
        reject_url = reverse('invoice-reject', args=[invoice.id])
        response = self.client.post(reject_url, {'comments': 'Pricing is too high.'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, Invoice.Status.REJECTED)

    def test_payment_logic_role_restriction(self):
        # Setup: Approved invoice
        invoice = Invoice.objects.create(
            invoice_number="INV-PAY-TEST",
            vendor=self.vendor,
            amount=Decimal("2000.00"),
            due_date=date(2026, 12, 31),
            status=Invoice.Status.APPROVED,
            submitted_by=self.submitter
        )

        pay_url = reverse('invoice-pay', args=[invoice.id])

        # 1. Non-admin (Submitter) tries to pay -> Forbidden
        token_sub = self.get_jwt_token('test_submitter', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_sub}')
        response = self.client.post(pay_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Finance Admin tries to pay -> Success
        token_admin = self.get_jwt_token('test_admin', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_admin}')
        response = self.client.post(pay_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        invoice.refresh_from_db()
        self.assertEqual(invoice.status, Invoice.Status.PAID)
