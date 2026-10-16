import { Configuration, PersonalApi } from "@/generated/api";

/**
 * The single API client shared by every store. The backend exposes all
 * operations under one OpenAPI tag, so the generated client is one class.
 * `basePath: ""` keeps requests relative, so the Vite dev proxy applies.
 */
export const api = new PersonalApi(new Configuration({ basePath: "" }));
