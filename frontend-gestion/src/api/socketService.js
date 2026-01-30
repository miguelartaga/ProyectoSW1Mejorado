class WebSocketService {
  static instance = null;
  callbacks = {}; // Almacena funciones para actualizar la UI por tipo

  static getInstance() {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  constructor() {
    this.socketRef = null;
  }

  // Iniciar conexión
  connect(roomName) {
    // 1. Recuperamos el token del almacenamiento local
    const token = localStorage.getItem('authToken'); 

    if (!token) {
      console.error("❌ No hay token de autenticación. No se puede conectar al chat.");
      return;
    }
    
    // --- LÓGICA DE URL DINÁMICA ---
    
    // Usamos VITE_WS_URL que se definirá en el archivo .env o .env.production.
    // Fallback: 'ws://localhost:8000' para desarrollo.
    const baseProtocol = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    
    // 2. Construimos la ruta completa, enviando el token como parámetro
    const path = `${baseProtocol}/ws/chat/${roomName}/?token=${token}`;
    
    // CRÍTICO: Aseguramos que el protocolo sea WSS si la URL base es HTTPS
    let finalPath = path;
    if (baseProtocol.startsWith('https:')) {
      finalPath = path.replace('https:', 'wss:');
    } else if (baseProtocol.startsWith('http:')) {
      finalPath = path.replace('http:', 'ws:');
    }

    this.socketRef = new WebSocket(finalPath);
    // ----------------------------

    // ... (el resto del codigo onopen, onmessage, etc. sigue igual)
    this.socketRef.onopen = () => { console.log('✅ WebSocket conectado correctamente'); };
    this.socketRef.onmessage = (e) => { this.socketNewMessage(e.data); };
    this.socketRef.onerror = (e) => { console.error('❌ Error de WebSocket:', e); };
    this.socketRef.onclose = () => { console.log('🔌 WebSocket desconectado'); };
  }

  // Desconectar
  disconnect() {
    if (this.socketRef) {
      this.socketRef.close();
    }
  }

  // Enviar mensaje (JSON)
  sendMessage(data) {
    if (this.socketRef && this.socketRef.readyState === WebSocket.OPEN) {
      this.socketRef.send(JSON.stringify(data));
    } else {
      console.warn('⚠️ No se pudo enviar: WebSocket no conectado');
    }
  }

  // --- Gestión de Callbacks ---
  
  addCallbacks(newCallbacks) {
    if (typeof newCallbacks === 'function') {
      this.callbacks['message'] = newCallbacks;
      return;
    }
    this.callbacks = { ...this.callbacks, ...newCallbacks };
  }

  socketNewMessage(data) {
    const parsedData = JSON.parse(data);
    const msgType = parsedData.type || 'message';
    const callback = this.callbacks[msgType] || this.callbacks['message'] || this.callbacks['*'];
    if (callback) {
      callback(parsedData);
    }
  }
}

const WebSocketInstance = WebSocketService.getInstance();

export default WebSocketInstance;
