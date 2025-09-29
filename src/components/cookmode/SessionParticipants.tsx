import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Crown, Headphones } from 'lucide-react';
import { InviteProducerButton } from './InviteProducerButton';

interface Participant {
  id: string;
  user_id: string;
  profile?: {
    producer_name?: string;
    producer_logo_url?: string;
  };
  role: string;
  joined_at: string;
}

interface SessionParticipantsProps {
  participants: Participant[];
  sessionId: string;
  showVideo?: boolean;
}

export const SessionParticipants: React.FC<SessionParticipantsProps> = ({ participants, sessionId, showVideo = false }) => {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'creator':
      case 'host':
        return <Crown className="w-3 h-3" />;
      default:
        return <Headphones className="w-3 h-3" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'creator':
      case 'host':
        return 'text-neon-cyan border-neon-cyan/30';
      default:
        return 'text-electric-blue border-electric-blue/30';
    }
  };

  const formatJoinTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-neon-cyan" />
          <h3 className="text-lg font-semibold text-foreground">
            Participants ({participants.length})
          </h3>
        </div>
        <InviteProducerButton sessionId={sessionId} />
      </div>

      <div className="space-y-2">
        {participants.length === 0 ? (
          <Card className="bg-card/30 border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Waiting for participants to join...
              </p>
            </CardContent>
          </Card>
        ) : (
          participants.map((participant) => (
            <Card key={participant.id} className="bg-card/30 border-border/50 hover:bg-card/50 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={participant.profile?.producer_logo_url} />
                    <AvatarFallback className="text-sm">
                      {participant.profile?.producer_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-foreground truncate">
                        {participant.profile?.producer_name || 'Unknown Producer'}
                      </h4>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getRoleColor(participant.role)}`}
                      >
                        {getRoleIcon(participant.role)}
                        <span className="ml-1 capitalize">{participant.role}</span>
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-muted-foreground">
                        Joined {formatJoinTime(participant.joined_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Session Stats - Hidden when video is active */}
      {!showVideo && (
        <Card className="bg-card/20 border-border/30">
          <CardContent className="p-3">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Session Status</span>
                <Badge variant="outline" className="text-green-400 border-green-400/30">
                  Live
                </Badge>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Active Members</span>
                <span className="text-foreground font-medium">{participants.length}</span>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Session Mode</span>
                <span className="text-neon-cyan font-medium">Cook Mode</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};