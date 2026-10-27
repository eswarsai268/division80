import { z } from "zod";

export const loginSchema = z.object({ identifier: z.string().trim().min(1, "Phone number or email required").max(255), password: z.string().min(1, "Password required") });
