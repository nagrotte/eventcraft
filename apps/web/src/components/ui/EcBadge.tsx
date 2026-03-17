type BadgeVariant = 'draft' | 'published' | 'cancelled';

const variantClass: Record<BadgeVariant, string> = {
  draft:     'ec-badge ec-badge-draft',
  published: 'ec-badge ec-badge-published',
  cancelled: 'ec-badge ec-badge-draft'
};

const label: Record<BadgeVariant, string> = {
  draft:     'Draft',
  published: 'Published',
  cancelled: 'Cancelled'
};

export function EcBadge({ status }: { status: string }) {
  const v = (status as BadgeVariant) in variantClass ? status as BadgeVariant : 'draft';
  return <span className={variantClass[v]}>{label[v]}</span>;
}
