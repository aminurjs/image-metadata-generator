export interface MetadataResult {
  id: string;
  fileName: string;
  title: string;
  description: string;
  keywords: string[];
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

export interface EditingState {
  id: string | null;
  field: "title" | "description" | "keywords" | null;
}
