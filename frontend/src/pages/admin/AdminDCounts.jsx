import { useInfiniteQuery } from "@tanstack/react-query";
import Async from "../../components/Async";
import Empty from "../../components/Empty";
import Title from "../../components/Title";
import { api } from "../../api/client";
import { t } from "../../i18n";

export default function AdminDCounts() {
    const q = useInfiniteQuery({
        queryKey: ["admin", "d-people", "member-counts"],
        initialPageParam: null,
        queryFn: ({ pageParam, signal }) => {
            const params = new URLSearchParams({ limit: "50" });
            if (pageParam) params.set("cursor", pageParam);
            return api(`/admin/d-people/member-counts?${params}`, { signal });
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });
    const members = q.data?.pages.flatMap((page) => page.items) ?? [];
    return <div className="space-y-3">
        <Title>{t("D counts by member")}</Title>
        <p className="text-sm text-slate-600">{t("Count of unique citizen records currently checked as D and attributed to each booth member.")}</p>
        <Async q={q}>{() => <>
            {members.length ? members.map((member) => <div key={member.memberId} className="card mb-2 flex items-center justify-between gap-3">
                <span className="font-medium">{member.fullName}</span>
                <span className="text-lg font-semibold tabular-nums" aria-label={`${member.dCount} ${t("D records")}`}>{member.dCount}</span>
            </div>) : <Empty text={t("No booth members found.")} />}
            {q.hasNextPage && <button type="button" className="btn w-full" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{t(q.isFetchingNextPage ? "Loading…" : "Show more members")}</button>}
        </>}</Async>
    </div>;
}
