import ErrorBox from "./ErrorBox";
import Skeleton from "./Skeleton";

function Async({ q, children }) {
    if (q.isLoading)
        return <Skeleton />;
    if (q.error)
        return <ErrorBox error={q.error}/>;
    return <>{children(q.data)}</>;
}

export default Async;
