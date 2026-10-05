'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const zones = [
  ['Wuse', 'z1', 'Markets • Food • Offices'],
  ['Maitama', 'z2', 'Luxury • Hotels • Estates'],
  ['Jabi', 'z3', 'Lake • Mall • Entertainment'],
  ['Garki', 'z4', 'Business • Hospitals'],
  ['Gwarinpa', 'z5', 'Homes • Shops • Food'],
  ['Asokoro', 'z6', 'Estates • Government'],
] as const;

type Citizen = {
  id: string;
  username: string;
  avatar: string;
  district: string;
  x: number;
  y: number;
};

type ChatMessage = {
  username: string;
  message: string;
};

export default function Home() {
  const [play, setPlay] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🧑🏾');
  const [started, setStarted] = useState(false);

  const [zone, setZone] = useState('Wuse');
  const [citizenId, setCitizenId] = useState<string | null>(null);

  const [wallet, setWallet] = useState(25000);
  const [job, setJob] = useState<string | null>(null);

  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [connected, setConnected] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  function connectCitizen(citizen: Citizen) {
    socketRef.current?.disconnect();

    const socket = io(window.location.origin, {
  path: '/socket.io/',
  transports: ['polling', 'websocket'],
  upgrade: true,
  reconnection: true,
  autoConnect: false,
});

socket.on('connect_error', (error) => {
  console.error(
    '[abuja-live] connection error:',
    error.message
  );

  setConnected(false);
});

socket.connect();

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);

      socket.emit('join-city', citizen);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('presence', (list: Citizen[]) => {
      setCitizens(list);
    });

    socket.on('chat', (msg: ChatMessage) => {
      setChat((items) => [
        ...items.slice(-49),
        msg,
      ]);
    });
  }

  async function enterCity() {
    if (!name.trim()) return;

    try {
      const response = await fetch('/api/citizens', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          username: name,
          avatar,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(
          result.error ||
          'Could not create citizen'
        );

        return;
      }

      const citizen: Citizen = {
        id: result.citizen.id,
        username: result.citizen.username,
        avatar: result.citizen.avatar,
        district: result.citizen.district || 'Wuse',
        x: 50,
        y: 50,
      };

      setName(citizen.username);
      setCitizenId(citizen.id);
      setWallet(result.citizen.wallet || 25000);
      setJob(result.citizen.job || null);
      setZone(citizen.district);
      setStarted(true);

      connectCitizen(citizen);
    } catch {
      alert('Unable to connect to AbujaLifestyle.');
    }
  }

  async function findJob() {
    if (!citizenId) {
      alert('Enter the city first.');
      return;
    }

    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        citizenId,
        jobId: 'tech',
      }),
    });

    const result = await response.json();

    if (response.ok) {
      setJob(result.job.title);
    }
  }

  function moveTo(
    clientX: number,
    clientY: number
  ) {
    const rect =
      mapRef.current?.getBoundingClientRect();

    if (
      !rect ||
      !socketRef.current?.connected ||
      !citizenId
    ) {
      return;
    }

    const x = Math.max(
      4,
      Math.min(
        96,
        ((clientX - rect.left) /
          rect.width) *
          100
      )
    );

    const y = Math.max(
      4,
      Math.min(
        96,
        ((clientY - rect.top) /
          rect.height) *
          100
      )
    );

    socketRef.current.emit('move', {
      x,
      y,
      district: zone,
    });
  }

  function changeZone(nextZone: string) {
    setZone(nextZone);

    socketRef.current?.emit(
      'district',
      {
        district: nextZone,
      }
    );
  }

  function sendChat() {
    const text = message.trim();

    if (
      !text ||
      !socketRef.current?.connected
    ) {
      return;
    }

    socketRef.current.emit(
      'chat',
      {
        message: text,
      }
    );

    setMessage('');
  }

  const visibleCitizens =
    citizens.filter(
      (citizen) =>
        citizen.district === zone
    );

  if (play && !started) {
    return (
      <div className="modalwrap">
        <div className="modal">
          <div className="eyebrow">
            AbujaLifestyle beta
          </div>

          <h2>Create your citizen</h2>

          <p style={{ color: 'var(--muted)' }}>
            Choose a name and step into the
            city.
          </p>

          <input
            className="field"
            placeholder="Username"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
          />

          <div className="choice">
            {[
              '🧑🏾',
              '👩🏾',
              '🧔🏾',
              '👩🏿',
              '🧑🏿',
              '🧔🏿',
            ].map((item) => (
              <button
                className={
                  avatar === item
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setAvatar(item)
                }
                key={item}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="actions">
            <button
              className="btn"
              onClick={() =>
                setPlay(false)
              }
            >
              Cancel
            </button>

            <button
              className="btn primary"
              onClick={enterCity}
            >
              Enter Abuja →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <nav className="nav">
        <div className="logo">
          ABUJA<span>LIFE</span>
        </div>

        <div className="navlinks">
          <span>Explore</span>
          <span>How it works</span>
          <span>Businesses</span>
          <span>About</span>
        </div>

        <button
          className="btn primary"
          onClick={() => setPlay(true)}
        >
          Play now
        </button>
      </nav>

      {!started ? (
        <>
          <section className="hero">
            <div>
              <div className="eyebrow">
                A living city, online
              </div>

              <h1>
                Live your
                <br />
                Abuja story.
              </h1>

              <p>
                Build a life in a virtual
                Abuja. Find a home, get a
                job, meet people, explore the
                city and make your own story.
              </p>

              <div className="actions">
                <button
                  className="btn primary"
                  onClick={() =>
                    setPlay(true)
                  }
                >
                  Create your citizen →
                </button>

                <button className="btn">
                  Explore the city
                </button>
              </div>
            </div>

            <div className="city-preview">
              <span className="pin p1">
                Wuse
              </span>

              <span className="pin p2">
                Maitama
              </span>

              <span className="pin p3">
                Jabi
              </span>

              <span className="pin p4">
                Garki
              </span>

              <div className="preview-card">
                <strong>
                  🌆 Abuja is alive
                </strong>

                <small>
                  Join citizens exploring
                  the city right now.
                </small>
              </div>
            </div>
          </section>

          <section className="stats">
            <div className="stat">
              <b>6</b>
              <span>districts in V1</span>
            </div>

            <div className="stat">
              <b>24/7</b>
              <span>persistent city</span>
            </div>

            <div className="stat">
              <b>∞</b>
              <span>stories to create</span>
            </div>
          </section>
        </>
      ) : (
        <section className="game">
          <div className="gamehead">
            <div>
              <div className="eyebrow">
                Citizen mode ·{' '}
                {connected
                  ? '🟢 Live'
                  : '🟠 Connecting'}
              </div>

              <h2>
                Welcome, {name} {avatar}
              </h2>

              <div
                style={{
                  color: 'var(--muted)',
                }}
              >
                You are in {zone}. Tap the
                map to move. Other citizens
                appear live.
              </div>
            </div>

            <button
              className="btn"
              onClick={() => {
                socketRef.current?.disconnect();
                setStarted(false);
                setPlay(false);
              }}
            >
              Exit city
            </button>
          </div>

          <div className="gamegrid">
            <div
              ref={mapRef}
              className="map"
              onClick={(event) =>
                moveTo(
                  event.clientX,
                  event.clientY
                )
              }
            >
              <div className="road"></div>
              <div className="road r2"></div>

              {zones.map(
                ([name, className, description]) => (
                  <button
                    key={name}
                    className={
                      'zone ' + className
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      changeZone(name);
                    }}
                  >
                    <b>{name}</b>
                    <small>
                      {description}
                    </small>
                  </button>
                )
              )}

              {visibleCitizens.map(
                (citizen) => (
                  <div
                    key={citizen.id}
                    className={
                      'player ' +
                      (citizen.id ===
                      citizenId
                        ? 'me'
                        : '')
                    }
                    style={{
                      left:
                        citizen.x + '%',
                      top:
                        citizen.y + '%',
                    }}
                    title={citizen.username}
                  >
                    <span>
                      {citizen.avatar}
                    </span>

                    <small>
                      {citizen.username}
                    </small>
                  </div>
                )
              )}
            </div>

            <aside className="side">
              <div className="profile">
                <small>Wallet</small>

                <div className="money">
                  ₦
                  {wallet.toLocaleString()}
                </div>

                <small>
                  🏠 Starter apartment · 💼{' '}
                  {job ||
                    'Looking for work'}
                </small>
              </div>

              <h3>
                Online in {zone} ·{' '}
                {visibleCitizens.length}
              </h3>

              <div className="players">
                {visibleCitizens.map(
                  (citizen) => (
                    <div
                      className="online"
                      key={citizen.id}
                    >
                      <span>
                        <i className="dot"></i>
                        {citizen.avatar}{' '}
                        {citizen.username}
                        {citizen.id ===
                        citizenId
                          ? ' (you)'
                          : ''}
                      </span>

                      <small>
                        live
                      </small>
                    </div>
                  )
                )}

                {!visibleCitizens.length && (
                  <div
                    style={{
                      color:
                        'var(--muted)',
                    }}
                  >
                    Nobody here yet.
                  </div>
                )}
              </div>

              <div className="actions">
                <button
                  className="btn primary"
                  style={{
                    width: '100%',
                  }}
                  onClick={findJob}
                >
                  {job
                    ? 'Change job'
                    : 'Find a job'}
                </button>

                <button
                  className="btn"
                  style={{
                    width: '100%',
                  }}
                  onClick={() =>
                    setChatOpen(
                      (value) => !value
                    )
                  }
                >
                  💬{' '}
                  {chatOpen
                    ? 'Close chat'
                    : 'Open chat'}
                </button>
              </div>

              {chatOpen && (
                <div className="chatbox">
                  <div className="chatlog">
                    {chat.map(
                      (item, index) => (
                        <div key={index}>
                          <b>
                            {item.username}:
                          </b>{' '}
                          {item.message}
                        </div>
                      )
                    )}

                    {!chat.length && (
                      <small>
                        No messages yet.
                        Say hello.
                      </small>
                    )}
                  </div>

                  <div className="chatrow">
                    <input
                      className="field"
                      value={message}
                      onChange={(event) =>
                        setMessage(
                          event.target.value
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key ===
                          'Enter'
                        ) {
                          sendChat();
                        }
                      }}
                      placeholder="Message..."
                    />

                    <button
                      className="btn primary"
                      onClick={sendChat}
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}
