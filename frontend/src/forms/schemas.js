import { z } from "zod";

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1, "Password required") });
export const registerSchema = z.object({ fullName: z.string().min(2), email: z.string().email(), password: z.string().min(12, "At least 12 characters").max(128, "Maximum 128 characters") });
export const complaintSchema = z.object({
  title: z.string().min(3, "Min 3 characters").max(200),
  category: z.string().min(2),
  description: z.string().min(10, "Min 10 characters").max(5000),
  location: z.string().max(255).optional(),
});
const profileNamePattern = /^[\p{L}\p{M}]+(?:[ .'-’][\p{L}\p{M}]+)*$/u;
export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(200).regex(profileNamePattern, "Use letters, spaces, apostrophes, periods, or hyphens in your name"),
  phone: z.string().regex(/^\d{10}$/, "Enter exactly 10 digits").optional().or(z.literal("")),
});
