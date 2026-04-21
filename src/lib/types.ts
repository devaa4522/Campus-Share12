import { z } from "zod";

/* ─── Database Row Types ─── */

export interface Profile {
  id: string;
  full_name: string | null;
  major: string | null;
  year_of_study: string | null;
  karma_score: number | null;
  is_shadow_banned: boolean | null;
  is_verified: boolean | null;
  avatar_url: string | null;
  college_domain: string | null;
  college_type: string | null;
  department: string | null;
  degree: string | null;
  branch?: string | null;
  bio?: string | null;
  notifications_enabled?: boolean | null;
  profile_public?: boolean | null;
  flags_count?: number | null;
  banned_until?: string | null;
  student_id_hash?: string | null;
}

export interface Item {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  condition: string | null;
  price_type: "Free" | "Karma" | "Rental" | null;
  price_amount: number | null;
  status: "available" | "rented" | "returning" | null;
  images: string[] | null;
  created_at: string | null;
  college_domain: string | null;
  is_hidden: boolean;
  thumbnail_url: string | null;
}

export interface ItemWithProfile extends Item {
  profiles: Profile | null;
}

export interface ItemRequest {
  id: string;
  item_id: string;
  requester_id: string;
  duration_days: number;
  status: "pending" | "accepted" | "declined" | "rented" | "returning" | "completed";
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  reward_type: "karma" | "cash" | null;
  reward_amount: number | null;
  status: "open" | "claimed" | "done" | null;
  deadline: string | null;
  college_domain: string | null;
  created_at: string | null;
}

export interface TaskWithProfile extends Task {
  profiles: Profile | null;
}

export interface TaskClaim {
  id: string;
  task_id: string;
  claimed_by: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

/* ─── Category → Lucide Icon map for Low-Bandwidth mode ─── */

export const CATEGORY_ICONS: Record<string, string> = {
  Medical: "Stethoscope",
  Engineering: "Wrench",
  Arts: "Palette",
  Science: "FlaskConical",
} as const;

/* ─── Zod Schemas for Form Validation ─── */

const postItemBase = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title cannot exceed 120 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description cannot exceed 2000 characters"),
  category: z.string().min(1, "Please select a category"),
  condition: z.string().min(1, "Please select a condition"),
  price_type: z.enum(["Free", "Karma", "Rental"], {
    message: "Please select a price type",
  }),
  price_amount: z.coerce.number().min(0).optional(),
  loan_duration: z.string().optional(),
});

export const postItemSchema = postItemBase.superRefine((data, ctx) => {
  if (data.price_type === "Rental" && (!data.price_amount || data.price_amount <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Rental items must have a price greater than 0",
      path: ["price_amount"],
    });
  }
  if (data.price_type === "Karma" && (!data.price_amount || data.price_amount <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please enter karma points required",
      path: ["price_amount"],
    });
  }
});

export type PostItemFormData = z.infer<typeof postItemBase>;

/* ─── Onboarding Schema ─── */

export const onboardingSchema = z.object({
  department: z.enum(["MEDICAL", "ENGINEERING", "ARTS"], {
    message: "Please select a department",
  }),
  degree: z.string().min(1, "Please select a degree"),
  branch: z.string().min(1, "Please select a branch"),
  year_of_study: z.string().min(1, "Please select your year"),
  studentId: z.string().min(3, "Student ID must be at least 3 characters").max(50, "Invalid Student ID"),
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;
