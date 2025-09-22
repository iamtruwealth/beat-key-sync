import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Music } from 'lucide-react';

interface SortByKeyProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

const musicalKeys = [
  'All Keys',
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dbm', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gbm', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm'
];

export function SortByKey({ value, onValueChange, className }: SortByKeyProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4" />
          <SelectValue placeholder="Filter by Key" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {musicalKeys.map((key) => (
          <SelectItem key={key} value={key === 'All Keys' ? '' : key}>
            {key}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}