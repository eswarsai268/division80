const Skeleton = () => <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white"/>)}</div>;

export default Skeleton;
