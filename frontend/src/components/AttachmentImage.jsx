import { useState } from "react";
import { t } from "../i18n";

export default function AttachmentImage({ attachment, index, refresh }) {
  const [failedUrl, setFailedUrl] = useState("");
  const isUnavailable = failedUrl === attachment.url;

  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border border-brand-100 bg-stone-100">
      {isUnavailable
        ? <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-slate-600">
            <span>{t("Photo link expired or unavailable.")}</span>
            <button
              type="button"
              className="font-semibold text-amber-800 underline"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setFailedUrl("");
                refresh();
              }}
            >
              {t("Refresh photo")}
            </button>
          </span>
        : <a href={attachment.url} target="_blank" rel="noreferrer" className="group block h-full w-full focus:outline-none focus:ring-2 focus:ring-brand-600">
            <img
              src={attachment.url}
              alt={`Complaint photo ${index + 1}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              onError={() => {
                setFailedUrl(attachment.url);
                refresh();
              }}
            />
          </a>}
    </div>
  );
}
