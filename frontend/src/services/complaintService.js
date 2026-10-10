import { api, post } from "../api/client";

export const createComplaint = (v) => post("/complaints", v);
/** Raw image upload: the server validates type, size and magic bytes. */
export const uploadAttachment = (id, file) =>
  api(`/complaints/${id}/attachments`, { method: "POST", body: file, headers: { "Content-Type": file.type } });
