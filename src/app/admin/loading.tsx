import { SkeletonPanel } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-bg p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-4">
        <SkeletonPanel />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonPanel />
          <SkeletonPanel />
          <SkeletonPanel />
          <SkeletonPanel />
        </div>
        <SkeletonPanel />
      </div>
    </main>
  );
}
