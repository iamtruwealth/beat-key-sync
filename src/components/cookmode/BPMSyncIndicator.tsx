import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface BPMSyncIndicatorProps {
  detectedBPM?: number;
  sessionBPM: number;
  threshold?: number;
}

export const BPMSyncIndicator: React.FC<BPMSyncIndicatorProps> = ({
  detectedBPM,
  sessionBPM,
  threshold = 5
}) => {
  if (detectedBPM === undefined || detectedBPM === null) {
    return null; // Hide indicator when no BPM is available to avoid "Analyzing..." stuck state
  }

  const bpmDifference = Math.abs(detectedBPM - sessionBPM);
  const isInSync = bpmDifference <= threshold;
  const isDoubleTime = Math.abs(detectedBPM - sessionBPM * 2) <= threshold;
  const isHalfTime = Math.abs(detectedBPM - sessionBPM / 2) <= threshold;

  if (isInSync) {
    return (
      <Badge variant="outline" className="text-xs bg-green-500/20 border-green-500/50 text-green-300">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        In Sync
      </Badge>
    );
  }

  if (isDoubleTime) {
    return (
      <Badge variant="outline" className="text-xs bg-blue-500/20 border-blue-500/50 text-blue-300">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        2x Sync
      </Badge>
    );
  }

  if (isHalfTime) {
    return (
      <Badge variant="outline" className="text-xs bg-blue-500/20 border-blue-500/50 text-blue-300">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        1/2 Sync
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-xs bg-orange-500/20 border-orange-500/50 text-orange-300">
      <AlertCircle className="w-3 h-3 mr-1" />
      {detectedBPM} BPM
    </Badge>
  );
};