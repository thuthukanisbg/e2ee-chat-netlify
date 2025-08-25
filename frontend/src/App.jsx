import React, { useEffect, useState } from 'react';
import netlifyIdentity from 'netlify-identity-widget';
import { api } from './api';
import {
  initSodium, generateLongTermKeys, getLongTermKeys, exportPublicKeyB64,
  encryptForRecipientB64, decryptFromSenderB64, storeEncryptedPrivateKeyBlob
} from './crypto';

function useIdentity() {
  const [user, setUser] = useState(netlifyIdentity.currentUser());
  useEffect(() => {
    netlifyIdentity.on('login', setUser);
    netlifyIdentity.on('logout', () => setUser(null));
    netlifyIdentity.on('init', setUser);
    netlifyIdentity.init();
    return () => {
      netlifyIdentity.off('login', setUser);
      netlifyIdentity.off('logout');
      netlifyIdentity.off('init');
    }
  }, []);
  return user;
}

function Login() {
  return (
    <div style={{display:'grid',placeItems:'center',height:'100vh',gap:16}}>
      <h1>E2EE Chat</h1>
      <button onClick={() => netlifyIdentity.open()}>Log in / Sign up</button>
      <p style={{opacity:.7}}>Netlify Identity modal will appear.</p>
    </div>
  );
}

export default function App() {
  const user = useIdentity();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [ready, setReady] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [savingBlob, setSavingBlob] = useState(false);

  useEffect(() => { initSodium().then(() => setReady(true)); }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const kp = await getLongTermKeys();
      let publicKeyB64 = await exportPublicKeyB64();
      if (!kp) {
        await generateLongTermKeys();
        publicKeyB64 = await exportPublicKeyB64();
      }
      setHasKey(true);
      try {
        await api('register-key', { method: 'POST', body: JSON.stringify({ publicKey: publicKeyB64 }) });
      } catch (e) { console.error('register-key failed', e); }
      await refreshUsers();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function refreshUsers() {
    try {
      const data = await api('get-users');
      setUsers(data.filter(u => u.user_id !== user?.id));
    } catch (e) { console.error(e); }
  }

  async function refreshMessages(partnerId) {
    try {
      const data = await api(`get-messages?with=${partnerId}`);
      setMessages(data);
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    if (!selected?.user_id) return;
    refreshMessages(selected.user_id);
    const timer = setInterval(() => refreshMessages(selected.user_id), 4000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.user_id]);

  async function sendMessage() {
    if (!text.trim() || !selected) return;
    const payload = await encryptForRecipientB64(selected.public_key, text.trim());
    await api('send-message', { method: 'POST', body: JSON.stringify({ recipientId: selected.user_id, ...payload }) });
    setText('');
    await refreshMessages(selected.user_id);
  }

  async function saveEncryptedBlob() {
    try {
      setSavingBlob(true);
      const pass = prompt('Set a passphrase to encrypt your private key (do not forget it!)');
      if (!pass) return;
      const blob = await storeEncryptedPrivateKeyBlob(pass);
      await api('register-key', { method: 'POST', body: JSON.stringify({ publicKey: await exportPublicKeyB64(), encryptedPrivateKey: btoa(JSON.stringify(blob)) }) });
      alert('Encrypted private key blob saved on server (still E2EE).');
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setSavingBlob(false);
    }
  }

  if (!user) return <Login />;
  if (!ready || !hasKey) return <div style={{padding:24}}>Initializing crypto…</div>;

  return (
    <div style={{display:'grid', gridTemplateColumns:'260px 1fr', minHeight:'100vh'}}>
      <aside style={{borderRight:'1px solid #eee', padding:16, display:'flex', flexDirection:'column', gap:12}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <strong>Users</strong>
          <button onClick={() => netlifyIdentity.logout()}>Logout</button>
        </div>
        <button onClick={refreshUsers}>Refresh</button>
        <div style={{fontSize:12, opacity:.7}}>Logged in as <b>{user.email}</b></div>
        <button onClick={saveEncryptedBlob} disabled={savingBlob}>{savingBlob ? 'Saving…' : 'Encrypt & Save Private Key'}</button>
        <div style={{overflowY:'auto', flex:1, border:'1px solid #eee', borderRadius:8}}>
          {users.map(u => (
            <div key={u.user_id}
              onClick={() => setSelected(u)}
              style={{padding:12, cursor:'pointer', background: selected?.user_id===u.user_id ? '#f5f5f5' : 'white', borderBottom:'1px solid #eee'}}>
              <div style={{fontWeight:600}}>{u.email}</div>
              <div style={{fontSize:12, opacity:.7}}>{u.public_key ? '🔐 Key present' : '⚠️ No key yet'}</div>
            </div>
          ))}
          {users.length === 0 && <div style={{padding:12, fontSize:12, opacity:.7}}>No other users yet.</div>}
        </div>
      </aside>
      <main style={{display:'flex', flexDirection:'column', height:'100vh'}}>
        <header style={{padding:16, borderBottom:'1px solid #eee'}}>
          <div style={{fontWeight:700}}>Chat</div>
          <div style={{fontSize:12, opacity:.7}}>{selected ? `Chatting with ${selected.email}` : 'Pick a user on the left.'}</div>
        </header>
        <section style={{flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:8}}>
          {!selected && <div style={{opacity:.6}}>Select a user to start messaging.</div>}
          {selected && messages.map(m => <MessageBubble key={m.id} mine={m.sender_id === user.id} m={m} />)}
        </section>
        <footer style={{padding:16, borderTop:'1px solid #eee', display:'flex', gap:8}}>
          <input value={text} onChange={e=>setText(e.target.value)} placeholder="Type a message…"
                 onKeyDown={e=>{ if (e.key==='Enter') sendMessage(); }}
                 style={{flex:1, padding:12, border:'1px solid #ddd', borderRadius:8}} />
          <button onClick={sendMessage}>Send</button>
        </footer>
      </main>
    </div>
  );
}

function MessageBubble({ mine, m }) {
  const [plain, setPlain] = React.useState('…');
  React.useEffect(() => {
    (async () => {
      try {
        const p = await decryptFromSenderB64(m.ephemeral_public_key, m.nonce, m.ciphertext);
        setPlain(p);
      } catch (e) {
        setPlain('[Unable to decrypt]');
      }
    })();
  }, [m.id]);
  return (
    <div style={{
      alignSelf: mine ? 'flex-end' : 'flex-start',
      maxWidth:'70%',
      padding:12,
      borderRadius:12,
      background: mine ? '#DCF8C6' : '#F1F0F0'
    }}>
      <div style={{whiteSpace:'pre-wrap'}}>{plain}</div>
      <div style={{fontSize:10, opacity:.6, marginTop:4}}>{new Date(m.created_at).toLocaleString()}</div>
    </div>
  );
}
