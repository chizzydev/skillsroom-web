type AdminEmptyStateProps = {
  title: string;
  description: string;
};

export function AdminEmptyState({ title, description }: AdminEmptyStateProps) {
  return (
    <div className="rounded-md border border-dashed border-line bg-surfaceWarm p-6">
      <h3 className="text-base font-black text-ink">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}
