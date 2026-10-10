import { Link } from "react-router-dom";
import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";

export default function AdminBooths() {
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const q = useGet(["admin", "booths"], "/admin/booths");
    const m = useAct(() => post("/admin/booths", { code, name }).then(() => { setCode(""); setName(""); }));
    return <div className="space-y-3"><Title>Booths</Title>
    <div className="card space-y-2"><h2 className="font-semibold">Create booth</h2>
      <input className="input" placeholder="Code (e.g. B-12)" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Booth code"/><input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Booth name"/>
      {m.error && <ErrorBox error={m.error}/>}<button className="btn w-full" disabled={!code || name.length < 2 || m.isPending} onClick={() => m.mutate(undefined)}>Create</button></div>
    <Async q={q}>{(d) => d.length ? <>{d.map((b) => <Link key={b.id} to={`/admin/booths/${b.id}`} className="card mb-2 flex justify-between"><span>{b.code} — {b.name}</span><Badge s={b.status}/></Link>)}</> : <Empty text="No booths yet."/>}</Async></div>;
}
