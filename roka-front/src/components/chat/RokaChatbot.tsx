import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
import './RokaChatbot.css';

interface Message {
  id: string;
  text: string;
  role: 'bot' | 'user';
  time: string;
}

const QUICK_ACTIONS_BY_ROLE: Record<number, Array<{ label: string; query: string }>> = {
  1: [ // Admin — todas las acciones
    { label: '📋 Solicitudes pendientes', query: '¿Cuántas solicitudes hay pendientes?' },
    { label: '💲 Gasto total OC', query: '¿Cuál es el gasto total en órdenes de compra?' },
    { label: '📊 Proyectos activos', query: 'Muéstrame el resumen de proyectos activos' },
    { label: '⏱ Tiempo conversión', query: '¿Cuál es el tiempo de conversión promedio?' },
    { label: '🚨 Alertas de presupuesto', query: '¿Hay alertas de presupuesto activas?' },
    { label: '📦 Últimas OC', query: '¿Cuáles son las últimas órdenes de compra?' },
  ],
  2: [ // Director de Obra — operaciones + proyectos
    { label: '📋 Solicitudes pendientes', query: '¿Cuántas solicitudes hay pendientes?' },
    { label: '💲 Gasto por proyecto', query: '¿Cuál es el gasto por proyecto?' },
    { label: '📊 Proyectos activos', query: 'Muéstrame el resumen de proyectos activos' },
    { label: '⏱ Tiempo conversión', query: '¿Cuál es el tiempo de conversión promedio?' },
    { label: '🏗 Estado de presupuestos', query: '¿Cómo va el estado de los presupuestos?' },
    { label: '🤝 Proveedores frecuentes', query: '¿Quiénes son los proveedores registrados?' },
  ],
  3: [ // Adquisiciones — compras + proveedores
    { label: '📋 Solicitudes pendientes', query: '¿Cuántas solicitudes hay pendientes?' },
    { label: '🤝 Proveedores disponibles', query: '¿Qué proveedores están registrados?' },
    { label: '📄 Cotizaciones por responder', query: '¿Hay solicitudes de cotización enviadas?' },
    { label: '💲 Gasto total OC', query: '¿Cuál es el gasto total en órdenes de compra?' },
    { label: '📦 Últimas OC', query: '¿Cuáles son las últimas órdenes de compra?' },
    { label: '⏱ Tiempo conversión', query: '¿Cuál es el tiempo de conversión promedio?' },
  ],
  4: [ // Bodega — materiales + entregas
    { label: '📦 Materiales en catálogo', query: '¿Cuántos materiales hay en el catálogo?' },
    { label: '📋 Solicitudes con fecha', query: '¿Cuáles son las solicitudes con fecha próxima?' },
    { label: '📄 Últimas órdenes de compra', query: '¿Cuáles son las últimas OC registradas?' },
    { label: '🚚 Estado de entregas', query: '¿Cómo están las entregas de las OC?' },
  ],
};

const API_URL = import.meta.env.VITE_API_URL + '/roka/api';

export function RokaChatbot() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  const token = localStorage.getItem('roka_token');
  const rolId = user?.rol_id ?? 0;
  const quickActions = QUICK_ACTIONS_BY_ROLE[rolId] || QUICK_ACTIONS_BY_ROLE[1];

  // Solo inicializar una vez al cargar el componente
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const firstName = user?.nombre?.split(' ')[0] || 'Usuario';
    setMessages([
      {
        id: 'initial',
        role: 'bot',
        text: `¡Buen día, ${firstName}! Soy **RokAI**, su asistente virtual. Puedo ayudarle con información sobre solicitudes, solicitudes de cotización, órdenes de compra y estadísticas del sistema. ¿En qué le puedo asistir hoy?`,
        time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (hasUnread) setHasUnread(false);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_URL}/chat/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) throw new Error('Error en la respuesta de IA');

      const data = await response.json();

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: data.response,
        time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: 'Lo siento, no puedo procesar su consulta en este momento. Por favor, intente más tarde.',
        time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputText);
    }
  };

  const formatMessage = (text: string) => {
    let formatted = text;

    // 1. Detect and format tables (more resilient regex)
    const tableRegex = /(?:^|\n)\|([^\n]+)\|(\r?\n)\|[\s|:-]+\|(\r?\n)((?:\|[^\n]+\|(?:\r?\n)?)+)/gm;
    formatted = formatted.replace(tableRegex, (match) => {
      const lines = match.trim().split('\n').filter(l => l.includes('|'));
      if (lines.length < 3) return match;

      const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
      const rows = lines.slice(2).map(row =>
        row.split('|').map(c => c.trim()).filter(c => c !== '')
      );

      return `
        <div class="chat-table-wrapper">
          <table class="chat-table">
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
    });

    // 2. Headings (###)
    formatted = formatted.replace(/^### (.*$)/gim, '<h3 class="chat-h3">$1</h3>');

    // 3. Lists and Cards
    // Detect numbered list with " - " (often used for objects)
    const cardListRegex = /^(\d+)\.\s+\*\*(.*?)\*\*\s+–\s+(.*$)/gim;
    if (cardListRegex.test(formatted)) {
      formatted = formatted.replace(cardListRegex, `
        <div class="chat-item-card">
          <div class="card-number">$1</div>
          <div class="card-content">
            <div class="card-title">$2</div>
            <div class="card-details">$3</div>
          </div>
        </div>
      `);
    } else {
      // Normal lists
      formatted = formatted.replace(/^\s*-\s+(.*$)/gim, '<li class="chat-li">$1</li>');
      formatted = formatted.replace(/(<li class="chat-li">.*<\/li>(\r?\n?))+/g, '<ul class="chat-ul">$&</ul>');
    }

    // 4. Bold (**text**) and Italics (*text*)
    formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

    return formatted;
  };

  return (
    <div className="roka-chat-container roka-chat-wrapper">
      <button
        id="chat-fab"
        onClick={toggleChat}
        title="RokAI Assistant"
        className={isOpen ? 'open' : ''}
      >
        {!isOpen && hasUnread && <div className="fab-badge">1</div>}
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        )}
      </button>

      <div id="chat-panel" className={isOpen ? 'visible' : ''}>
        <div className="chat-header">
          <div className="chat-header-top">
            <div className="chat-brand">
              <div className="chat-avatar">R</div>
              <div className="chat-brand-text">
                <strong>RokAI</strong>
                <span>Asistente de Roka Construcciones</span>
              </div>
            </div>
            <button className="chat-close" onClick={() => setIsOpen(false)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="chat-status">
            <div className="status-dot"></div>
            <span>En línea · Responde al instante</span>
          </div>
        </div>

        <div className="chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`msg ${msg.role}`}>
              <div className={`msg-avatar ${msg.role === 'user' ? 'user-av' : ''}`}>
                {msg.role === 'bot' ? 'R' : (user?.nombre?.[0] || 'U')}
              </div>
              <div className="msg-content">
                <div
                  className="msg-bubble"
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                />
                <div className="msg-time">{msg.time}</div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="msg bot">
              <div className="msg-avatar">R</div>
              <div className="msg-bubble typing-bubble">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {!isTyping && messages.length < 5 && (
          <div className="quick-actions">
            {quickActions.map(action => (
              <div key={action.label} className="quick-chip" onClick={() => handleSend(action.query)}>
                {action.label}
              </div>
            ))}
          </div>
        )}

        <div className="chat-input-wrap">
          <textarea
            className="chat-input"
            placeholder="Escriba su consulta..."
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          ></textarea>
          <button
            className="send-btn"
            onClick={() => handleSend(inputText)}
            disabled={!inputText.trim() || isTyping}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
