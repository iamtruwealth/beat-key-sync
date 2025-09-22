import { Button } from '@/components/ui/button';

interface FeedFilterProps {
  activeFilter: 'for-you' | 'following';
  onFilterChange: (filter: 'for-you' | 'following') => void;
  followingCount?: number;
}

export function FeedFilter({ activeFilter, onFilterChange, followingCount = 0 }: FeedFilterProps) {
  return (
    <div className="flex items-center gap-1 bg-muted p-1 rounded-lg mb-4">
      <Button
        variant={activeFilter === 'for-you' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onFilterChange('for-you')}
        className="flex-1"
      >
        For You
      </Button>
      <Button
        variant={activeFilter === 'following' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onFilterChange('following')}
        className="flex-1"
        disabled={followingCount === 0}
      >
        Following
        {followingCount > 0 && (
          <span className="ml-1 text-xs opacity-70">({followingCount})</span>
        )}
      </Button>
    </div>
  );
}