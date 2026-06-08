type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={["animate-pulse rounded-md bg-slate-300/45", className].join(" ")} />;
}

export function SkeletonPanel() {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-tight">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-8 w-3/4" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </section>
  );
}
