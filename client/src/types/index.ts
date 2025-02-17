export interface MetadataResult {
  id: string;
  fileName: string;
  title: string;
  description: string;
  keywords: string[];
  status: "processing" | "completed" | "failed";
  imageUrl: string;
  error?: string;
}

export interface EditingState {
  id: string | null;
  field: "title" | "description" | "keywords" | null;
}
