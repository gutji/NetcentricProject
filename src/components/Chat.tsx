import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '../types/game';
import SocketService from '../services/socket';
import './Chat.css';

interface ChatProps {
  gameId: string;
  myPlayerId: string;
}

const Chat: React.FC<ChatProps> = ({ gameId, myPlayerId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const socket = useMemo(() => SocketService.getInstance(), []);

  useEffect(() => {
    const onMsg = (msg: ChatMessage) => {
      if (msg.gameId !== gameId) return;
      setMessages(prev => [...prev, msg]);
    };
    socket.onChatMessage(onMsg);
    return () => {
      socket.offChatMessage(onMsg);
    };
  }, [socket, gameId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    socket.sendChatMessage(text);
    setDraft('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">💬 Blitz Chat</div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">Say hello to your opponent!</div>
        )}
        {messages.map((m) => {
          const mine = m.playerId === myPlayerId;
          return (
            <div key={m.id} className={"chat-message " + (mine ? 'mine' : 'theirs')}>
              <div className="chat-meta">
                <span className="name">{m.playerName}</span>
                <span className="time">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="chat-text">{m.message}</div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="chat-input">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message..."
          maxLength={200}
        />
        <button onClick={send} disabled={!draft.trim()}>Send</button>
      </div>
    </div>
  );
};

export default Chat;
