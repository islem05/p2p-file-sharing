import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io.connect("http://localhost:3000");

function App() {
  // --- STATE MANAGEMENT ---
  const [isConnected, setIsConnected] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // File Sharing State
  const [mySharedFiles, setMySharedFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // --- 1. PERSISTENCE CHECK (Fix for Refresh Issue) ---
  useEffect(() => {
    const savedUser = localStorage.getItem("username");
    if (savedUser) {
      setUsername(savedUser);
      setIsLoggedIn(true);
      // Re-authenticate socket connection
      socket.emit('login', { username: savedUser, password: "stored-session" }); 
    }
    
    // Listen for auth errors specifically to clear storage
    // If server restarted and forgot user, we log them out locally too
    const handleAuthError = () => {
        localStorage.removeItem("username");
        setIsLoggedIn(false);
    };

    socket.on('auth_error', handleAuthError);

    return () => {
        socket.off('auth_error', handleAuthError);
    };
  }, []);

  // --- SOCKET EVENTS ---
  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('login_success', (data) => {
      setIsLoggedIn(true);
      // Save to local storage on successful login
      localStorage.setItem("username", data.username); 
    });

    // We keep the alert here for user feedback
    socket.on('auth_error', (msg) => {
        if (msg !== "User not found") alert(msg); // Optional: filter generic errors
    });

    socket.on('auth_success', (msg) => {
        // specific success logic if needed
    });

    // Listen for search results from the server
    socket.on('search_results', (results) => {
      setSearchResults(results);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('login_success');
      socket.off('auth_error');
      socket.off('search_results');
    };
  }, []);

  // --- ACTIONS ---
  const handleRegister = () => {
    if (username && password) socket.emit('register', { username, password });
  };

  const handleLogin = () => {
    if (username && password) socket.emit('login', { username, password });
  };

  const handleLogout = () => {
    localStorage.removeItem("username");
    setIsLoggedIn(false);
    setUsername("");
    setMySharedFiles([]); // Clear files on logout
    window.location.reload(); // Clean refresh
  };

  // --- 2. FILE SELECTION (Stacking Fix) ---
  const handleFileSelection = (e) => {
    const newFiles = Array.from(e.target.files).map(file => ({
      fileName: file.name,
      description: "Shared via P2P", 
      size: file.size,
      fileObj: file // Keep the actual file object for later transfer
    }));

    setMySharedFiles((prevFiles) => {
        const updatedList = [...prevFiles, ...newFiles];
        // Notify server of the NEW total list
        socket.emit('publish_files', updatedList);
        return updatedList;
    });
  };

  // --- 3. REMOVE FILE (Removal Fix) ---
  const removeFile = (indexToRemove) => {
    setMySharedFiles((prevFiles) => {
        const updatedList = prevFiles.filter((_, index) => index !== indexToRemove);
        // Notify server of the updated list
        socket.emit('publish_files', updatedList);
        return updatedList;
    });
  };

  const handleSearch = () => {
    if (searchQuery) {
      socket.emit('search', searchQuery);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      
      {/* HEADER */}
      <div className="bg-gray-800 p-4 shadow flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          P2P Share 
          <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? "Connected" : "Disconnected"}></span>
        </h1>
        {isLoggedIn && (
            <div className="flex items-center gap-4">
                <span className="text-gray-400">Logged in as: <span className="text-white font-semibold">{username}</span></span>
                <button onClick={handleLogout} className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1 rounded transition">Logout</button>
            </div>
        )}
      </div>

      {/* LOGIN SCREEN */}
      {!isLoggedIn ? (
        <div className="flex items-center justify-center h-[80vh]">
          <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96 border border-gray-700">
            <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
            <input type="text" placeholder="Username" className="w-full p-3 mb-4 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 outline-none" onChange={(e) => setUsername(e.target.value)} />
            <input type="password" placeholder="Password" className="w-full p-3 mb-6 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 outline-none" onChange={(e) => setPassword(e.target.value)} />
            <div className="flex gap-4">
              <button onClick={handleLogin} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition">Login</button>
              <button onClick={handleRegister} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition">Register</button>
            </div>
          </div>
        </div>
      ) : (
        
        /* DASHBOARD */
        <div className="container mx-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN: MY FILES */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-4 text-blue-400">1. Share Your Files</h2>
            <p className="text-gray-400 mb-4 text-sm">Select files to make them discoverable by other peers.</p>
            
            <label className="block w-full cursor-pointer bg-gray-700 hover:bg-gray-600 text-center p-4 rounded-lg border-2 border-dashed border-gray-500 transition">
              <span className="text-gray-300">Click to Add Files</span>
              <input type="file" multiple className="hidden" onChange={handleFileSelection} />
            </label>

            {/* --- FIXED FILE LIST UI --- */}
            {mySharedFiles.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Currently Sharing:</h3>
                <ul className="space-y-2">
                  {mySharedFiles.map((file, idx) => (
                    <li key={idx} className="bg-gray-900 p-3 rounded flex justify-between items-center text-sm border border-gray-800">
                      <div className="flex flex-col">
                          <span className="font-medium">{file.fileName}</span>
                          <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <button 
                        onClick={() => removeFile(idx)}
                        className="text-gray-500 hover:text-red-500 transition p-2"
                        title="Stop Sharing"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
               // NEW EMPTY STATE
               <div className="mt-6 text-center border-t border-gray-700 pt-4">
                 <p className="text-gray-500 text-sm italic">No files selected.</p>
                 <p className="text-xs text-gray-600 mt-1">(Files are cleared on refresh)</p>
               </div>
            )}
            
          </div>

          {/* RIGHT COLUMN: SEARCH */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-4 text-green-400">2. Search Network</h2>
            <div className="flex gap-2 mb-6">
              <input 
                type="text" 
                placeholder="Search by filename..." 
                className="flex-1 p-3 bg-gray-900 rounded border border-gray-700 focus:border-green-500 outline-none"
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                onClick={handleSearch}
                className="bg-green-600 hover:bg-green-700 px-6 rounded font-bold transition"
              >
                Search
              </button>
            </div>

            {/* SEARCH RESULTS LIST */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Results:</h3>
              {searchResults.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No files found.</p>
              ) : (
                <ul className="space-y-3">
                  {searchResults.map((result, idx) => (
                    <li key={idx} className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-green-400">{result.files[0].fileName}</span>
                        <span className="text-xs text-gray-500">User: {result.username}</span>
                      </div>
                      <p className="text-xs text-gray-400">{result.files[0].description}</p>
                      <button className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-xs py-2 rounded transition">
                        Download (P2P)
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default App;