import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Send, Mic, MicOff, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  message_type: 'text' | 'voice';
  audio_url?: string;
  created_at: string;
  sender?: {
    producer_name?: string;
    producer_logo_url?: string;
  };
}

interface CookModeChatProps {
  sessionId: string;
}

export const CookModeChat: React.FC<CookModeChatProps> = ({ sessionId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    loadMessages();
    getCurrentUser();
    setupRealtimeSubscription();
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('collaboration_messages')
        .select(`
          *,
          sender:profiles!collaboration_messages_sender_id_fkey(
            producer_name,
            producer_logo_url
          )
        `)
        .eq('collaboration_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('producer_name, producer_logo_url')
          .eq('id', user.id)
          .single();
        
        setCurrentUser({ ...user, profile });
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'collaboration_messages',
          filter: `collaboration_id=eq.${sessionId}`
        },
        async (payload) => {
          // Fetch the new message with sender info
          const { data } = await supabase
            .from('collaboration_messages')
            .select(`
              *,
              sender:profiles!collaboration_messages_sender_id_fkey(
                producer_name,
                producer_logo_url
              )
            `)
            .eq('id', payload.new.id)
            .single();
          
          if (data) {
            setMessages(prev => [...prev, data]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendTextMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    try {
      const { error } = await supabase
        .from('collaboration_messages')
        .insert({
          collaboration_id: sessionId,
          sender_id: currentUser.id,
          content: newMessage.trim(),
          message_type: 'text'
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await uploadVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      toast.success('Recording stopped');
    }
  };

  const uploadVoiceMessage = async (audioBlob: Blob) => {
    try {
      if (!currentUser) return;

      const fileName = `voice_notes/${sessionId}/${Date.now()}.wav`;
      
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);

      const { error: messageError } = await supabase
        .from('collaboration_messages')
        .insert({
          collaboration_id: sessionId,
          sender_id: currentUser.id,
          content: 'Voice message',
          message_type: 'voice',
          audio_url: publicUrl
        });

      if (messageError) throw messageError;
      
      toast.success('Voice message sent');
    } catch (error) {
      console.error('Error uploading voice message:', error);
      toast.error('Failed to send voice message');
    }
  };

  const playAudio = (audioUrl: string) => {
    const audio = new Audio(audioUrl);
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
      toast.error('Failed to play audio');
    });
  };

  const formatMessageTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-card/20 backdrop-blur-sm">
        <h3 className="text-lg font-semibold text-foreground">Session Chat</h3>
        <p className="text-sm text-muted-foreground">Collaborate in real-time</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.sender_id === currentUser?.id;
            
            return (
              <div key={message.id} className={`flex gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={message.sender?.producer_logo_url} />
                  <AvatarFallback className="text-xs">
                    {message.sender?.producer_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className={`flex-1 max-w-xs ${isOwnMessage ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {isOwnMessage ? 'You' : message.sender?.producer_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatMessageTime(message.created_at)}
                    </span>
                  </div>
                  
                  <Card className={`${isOwnMessage ? 'bg-neon-cyan/20 border-neon-cyan/30' : 'bg-card/50 border-border/50'}`}>
                    <CardContent className="p-3">
                      {message.message_type === 'text' ? (
                        <p className="text-sm text-foreground">{message.content}</p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => message.audio_url && playAudio(message.audio_url)}
                            className="p-1"
                          >
                            <Volume2 className="w-4 h-4" />
                          </Button>
                          <Badge variant="outline" className="text-xs">
                            Voice message
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50 bg-card/20 backdrop-blur-sm">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyPress={(e) => e.key === 'Enter' && sendTextMessage()}
            className="flex-1 bg-background/50 border-border/50 focus:border-neon-cyan/50"
          />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-2 ${isRecording ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          
          <Button
            onClick={sendTextMessage}
            disabled={!newMessage.trim()}
            className="bg-gradient-to-r from-neon-cyan to-electric-blue text-black hover:opacity-90"
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        {isRecording && (
          <div className="mt-2 text-center">
            <Badge variant="outline" className="text-red-500 border-red-500">
              Recording... Click mic to stop
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};