import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { 
  Plus, Filter, Calendar, FileText, CheckCircle2, XCircle, 
  Clock, DollarSign, ArrowRight, UserCheck, AlertTriangle, ShieldCheck 
} from 'lucide-react';

interface Approver {
  id: number;
  username: string;
  role: string;
}

interface Vendor {
  id: string;
  name: string;
  email: string;
  bank_account_details: string;
}

interface ApprovalStep {
  id: string;
  approver: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  stage: number;
  comments: string;
  updated_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  vendor: Vendor;
  amount: string;
  tax_amount: string;
  due_date: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PAID';
  submitted_by: {
    id: number;
    username: string;
    role: string;
  };
  file_url?: string;
  approval_steps: ApprovalStep[];
  created_at: string;
}

export const Dashboard: React.FC = () => {
  const { user, apiFetch } = useAuth();
  
  // Lists
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [actionComments, setActionComments] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  
  // Form state
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formVendorId, setFormVendorId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formTaxAmount, setFormTaxAmount] = useState('0.00');
  const [formDueDate, setFormDueDate] = useState('');
  const [formFileUrl, setFormFileUrl] = useState('');
  const [formPrimaryApproverId, setFormPrimaryApproverId] = useState('');
  const [formSecondaryApproverId, setFormSecondaryApproverId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    fetchInvoices();
    fetchVendors();
    if (user?.role === 'SUBMITTER') {
      fetchApprovers();
    }
  }, [user, statusFilter, vendorFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let url = '/api/invoices/';
      const params = [];
      if (statusFilter) params.push(`status=${statusFilter}`);
      if (vendorFilter) params.push(`vendor=${vendorFilter}`);
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (e) {
      console.error('Error fetching invoices', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await apiFetch('/api/vendors/');
      if (res.ok) {
        const data = await res.json();
        setVendors(data);
      }
    } catch (e) {
      console.error('Error fetching vendors', e);
    }
  };

  const fetchApprovers = async () => {
    try {
      const res = await apiFetch('/api/auth/approvers/');
      if (res.ok) {
        const data = await res.json();
        setApprovers(data);
      }
    } catch (e) {
      console.error('Error fetching approvers', e);
    }
  };

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Simple manual validation
    if (!formInvoiceNumber || !formVendorId || !formAmount || !formDueDate || !formPrimaryApproverId) {
      setFormError('Please fill in all required fields.');
      return;
    }

    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError('Please enter a valid amount.');
      return;
    }

    if (amountNum > 10000) {
      if (!formSecondaryApproverId) {
        setFormError('Invoices exceeding $10,000 require a secondary approver.');
        return;
      }
      if (formPrimaryApproverId === formSecondaryApproverId) {
        setFormError('Primary and secondary approvers must be different users.');
        return;
      }
    }

    setFormSubmitting(true);
    try {
      const res = await apiFetch('/api/invoices/', {
        method: 'POST',
        body: JSON.stringify({
          invoice_number: formInvoiceNumber,
          vendor_id: formVendorId,
          amount: formAmount,
          tax_amount: formTaxAmount,
          due_date: formDueDate,
          file_url: formFileUrl || null,
          assigned_approver_id: parseInt(formPrimaryApproverId),
          secondary_approver_id: formSecondaryApproverId ? parseInt(formSecondaryApproverId) : null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        const details = errData.secondary_approver_id || errData.invoice_number || errData.detail || 'Failed to submit invoice.';
        throw new Error(typeof details === 'object' ? JSON.stringify(details) : details);
      }

      // Success
      setIsSubmitModalOpen(false);
      resetSubmitForm();
      fetchInvoices();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const resetSubmitForm = () => {
    setFormInvoiceNumber('');
    setFormVendorId('');
    setFormAmount('');
    setFormTaxAmount('0.00');
    setFormDueDate('');
    setFormFileUrl('');
    setFormPrimaryApproverId('');
    setFormSecondaryApproverId('');
    setFormError(null);
  };

  const handleApprove = async (invoiceId: string) => {
    setActionError(null);
    try {
      const res = await apiFetch(`/api/invoices/${invoiceId}/approve/`, {
        method: 'POST',
        body: JSON.stringify({ comments: actionComments }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Approval failed');
      }
      const updated = await res.json();
      setSelectedInvoice(updated);
      setActionComments('');
      fetchInvoices();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleReject = async (invoiceId: string) => {
    setActionError(null);
    try {
      const res = await apiFetch(`/api/invoices/${invoiceId}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ comments: actionComments }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Rejection failed');
      }
      const updated = await res.json();
      setSelectedInvoice(updated);
      setActionComments('');
      fetchInvoices();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handlePay = async (invoiceId: string) => {
    setActionError(null);
    try {
      const res = await apiFetch(`/api/invoices/${invoiceId}/pay/`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Payment processing failed');
      }
      const updated = await res.json();
      setSelectedInvoice(updated);
      fetchInvoices();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const commonStyle = 'px-2.5 py-1 text-xs font-semibold rounded-full border ';
    switch (status) {
      case 'DRAFT':
        return <span className={commonStyle + 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>Draft</span>;
      case 'PENDING_APPROVAL':
        return <span className={commonStyle + 'bg-amber-500/10 text-amber-400 border-amber-500/20'}>Pending Approval</span>;
      case 'APPROVED':
        return <span className={commonStyle + 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}>Approved</span>;
      case 'REJECTED':
        return <span className={commonStyle + 'bg-rose-500/10 text-rose-400 border-rose-500/20'}>Rejected</span>;
      case 'PAID':
        return <span className={commonStyle + 'bg-sky-500/10 text-sky-400 border-sky-500/20'}>Paid</span>;
      default:
        return <span className={commonStyle + 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>{status}</span>;
    }
  };

  const hasPendingApprovalStep = (invoice: Invoice): boolean => {
    if (user?.role !== 'APPROVER') return false;
    return invoice.approval_steps.some(step => step.approver.id === user.id && step.status === 'PENDING');
  };

  // Stats calculation helper
  const stats = {
    totalCount: invoices.length,
    pendingApproval: invoices.filter(i => i.status === 'PENDING_APPROVAL').length,
    approved: invoices.filter(i => i.status === 'APPROVED').length,
    paidSum: invoices.filter(i => i.status === 'PAID').reduce((acc, curr) => acc + parseFloat(curr.amount), 0),
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* STATS SECTION */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Invoices</p>
                <h3 className="text-2xl font-bold mt-1 text-white">{stats.totalCount}</h3>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-lg text-slate-300">
                <FileText className="h-6 w-6" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Action</p>
                <h3 className="text-2xl font-bold mt-1 text-amber-400">{stats.pendingApproval}</h3>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-lg text-amber-400">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ready to Pay</p>
                <h3 className="text-2xl font-bold mt-1 text-emerald-400">{stats.approved}</h3>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Paid Invoices</p>
                <h3 className="text-2xl font-bold mt-1 text-sky-400">${stats.paidSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="p-3 bg-sky-500/10 rounded-lg text-sky-400">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 mb-6 bg-slate-900/20 p-4 border border-slate-850 rounded-xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-semibold uppercase tracking-wider">
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </div>
            {/* Vendor Filter */}
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-350 outline-none focus:border-sky-500"
            >
              <option value="">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-350 outline-none focus:border-sky-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="PAID">Paid</option>
            </select>
          </div>

          {user?.role === 'SUBMITTER' && (
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="flex items-center space-x-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-sky-500/20"
            >
              <Plus className="h-4 w-4" />
              <span>Submit Invoice</span>
            </button>
          )}
        </div>

        {/* WORKSPACE AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* INVOICE LIST TABLE */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden backdrop-blur-sm">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                {user?.role === 'APPROVER' ? 'Your Approvals Queue' : 'Invoices Ledger'}
              </h2>
            </div>
            
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></div>
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <FileText className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm font-medium">No invoices found matching current criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/50 text-[10px] uppercase font-bold tracking-widest text-slate-400 border-b border-slate-850">
                    <tr>
                      <th className="px-5 py-3.5">Invoice #</th>
                      <th className="px-5 py-3.5">Vendor</th>
                      <th className="px-5 py-3.5">Amount</th>
                      <th className="px-5 py-3.5">Due Date</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {invoices.map((inv) => {
                      const requiresAction = hasPendingApprovalStep(inv);
                      return (
                        <tr 
                          key={inv.id} 
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setActionError(null);
                          }}
                          className={`cursor-pointer hover:bg-slate-900/40 ${selectedInvoice?.id === inv.id ? 'bg-slate-900/60' : ''}`}
                        >
                          <td className="px-5 py-4 font-bold text-white flex items-center space-x-2">
                            <span>{inv.invoice_number}</span>
                            {requiresAction && (
                              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" title="Requires Action"></span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-slate-300 font-semibold">{inv.vendor.name}</td>
                          <td className="px-5 py-4 text-white font-mono font-semibold">${parseFloat(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-4 text-slate-400 font-medium">
                            <span className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3" />
                              <span>{inv.due_date}</span>
                            </span>
                          </td>
                          <td className="px-5 py-4">{getStatusBadge(inv.status)}</td>
                          <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setActionError(null);
                              }}
                              className="text-sky-400 hover:text-sky-300 font-semibold flex items-center justify-end space-x-1 ml-auto"
                            >
                              <span>Details</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* AUDIT LOG & INTERACTION PANEL */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col backdrop-blur-sm">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Details & Workflow</h2>
            </div>
            
            {selectedInvoice ? (
              <div className="p-5 space-y-6 flex-1 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-5">
                  {/* Invoice Header Details */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Invoice Information</span>
                    <h3 className="text-lg font-bold text-white mt-1">{selectedInvoice.invoice_number}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Submitted by {selectedInvoice.submitted_by.username}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                      <p className="text-slate-500 font-semibold mb-0.5">Amount</p>
                      <p className="text-base font-mono font-bold text-white">${parseFloat(selectedInvoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                      <p className="text-slate-500 font-semibold mb-0.5">Tax (VAT)</p>
                      <p className="text-base font-mono font-bold text-white">${parseFloat(selectedInvoice.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-800/60 pt-4 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Vendor:</span>
                      <span className="text-white font-bold">{selectedInvoice.vendor.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Vendor Email:</span>
                      <span className="text-slate-350">{selectedInvoice.vendor.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Bank Details:</span>
                      <span className="font-mono text-slate-300 font-semibold">{selectedInvoice.vendor.bank_account_details}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Due Date:</span>
                      <span className="text-slate-300 font-bold">{selectedInvoice.due_date}</span>
                    </div>
                    {selectedInvoice.file_url && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">File Attachment:</span>
                        <a 
                          href={selectedInvoice.file_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-sky-400 hover:underline font-semibold"
                        >
                          View PDF
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Workflow Steps Audit Trail */}
                  <div className="border-t border-slate-800/60 pt-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Workflow Audit Log</h4>
                    <div className="space-y-3.5">
                      {selectedInvoice.approval_steps.map((step, idx) => (
                        <div key={step.id} className="relative flex items-start space-x-3 text-xs">
                          {/* Step Connector line */}
                          {idx < selectedInvoice.approval_steps.length - 1 && (
                            <div className="absolute left-[9px] top-6 w-[1.5px] h-9 bg-slate-800"></div>
                          )}
                          <div className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            step.status === 'APPROVED' ? 'bg-emerald-500 border-emerald-500 text-white' :
                            step.status === 'REJECTED' ? 'bg-rose-500 border-rose-500 text-white' :
                            'bg-slate-900 border-slate-700'
                          }`}>
                            {step.status === 'APPROVED' && <CheckCircle2 className="h-3 w-3" />}
                            {step.status === 'REJECTED' && <XCircle className="h-3 w-3" />}
                            {step.status === 'PENDING' && <span className="text-[9px] font-extrabold text-slate-500">{step.stage}</span>}
                          </div>
                          <div className="flex-1 bg-slate-950/20 p-2.5 rounded-lg border border-slate-800/40">
                            <div className="flex justify-between items-center">
                              <p className="font-bold text-white">Stage {step.stage}: {step.approver.username}</p>
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                                step.status === 'APPROVED' ? 'text-emerald-400' :
                                step.status === 'REJECTED' ? 'text-rose-400' :
                                'text-amber-400'
                              }`}>{step.status}</span>
                            </div>
                            {step.comments && (
                              <p className="text-[11px] text-slate-450 mt-1 font-medium bg-slate-900/30 px-2 py-1 rounded italic">
                                "{step.comments}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Role Actions Form */}
                <div className="border-t border-slate-800 pt-4 mt-6">
                  {actionError && (
                    <div className="mb-3 flex items-center space-x-1.5 text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{actionError}</span>
                    </div>
                  )}

                  {/* Approver Action Panel */}
                  {user?.role === 'APPROVER' && hasPendingApprovalStep(selectedInvoice) && (
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Add Review Comments (optional)
                      </label>
                      <textarea
                        value={actionComments}
                        onChange={(e) => setActionComments(e.target.value)}
                        placeholder="Add comments on why you are approving or rejecting..."
                        rows={2}
                        className="block w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      />
                      <div className="grid grid-cols-2 gap-3 pt-1.5">
                        <button
                          onClick={() => handleReject(selectedInvoice.id)}
                          className="flex items-center justify-center space-x-1 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold py-2.5"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleApprove(selectedInvoice.id)}
                          className="flex items-center justify-center space-x-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold py-2.5 shadow-lg shadow-emerald-500/20"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Admin Action Panel */}
                  {user?.role === 'FINANCE_ADMIN' && selectedInvoice.status === 'APPROVED' && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 mb-3">
                        <ShieldCheck className="h-4 w-4" />
                        <span>Ready for final payment processing.</span>
                      </div>
                      <button
                        onClick={() => handlePay(selectedInvoice.id)}
                        className="flex w-full items-center justify-center space-x-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold py-3 shadow-lg shadow-sky-500/20"
                      >
                        <DollarSign className="h-4 w-4" />
                        <span>Confirm and Pay Invoice</span>
                      </button>
                    </div>
                  )}

                  {/* Simple confirmation checks */}
                  {selectedInvoice.status === 'PAID' && (
                    <div className="flex items-center justify-center space-x-1.5 text-xs text-sky-400 bg-sky-500/10 p-3 rounded-lg border border-sky-500/20 font-bold uppercase tracking-wider">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Completed & Paid</span>
                    </div>
                  )}
                  {selectedInvoice.status === 'REJECTED' && (
                    <div className="flex items-center justify-center space-x-1.5 text-xs text-rose-450 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 font-bold uppercase tracking-wider">
                      <XCircle className="h-4 w-4" />
                      <span>Invoice Rejected</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-5">
                <UserCheck className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-xs text-center font-medium">Select an invoice from the ledger to view details, verify sensitive bank info, and see the approval steps history.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* SUBMISSION MODAL */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative">
            <h3 className="text-base font-bold uppercase tracking-wider text-white mb-5">Submit New Invoice</h3>
            
            {formError && (
              <div className="mb-4 flex items-start space-x-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitInvoice} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Invoice Number *</label>
                  <input
                    type="text"
                    required
                    value={formInvoiceNumber}
                    onChange={(e) => setFormInvoiceNumber(e.target.value)}
                    placeholder="INV-2026-X1"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-white placeholder-slate-500 outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Vendor *</label>
                  <select
                    required
                    value={formVendorId}
                    onChange={(e) => setFormVendorId(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-white outline-none focus:border-sky-500"
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Amount (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-white placeholder-slate-500 outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Tax Amount (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formTaxAmount}
                    onChange={(e) => setFormTaxAmount(e.target.value)}
                    placeholder="0.00"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-white placeholder-slate-500 outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-white outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Supporting URL / PDF Attachment</label>
                  <input
                    type="url"
                    value={formFileUrl}
                    onChange={(e) => setFormFileUrl(e.target.value)}
                    placeholder="https://example.com/invoice.pdf"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-white placeholder-slate-500 outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Dynamic Approvers Selection */}
              <div className="border-t border-slate-800/80 pt-4 space-y-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Primary Approver *</label>
                  <select
                    required
                    value={formPrimaryApproverId}
                    onChange={(e) => setFormPrimaryApproverId(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-white outline-none focus:border-sky-500"
                  >
                    <option value="">Select Primary Approver</option>
                    {approvers.map(a => (
                      <option key={a.id} value={a.id}>{a.username}</option>
                    ))}
                  </select>
                </div>

                {/* Amount exceeds $10,000 Trigger Workflow Warning and Secondary Selection */}
                {parseFloat(formAmount) > 10000 && (
                  <div className="space-y-4 bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl">
                    <div className="flex items-start space-x-2 text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">High Value Workflow Active</p>
                        <p className="text-[10px] text-slate-400">Invoice exceeds $10,000 and requires approval from two different reviewers.</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">Secondary Approver *</label>
                      <select
                        required
                        value={formSecondaryApproverId}
                        onChange={(e) => setFormSecondaryApproverId(e.target.value)}
                        className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-white outline-none focus:border-sky-500"
                      >
                        <option value="">Select Secondary Approver</option>
                        {approvers.map(a => (
                          <option key={a.id} value={a.id}>{a.username}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitModalOpen(false);
                    resetSubmitForm();
                  }}
                  className="rounded-lg border border-slate-800 px-4 py-2 hover:bg-slate-950 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded-lg bg-sky-500 hover:bg-sky-400 px-4 py-2 font-bold text-white shadow-lg shadow-sky-500/20 disabled:opacity-50"
                >
                  {formSubmitting ? 'Submitting...' : 'Submit Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
