import { manualCollectionAccount, manualCollectionPolicy } from "@/lib/manual-payment";

type ManualPaymentPanelProps = {
  amountLabel?: string;
  amountValue?: string;
  referenceHint?: string;
};

export function ManualPaymentPanel({ amountLabel, amountValue, referenceHint }: ManualPaymentPanelProps) {
  return (
    <div className="grid gap-4 rounded-lg border border-line bg-surfaceWarm p-4">
      <div>
        <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">{manualCollectionPolicy.title}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{manualCollectionPolicy.summary}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-line bg-white p-3">
          <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Bank</p>
          <p className="mt-2 text-base font-black text-ink">{manualCollectionAccount.bankName}</p>
        </div>
        <div className="rounded-md border border-line bg-white p-3">
          <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Account number</p>
          <p className="mt-2 font-mono text-base font-black text-ink">{manualCollectionAccount.accountNumber}</p>
        </div>
        <div className="rounded-md border border-line bg-white p-3">
          <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Account name</p>
          <p className="mt-2 text-base font-black text-ink">{manualCollectionAccount.accountName}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {amountLabel && amountValue ? (
          <div className="rounded-md border border-line bg-white p-3">
            <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">{amountLabel}</p>
            <p className="mt-2 text-base font-black text-ink">{amountValue}</p>
          </div>
        ) : null}
        {referenceHint ? (
          <div className="rounded-md border border-line bg-white p-3">
            <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Reference hint</p>
            <p className="mt-2 text-sm font-bold leading-6 text-ink">{referenceHint}</p>
          </div>
        ) : null}
      </div>
      <ul className="grid gap-2 text-sm leading-6 text-muted">
        {manualCollectionPolicy.instructions.map((item) => (
          <li className="rounded-md border border-line bg-white px-3 py-2" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
