export interface ConventionItem {
  id: number;
  term: string;
  definition: string;
  category: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ConventionRequest {
  term: string;
  definition: string;
  category?: string;
  imageUrl?: string | null;
}
