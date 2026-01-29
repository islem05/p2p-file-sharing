import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io.connect("http://localhost:3001");

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const [mySharedFiles, setMySharedFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const peerRef = useRef(null);          
  const incomingFileRef = useRef({});    
  const myFilesRef = useRef([]);         
  const iceCandidatesQueue = useRef([]); 

  useEffect(() => {
    myFilesRef.current = mySharedFiles;
  }, [mySharedFiles]);

  const handleRegister = () => {
    if (username && password) socket.emit('register', { username, password });
  };

  const handleLogin = () => {
    if (username && password) socket.emit('login', { username, password });
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("username");
    if (savedUser) {
      setUsername(savedUser);
      setIsLoggedIn(true);
      socket.emit('login', { username: savedUser, password: "stored-session" });
    }

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    
    socket.on('login_success', (data) => {
      setIsLoggedIn(true);
      localStorage.setItem("username", data.username);
    });

    socket.on('auth_error', (msg) => alert(msg));
    socket.on('auth_success', (msg) => alert(msg));
    socket.on('search_results', (results) => setSearchResults(results));

    // Signalisation WebRTC
    socket.on('offer', async (payload) => {
        const peer = createPeer(payload.callerId); 
        peerRef.current = peer;

        await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        processCandidateQueue(peer);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("answer", { target: payload.callerId, sdp: answer });
    });

    socket.on('answer', (payload) => {
        if (peerRef.current) {
            peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }
    });

    socket.on('ice-candidate', (payload) => {
        if (peerRef.current) {
            try {
                peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) { console.error("Erreur candidat ICE:", e); }
        } else {
            iceCandidatesQueue.current.push(payload.candidate);
        }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('login_success');
      socket.off('auth_error');
      socket.off('auth_success');
      socket.off('search_results');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, []);

  const processCandidateQueue = (peer) => {
      while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift();
          peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
  };

  const createPeer = (targetSocketId) => {
    const peer = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }, 
            { urls: 'stun:global.stun.twilio.com:3478' }
        ] 
    });

    peer.onicecandidate = (e) => {
        if (e.candidate) {
            socket.emit("ice-candidate", { target: targetSocketId, candidate: e.candidate });
        }
    };

    peer.ondatachannel = (e) => {
        setupDataChannel(e.channel);
    };

    return peer;
  };

  const setupDataChannel = (channel) => {
    channel.onopen = () => console.log("Canal de données OUVERT");
    
    channel.onmessage = (e) => {
        const data = e.data;
        if (typeof data === 'string') {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'request_file') {
                   sendFile(msg.fileName, channel);
                } else if (msg.type === 'end_of_file') {
                   saveFile(msg.fileName);
                }
            } catch (err) { console.log("Msg:", data); }
        } else {
            handleIncomingChunk(data);
        }
    };
  };

  const sendFile = async (fileName, channel) => {
    const file = myFilesRef.current.find(f => f.fileName === fileName)?.fileObj;
    if (!file) return;

    const chunkSize = 16 * 1024; 
    let offset = 0;
    const reader = new FileReader();
    
    reader.onload = (e) => {
        channel.send(e.target.result); 
        offset += e.target.result.byteLength;
        if (offset < file.size) {
            readSlice(offset);
        } else {
            channel.send(JSON.stringify({ type: 'end_of_file', fileName: fileName }));
        }
    };
    const readSlice = (o) => {
        const slice = file.slice(o, o + chunkSize);
        reader.readAsArrayBuffer(slice);
    };
    readSlice(0);
  };

  const handleIncomingChunk = (data) => {
    if (!incomingFileRef.current.chunks) incomingFileRef.current.chunks = [];
    incomingFileRef.current.chunks.push(data);
    
    const receivedBytes = incomingFileRef.current.chunks.length * 16384;
    const totalBytes = incomingFileRef.current.totalSize || 1;
    
    const percent = Math.round((receivedBytes / totalBytes) * 100);
    setDownloadProgress(Math.min(percent, 100));
  };

  const handleDownload = async (fileMetadata) => {
    const targetId = fileMetadata.ownerId; 

    incomingFileRef.current = { 
        chunks: [], 
        totalSize: fileMetadata.size
    };
    
    iceCandidatesQueue.current = [];

    const peer = createPeer(targetId);
    peerRef.current = peer;

    const channel = peer.createDataChannel("file-transfer");
    channel.onopen = () => {
        channel.send(JSON.stringify({ type: 'request_file', fileName: fileMetadata.fileName }));
    };

    channel.onmessage = (e) => {
        if (typeof e.data === 'string') {
            const msg = JSON.parse(e.data);
            if (msg.type === 'end_of_file') saveFile(msg.fileName);
        } else {
            handleIncomingChunk(e.data);
        }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("offer", { target: targetId, sdp: offer });
  };

  const saveFile = (fileName) => {
    const blob = new Blob(incomingFileRef.current.chunks);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    
    incomingFileRef.current.chunks = [];
    setDownloadProgress(0);
    URL.revokeObjectURL(url);
  };

  const handleFileSelection = (e) => {
    const newFiles = Array.from(e.target.files).map(file => ({
      fileName: file.name,
      description: "P2P Shared",
      size: file.size,
      fileObj: file 
    }));

    setMySharedFiles(prev => {
        const fullList = [...prev, ...newFiles];
        const metadataOnly = fullList.map(f => ({
            fileName: f.fileName,
            description: f.description,
            size: f.size
        }));
        socket.emit('publish_files', metadataOnly);
        return fullList;
    });
  };

  const removeFile = (idx) => {
      setMySharedFiles(prev => {
          const newList = prev.filter((_, i) => i !== idx);
          const metadataOnly = newList.map(f => ({
            fileName: f.fileName,
            description: f.description,
            size: f.size
          }));
          socket.emit('publish_files', metadataOnly);
          return newList;
      });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {/* HEADER */}
      <div className="bg-gray-800 p-4 shadow flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          Partage P2P <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
        </h1>
        {isLoggedIn && (
            <div className="flex gap-4 items-center">
                <span>{username}</span>
                <button 
                    onClick={() => {
                        localStorage.removeItem("username");
                        window.location.reload();
                    }} 
                    className="text-red-400 text-xs hover:text-red-300 transition"
                >
                    Déconnexion
                </button>
            </div>
        )}
      </div>

      {!isLoggedIn ? (
        <div className="flex items-center justify-center h-[80vh]">
          <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96 border border-gray-700">
            <h2 className="text-2xl font-bold mb-6 text-center">Connexion</h2>
            
            <input 
                type="text" 
                placeholder="Nom d'utilisateur" 
                className="w-full p-3 mb-4 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 outline-none" 
                onChange={(e) => setUsername(e.target.value)} 
            />
            
            <input 
                type="password" 
                placeholder="Mot de passe" 
                className="w-full p-3 mb-6 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 outline-none" 
                onChange={(e) => setPassword(e.target.value)} 
            />
            
            <div className="flex gap-4">
              <button 
                onClick={handleLogin} 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition"
              >
                Se connecter
              </button>
              <button 
                onClick={handleRegister} 
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition"
              >
                S'inscrire
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="container mx-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* GAUCHE : PARTAGER */}
            <div className="bg-gray-800 p-6 rounded border border-gray-700">
                <h2 className="text-xl font-bold text-blue-400 mb-4">1. Partager des fichiers</h2>
                <label className="block w-full cursor-pointer bg-gray-700 p-4 rounded border-2 border-dashed border-gray-500 text-center hover:bg-gray-600 transition">
                    Cliquez pour ajouter des fichiers
                    <input type="file" multiple className="hidden" onChange={handleFileSelection} />
                </label>
                <ul className="mt-4 space-y-2">
                    {mySharedFiles.map((f, i) => (
                        <li key={i} className="flex justify-between bg-gray-900 p-2 rounded items-center">
                            <span className="truncate max-w-[200px]">{f.fileName}</span>
                            <button onClick={() => removeFile(i)} className="text-red-500 hover:text-red-400">✕</button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* DROITE : TÉLÉCHARGER */}
            <div className="bg-gray-800 p-6 rounded border border-gray-700">
                <h2 className="text-xl font-bold text-green-400 mb-4">2. Téléchargement</h2>
                <div className="flex gap-2 mb-4">
                    <input className="flex-1 p-2 bg-gray-900 rounded border border-gray-600 focus:border-green-500 outline-none" placeholder="Rechercher..." onChange={e => setSearchQuery(e.target.value)} />
                    <button className="bg-green-600 hover:bg-green-700 px-4 rounded font-bold transition" onClick={() => socket.emit('search', searchQuery)}>Rechercher</button>
                </div>
                
                <ul className="space-y-4">
                    {searchResults.map((res, i) => (
                        <li key={i} className="bg-gray-900 p-4 rounded border border-gray-700">
                            <div className="flex justify-between font-bold mb-2">
                                <span className="text-green-400">{res.fileName}</span>
                                <span className="text-xs text-gray-500">Propriétaire : {res.username}</span>
                            </div>
                            
                            {downloadProgress > 0 && downloadProgress < 100 ? (
                                <div className="w-full bg-gray-700 rounded-full h-6 mt-2 overflow-hidden relative">
                                    <div 
                                        className="bg-blue-500 h-full transition-all duration-200 ease-out"
                                        style={{ width: `${downloadProgress}%` }}
                                    ></div>
                                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                                        {downloadProgress}%
                                    </span>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => handleDownload(res)}
                                    className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded text-sm font-bold transition mt-2"
                                >
                                    Télécharger (P2P)
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;