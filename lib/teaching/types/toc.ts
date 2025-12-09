export interface TOCItem {
  id: string;
  label: string;
  level: number; // 1 = section, 2 = subsection
  children?: TOCItem[];
}
