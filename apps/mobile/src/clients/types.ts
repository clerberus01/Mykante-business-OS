export type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: 'lead' | 'active' | 'inactive' | 'archived';
  tags: string[] | null;
  segment: string | null;
  source: string | null;
};

export type ClientFilters = {
  search: string;
  status: string;
  tag: string;
};
