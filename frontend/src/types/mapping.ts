export const DOCUMENT_KINDS = [
  { value: "invoice_line", label: "Invoice line" },
  { value: "tax_invoice_line", label: "Tax on invoice" },
  { value: "cn_line", label: "Credit note line" },
  { value: "journal_debit", label: "Journal debit" },
  { value: "journal_credit", label: "Journal credit" },
  { value: "tax_journal", label: "Tax journal" },
  { value: "payment_amount", label: "Customer payment" },
  { value: "skip", label: "Skip" },
] as const;

export const SIGN_HINTS = [
  { value: "auto", label: "Auto" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
] as const;
