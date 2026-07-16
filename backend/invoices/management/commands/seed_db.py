from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal
from datetime import date
from vendors.models import Vendor
from invoices.models import Invoice, ApprovalStep

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds the database with test users, vendors, and invoices.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Clearing existing data..."))
        ApprovalStep.objects.all().delete()
        Invoice.objects.all().delete()
        Vendor.objects.all().delete()
        User.objects.all().delete()

        self.stdout.write(self.style.SUCCESS("Creating users..."))
        
        # Submitter
        submitter = User.objects.create_user(
            username='submitter_user',
            email='submitter@example.com',
            password='password123',
            role=User.Role.SUBMITTER,
            first_name='Steve',
            last_name='Submitter'
        )
        
        # Approver 1
        approver1 = User.objects.create_user(
            username='approver_1',
            email='approver1@example.com',
            password='password123',
            role=User.Role.APPROVER,
            first_name='Alice',
            last_name='Approver'
        )

        # Approver 2
        approver2 = User.objects.create_user(
            username='approver_2',
            email='approver2@example.com',
            password='password123',
            role=User.Role.APPROVER,
            first_name='Bob',
            last_name='Approver'
        )

        # Finance Admin
        finance_admin = User.objects.create_user(
            username='finance_admin',
            email='finance@example.com',
            password='password123',
            role=User.Role.FINANCE_ADMIN,
            first_name='Fay',
            last_name='Finance'
        )

        self.stdout.write(self.style.SUCCESS("Creating vendors..."))
        acme = Vendor()
        acme.name = "Acme Corporation"
        acme.email = "billing@acme.com"
        acme.bank_account_details = "US-ACME-987654321"
        acme.save()

        globex = Vendor()
        globex.name = "Globex Corporation"
        globex.email = "finance@globex.com"
        globex.bank_account_details = "US-GLOBEX-123456789"
        globex.save()

        initech = Vendor()
        initech.name = "Initech Corporation"
        initech.email = "ap@initech.com"
        initech.bank_account_details = "US-INITECH-112233445"
        initech.save()

        self.stdout.write(self.style.SUCCESS("Creating invoices and approval steps..."))

        # Invoice 1: Standard value (<10,000), Pending Approval
        inv1 = Invoice.objects.create(
            invoice_number="INV-2026-001",
            vendor=acme,
            amount=Decimal("1200.00"),
            tax_amount=Decimal("120.00"),
            due_date=date(2026, 8, 15),
            status=Invoice.Status.PENDING_APPROVAL,
            submitted_by=submitter,
            file_url="https://example.com/invoices/inv-2026-001.pdf"
        )
        ApprovalStep.objects.create(
            invoice=inv1,
            approver=approver1,
            stage=1,
            status=ApprovalStep.Status.PENDING
        )

        # Invoice 2: High value (>10,000), Pending Two-stage Approval
        inv2 = Invoice.objects.create(
            invoice_number="INV-2026-002",
            vendor=globex,
            amount=Decimal("15500.00"),
            tax_amount=Decimal("1550.00"),
            due_date=date(2026, 9, 1),
            status=Invoice.Status.PENDING_APPROVAL,
            submitted_by=submitter,
            file_url="https://example.com/invoices/inv-2026-002.pdf"
        )
        ApprovalStep.objects.create(
            invoice=inv2,
            approver=approver1,
            stage=1,
            status=ApprovalStep.Status.PENDING
        )
        ApprovalStep.objects.create(
            invoice=inv2,
            approver=approver2,
            stage=2,
            status=ApprovalStep.Status.PENDING
        )

        # Invoice 3: Standard value, Approved, Waiting for payment
        inv3 = Invoice.objects.create(
            invoice_number="INV-2026-003",
            vendor=initech,
            amount=Decimal("8500.00"),
            tax_amount=Decimal("850.00"),
            due_date=date(2026, 8, 20),
            status=Invoice.Status.APPROVED,
            submitted_by=submitter,
            file_url="https://example.com/invoices/inv-2026-003.pdf"
        )
        ApprovalStep.objects.create(
            invoice=inv3,
            approver=approver1,
            stage=1,
            status=ApprovalStep.Status.APPROVED,
            comments="Verified deliverables and approved pricing."
        )

        # Invoice 4: Standard value, Paid
        inv4 = Invoice.objects.create(
            invoice_number="INV-2026-004",
            vendor=acme,
            amount=Decimal("450.00"),
            tax_amount=Decimal("45.00"),
            due_date=date(2026, 7, 30),
            status=Invoice.Status.PAID,
            submitted_by=submitter,
            file_url="https://example.com/invoices/inv-2026-004.pdf"
        )
        ApprovalStep.objects.create(
            invoice=inv4,
            approver=approver1,
            stage=1,
            status=ApprovalStep.Status.APPROVED,
            comments="Pre-approved utility bill."
        )

        self.stdout.write(self.style.SUCCESS("Database seeding completed!"))
        self.stdout.write("\nCredentials for testing:")
        self.stdout.write("------------------------")
        self.stdout.write("Submitter:     submitter_user / password123")
        self.stdout.write("Approver 1:    approver_1     / password123")
        self.stdout.write("Approver 2:    approver_2     / password123")
        self.stdout.write("Finance Admin: finance_admin  / password123")
        self.stdout.write("------------------------\n")
