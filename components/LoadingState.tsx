export function LoadingState({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="aspect-square animate-pulse rounded-lg border border-white/10 bg-white/[0.05]"
        />
      ))}
    </div>
  );
}
