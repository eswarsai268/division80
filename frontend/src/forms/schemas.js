import { z } from "zod";

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1, "Password required") });
export const registerSchema = z.object({ fullName: z.string().min(2), email: z.string().email(), password: z.string().min(12, "At least 12 characters") });
export const complaintSchema = z.object({
  title: z.string().min(3, "Min 3 characters").max(200),
  category: z.string().min(2),
  description: z.string().min(10, "Min 10 characters").max(5000),
  location: z.string().max(255).optional(),
});
export const profileSchema = z.object({ fullName: z.string().min(2), phone: z.string().max(32).optional() });
