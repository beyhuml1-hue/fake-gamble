import { json } from "../../_shared/auth.js";

export const onRequestGet = () => json({ error: "This feature is disabled." }, 404);
export const onRequestPost = onRequestGet;
