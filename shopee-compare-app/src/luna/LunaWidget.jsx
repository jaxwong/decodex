import React, { useState } from 'react';

// Host-independent UI: receives products as props, never reads Shopee cart/router context.
// This is an explicitly local prototype until Builder B supplies a backend contract.
export default function LunaWidget({ products = [], onClose, apiBaseUrl = '' }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Hi! Tell me what matters most: price, weight, power, or capacity.' }]);
  const [input, setInput] = useState('');
  const [priorities, setPriorities] = useState([]);
  const options = ['price', 'weight', 'power', 'capacity'];
  function send(e) {
    e.preventDefault();
    const message = input.trim();
    if (!message) return;
    setInput('');
    const found = options.filter(option => message.toLowerCase().includes(option));
    setPriorities(old => [...new Set([...old, ...found])]);
    setMessages(old => [...old, { role: 'user', text: message }, {
      role: 'assistant', text: 'Prototype only: I recorded your preference. AI ranking and evidence-backed answers will be connected to Builder B’s API; no recommendation has been generated.'
    }]);
  }
  return <section aria-label="Luna shopping assistant" className="bg-white rounded-lg shadow-sm border border-orange-100 p-4 my-4 text-gray-800">
    <header className="flex items-center justify-between mb-3"><div><h2 className="text-lg font-semibold text-orange-600">✦ Luna</h2><p className="text-xs text-gray-500">Shopping assistant · local UI prototype</p></div>{onClose && <button type="button" onClick={onClose} aria-label="Close Luna" className="text-sm text-gray-500 hover:text-orange-600">Close ×</button>}</header>
    <p className="text-sm mb-2">Comparing {products.length} selected product{products.length === 1 ? '' : 's'}</p>
    <div className="flex flex-wrap gap-2 mb-3">{products.map((product, index) => <span key={product.id ?? index} className="text-xs bg-orange-50 border border-orange-100 rounded px-2 py-1">{product.name ?? product.title ?? `Product ${index + 1}`}</span>)}</div>
    {priorities.length > 0 && <p className="text-xs text-orange-700 mb-2">Preferences mentioned: {priorities.join(', ')}</p>}
    <div role="log" aria-live="polite" className="max-h-56 overflow-y-auto space-y-2 bg-gray-50 rounded p-3 mb-3">{messages.map((message, index) => <p key={index} className={`text-sm ${message.role === 'user' ? 'text-right text-orange-700' : 'text-gray-700'}`}><strong>{message.role === 'user' ? 'You' : 'Luna'}:</strong> {message.text}</p>)}</div>
    <form onSubmit={send} className="flex gap-2"><input aria-label="Message Luna" className="border rounded px-3 py-2 flex-1 min-w-0 text-sm" value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. prioritize weight and price"/><button type="submit" disabled={!input.trim()} className="bg-orange-600 disabled:opacity-50 text-white px-4 rounded text-sm">Send</button></form>
    <p className="text-xs text-gray-400 mt-3">{apiBaseUrl ? 'Backend URL configured; API integration pending.' : 'No backend connected. No AI calls or rankings are made.'}</p>
  </section>;
}
