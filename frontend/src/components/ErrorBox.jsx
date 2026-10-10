const ErrorBox = ({ error }) => {
    const e = error;
    const msg = e?.status === 403 ? "Access denied." : e?.status === 404 ? "Not found." : e?.status === 409 ? (e.message || "Conflict — please refresh.") : e?.status === 429 ? "Too many requests — slow down." : e?.message ?? "Something went wrong.";
    return <div role="alert" className="card border-red-200 bg-red-50 text-sm text-red-800">{msg}</div>;
};

export default ErrorBox;
