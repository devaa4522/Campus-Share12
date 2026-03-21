/* ─── College Utilities ─── */

export type CollegeType = "MEDICAL" | "ENGINEERING" | "ARTS" | "GENERAL";

/**
 * Extracts the domain from an email address.
 * e.g. "user@med.stanford.edu" → "med.stanford.edu"
 */
export function parseCollegeDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

/**
 * Auto-detects college type from the email domain.
 */
export function detectCollegeType(domain: string): CollegeType {
  const d = domain.toLowerCase();
  if (/med|medical|health|pharma|nursing/.test(d)) return "MEDICAL";
  if (/eng|tech|poly|iit|nit|iiit/.test(d)) return "ENGINEERING";
  if (/arts|design|fine|craft|arch/.test(d)) return "ARTS";
  return "GENERAL";
}

/* ─── Department-specific category grids ─── */

export interface CategoryItem {
  id: string;
  label: string;
  icon: string; // Material Symbols icon name
  description?: string;
}

export const MEDICAL_CATEGORIES: CategoryItem[] = [
  { id: "stethoscope", label: "Stethoscope", icon: "stethoscope" },
  { id: "lab-coat", label: "Lab Coat", icon: "medical_services" },
  { id: "scrubs", label: "Scrubs", icon: "apparel" },
  { id: "reflex-hammer", label: "Reflex Hammer", icon: "hardware" },
  { id: "anatomy-atlas", label: "Anatomy Atlas", icon: "menu_book" },
];

export const ENGINEERING_CATEGORIES: CategoryItem[] = [
  { id: "calculator", label: "Graphing Calculator", icon: "calculate", description: "TI-84 Plus, Nspire, or equivalent." },
  { id: "drafting", label: "Drafting Tools", icon: "architecture", description: "T-squares, compasses, scales." },
  { id: "arduino", label: "Arduino Kit", icon: "memory", description: "Breadboards, sensors, wiring." },
  { id: "camera", label: "DSLR Camera", icon: "photo_camera", description: "Digital lab & field documentation." },
  { id: "surveying", label: "Surveying Gear", icon: "precision_manufacturing", description: "Theodolites and tripod stations." },
];

export const ARTS_CATEGORIES: CategoryItem[] = [
  { id: "easel", label: "Easel", icon: "architecture" },
  { id: "brushes", label: "Brushes", icon: "brush" },
  { id: "tablet", label: "Drawing Tablet", icon: "tablet_android" },
  { id: "lighting", label: "Lighting Kit", icon: "lightbulb" },
  { id: "portfolios", label: "Portfolios", icon: "browse_gallery" },
];

export const GENERAL_CATEGORIES: CategoryItem[] = [
  { id: "books", label: "Books", icon: "menu_book" },
  { id: "electronics", label: "Electronics", icon: "devices" },
  { id: "supplies", label: "Supplies", icon: "inventory_2" },
  { id: "lab-gear", label: "Lab Gear", icon: "science" },
  { id: "other", label: "Other", icon: "category" },
];

export function getCategoriesForDepartment(collegeType: CollegeType): CategoryItem[] {
  switch (collegeType) {
    case "MEDICAL": return MEDICAL_CATEGORIES;
    case "ENGINEERING": return ENGINEERING_CATEGORIES;
    case "ARTS": return ARTS_CATEGORIES;
    default: return GENERAL_CATEGORIES;
  }
}

/* ─── Department-specific degree options ─── */

export function getDegreesForDepartment(dept: string): string[] {
  switch (dept) {
    case "MEDICAL":
      return ["MBBS", "BDS", "B.Pharm", "M.D.", "M.S.", "Ph.D"];
    case "ENGINEERING":
      return ["B.Tech", "B.E.", "M.Tech", "M.E.", "Ph.D"];
    case "ARTS":
      return ["B.F.A.", "B.Des.", "M.F.A.", "M.Des.", "Ph.D"];
    default:
      return ["Bachelor's", "Master's", "Doctorate", "Diploma"];
  }
}

export function getBranchesForDepartment(dept: string): string[] {
  switch (dept) {
    case "MEDICAL":
      return ["General Medicine", "Surgery", "Pediatrics", "Orthopedics", "Pharmacology", "Anatomy", "Pathology"];
    case "ENGINEERING":
      return ["Computer Science", "Information Technology", "Electronics & Comm.", "Mechanical", "Civil", "Electrical", "Chemical"];
    case "ARTS":
      return ["Fine Arts", "Graphic Design", "Industrial Design", "Animation", "Photography", "Fashion Design", "Architecture"];
    default:
      return ["General Studies", "Business", "Social Sciences", "Natural Sciences", "Humanities"];
  }
}

export const ACADEMIC_YEARS = [
  { value: "1st Year", label: "1st Year", subtitle: "Freshman" },
  { value: "2nd Year", label: "2nd Year", subtitle: "Sophomore" },
  { value: "3rd Year", label: "3rd Year", subtitle: "Junior" },
  { value: "4th Year", label: "4th Year", subtitle: "Senior" },
  { value: "5th Year", label: "5th Year", subtitle: "Super Senior" },
  { value: "Graduate", label: "Graduate", subtitle: "Post-Grad" },
] as const;

/* ─── Condition labels per department ─── */

export function getConditionsForDepartment(dept: string): string[] {
  switch (dept) {
    case "MEDICAL":
      return ["Like New", "Minor Wear", "Used (Functional)"];
    case "ARTS":
      return ["Archival Quality (Mint)", "Studio Grade (Used)", "Vintage/Distressed"];
    default:
      return ["Like New", "Good", "Fair", "Functional Only"];
  }
}

/* ─── Loan duration options ─── */

export const LOAN_DURATIONS = [
  { value: "2_days", label: "2 Days", subtitle: "Quick Turnaround" },
  { value: "1_week", label: "1 Week", subtitle: "Standard Project" },
  { value: "full_semester", label: "Full Semester", subtitle: "Long-term Access" },
] as const;
