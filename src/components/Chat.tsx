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
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);
  const socket = useMemo(() => SocketService.getInstance(), []);

  useEffect(() => {
    const onMsg = (msg: ChatMessage) => {
      if (msg.gameId !== gameId) return;
      setMessages(prev => [...prev, msg]);
      // If chat is closed and the message is from the opponent, increment unread
      if (!isOpen && msg.playerId !== myPlayerId) {
        setUnread((c) => c + 1);
      }
    };
    socket.onChatMessage(onMsg);
    return () => {
      socket.offChatMessage(onMsg);
    };
  }, [socket, gameId, isOpen, myPlayerId]);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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
    <>
      {!isOpen && (
        <button
          className="chat-toggle-btn"
          onClick={() => {
            setIsOpen(true);
            setUnread(0);
          }}
          aria-label="Open chat"
        >
          💬 Chat {unread > 0 && <span className="badge" aria-label={`${unread} unread messages`}>{unread}</span>}
        </button>
      )}

      {isOpen && (
        <div className="chat-container">
          <div className="chat-header">
            <span>💬 Blitz Chat</span>
            <button
              className="chat-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              title="Close"
            >
              ✕
            </button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">Say hello to your opponent!</div>
            )}
            {messages.map((m) => {
              const mine = m.playerId === myPlayerId;
              return (
                <div key={m.id} className={"chat-message " + (mine ? 'mine' : 'theirs')}>
                  <div className="chat-meta">
                    <span className="name">{m.playerName+" "}</span>
                    {/* <span className="time"> {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> */}
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
      )}
    </>
  );
};

export default Chat;
