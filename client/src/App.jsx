import { useState, useEffect } from 'react';
import io from 'socket.io-client';

// Connect to your Node server running on port 3000
const socket = io.connect("http://localhost:3000");

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('login_success', (data) => {
      alert(`Welcome ${data.username}!`);
      setIsLoggedIn(true);
    });

    socket.on('auth_error', (msg) => alert(msg));
    socket.on('auth_success', (msg) => alert(msg));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('login_success');
      socket.off('auth_error');
    };
  }, []);

  const handleRegister = () => {
    if (username && password) socket.emit('register', { username, password });
  };

  const handleLogin = () => {
    if (username && password) socket.emit('login', { username, password });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      {!isLoggedIn ? (
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">P2P Share</h1>
            {/* CONNECTION DOT */}
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
          <input type="text" placeholder="Username" className="w-full p-2 mb-4 bg-gray-700 rounded border border-gray-600 text-white" onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-2 mb-6 bg-gray-700 rounded border border-gray-600 text-white" onChange={(e) => setPassword(e.target.value)} />
          <div className="flex gap-4">
            <button onClick={handleLogin} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Login</button>
            <button onClick={handleRegister} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Register</button>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome, {username}!</h1>
          <p className="text-gray-400">Phase 2 Complete. Ready for File Sharing.</p>
        </div>
      )}
    </div>
  );
}

export default App;